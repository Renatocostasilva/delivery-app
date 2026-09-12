/**
 * payments/service.ts — REN-12 + REN-13
 *
 * Registro de pagamentos + máquina de estados + orquestração com o gateway.
 *
 * - REN-12: cria o registro Pagamento INICIADO para o pedido (idempotencyKey
 *   única evita cobrança duplicada).
 * - REN-13: integração REAL com o provedor (via interface GatewayPagamento):
 *   criação de cobrança PIX/cartão, webhooks e consulta de status.
 *
 * REGRA FUNDAMENTAL: pedido criado ≠ pagamento aprovado. O pedido só é
 * "finalizado" (PAGAMENTO_APROVADO) APÓS confirmação válida do gateway
 * (webhook assinado e/ou consulta de status). O gateway injetado é a única
 * fonte da verdade sobre o estado do pagamento.
 */

import { Prisma, type EstadoPagamento, type StatusPedido } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import {
  type CobrancaCriada,
  type GatewayError,
  type GatewayPagamento,
  type NotificacaoHttp,
  type StatusGatewayInfo,
  getGateway,
} from "./gateway.js";

export const GATEWAY_DEFAULT = "mercadopago";

type DbLike = Prisma.TransactionClient | typeof prisma;

/**
 * Cria o registro de pagamento para um pedido.
 * `idempotencyKey` é única por cobrança para evitar duplicidade.
 * Aceita um client de transação (`tx`) para participar de `$transaction`.
 */
export async function criarPagamento(
  pedidoId: number,
  valor: Prisma.Decimal,
  idempotencyKey: string,
  db: DbLike = prisma,
) {
  return db.pagamento.create({
    data: {
      pedidoId,
      valor,
      idempotencyKey,
      gateway: GATEWAY_DEFAULT,
      estadoPagamento: "INICIADO",
    },
  });
}

/**
 * Busca pagamento pela idempotencyKey (inclusive o pedido associado).
 * Usado para retornar o pedido já criado em reenvios idempotentes.
 */
export async function findPagamentoByIdempotencyKey(idempotencyKey: string) {
  return prisma.pagamento.findUnique({
    where: { idempotencyKey },
    include: { pedido: true },
  });
}

// ─── Máquina de estados do pagamento (REN-13) ─────────────────────────────────
//
//   INICIADO ──▶ PENDENTE ──▶ APROVADO ──▶ ESTORNADO
//                   │   │         ▲
//                   │   └──▶ RECUSADO/CANCELADO/EXPIRADO (falha)
//                   │         retry ▶ INICIADO/PENDENTE/APROVADO
//                   └──▶ APROVADO (PIX aprovado antes do webhook chegar)
//
// Estados de sucesso (APROVADO/ESTORNADO) nunca regridem. Estados de falha
// (RECUSADO/CANCELADO/EXPIRADO) podem "renascer" para PENDENTE/APROVADO
// quando uma NOVA cobrança é criada (retry) ou quando o gateway reconcilia
// (ex.: cobrança foi paga mas o webhook atrasou).

const TRANSICOES: Record<EstadoPagamento, EstadoPagamento[]> = {
  INICIADO: [
    "INICIADO",
    "PENDENTE",
    "APROVADO",
    "RECUSADO",
    "CANCELADO",
    "EXPIRADO",
    "ESTORNADO",
  ],
  PENDENTE: ["PENDENTE", "APROVADO", "RECUSADO", "CANCELADO", "EXPIRADO", "ESTORNADO"],
  APROVADO: ["APROVADO", "ESTORNADO"],
  RECUSADO: ["RECUSADO", "PENDENTE", "APROVADO", "CANCELADO", "EXPIRADO", "ESTORNADO"],
  CANCELADO: ["CANCELADO", "PENDENTE", "APROVADO", "RECUSADO", "EXPIRADO", "ESTORNADO"],
  EXPIRADO: ["EXPIRADO", "PENDENTE", "APROVADO", "RECUSADO", "CANCELADO", "ESTORNADO"],
  ESTORNADO: ["ESTORNADO"],
};

/** Verifica se a transição de estado do pagamento é permitida. */
export function podeTransicionar(
  atual: EstadoPagamento,
  destino: EstadoPagamento,
): boolean {
  return (TRANSICOES[atual] ?? []).includes(destino);
}

/** Traduz o status normalizado do gateway para o enum local. */
export function paraEstadoPagamento(status: string): EstadoPagamento {
  switch (status) {
    case "PENDENTE":
      return "PENDENTE";
    case "APROVADO":
      return "APROVADO";
    case "RECUSADO":
      return "RECUSADO";
    case "CANCELADO":
      return "CANCELADO";
    case "EXPIRADO":
      return "EXPIRADO";
    case "ESTORNADO":
      return "ESTORNADO";
    default:
      throw new HttpError(502, `Status de pagamento desconhecido: "${status}".`);
  }
}

/** Estado do Pedido derivado do estado do pagamento (null = mantém o atual). */
function statusPedidoParaEstado(estado: EstadoPagamento): StatusPedido | null {
  switch (estado) {
    case "APROVADO":
      return "PAGAMENTO_APROVADO";
    case "RECUSADO":
      return "RECUSADO";
    case "CANCELADO":
      return "CANCELADO"; // pedido cancelado por falta de pagamento
    case "EXPIRADO":
      return "CANCELADO";
    case "ESTORNADO":
      return "ESTORNADO";
    default:
      return null; // INICIADO/PENDENTE: pedido segue AGUARDANDO_PAGAMENTO
  }
}

type AtualizacaoPagamento = {
  idGateway?: string;
  meioPagamento?: string;
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  expiraEm?: Date | null;
  dadosGateway?: Prisma.InputJsonValue;
  ultimoErroGateway?: string | null;
  tentativasIncrement?: number;
  sincronizadoEm?: Date;
};

/**
 * Aplica um estado do gateway ao Pagamento + Pedido de forma atômica,
 * respeitando a máquina de estados (sem regressão de pagamento aprovado).
 * Retorna { pagamento, pedido } atualizados.
 */
export async function aplicarEstadoGateway(
  pagamentoId: number,
  estado: EstadoPagamento,
  extras: AtualizacaoPagamento = {},
) {
  return prisma.$transaction(async (tx) => {
    const atual = await tx.pagamento.findUnique({ where: { id: pagamentoId } });
    if (!atual) throw new HttpError(404, "Pagamento não encontrado.");

    if (!podeTransicionar(atual.estadoPagamento, estado)) {
      throw new HttpError(
        409,
        `Transição de estado inválida: ${atual.estadoPagamento} → ${estado}.`,
      );
    }

    const data: Prisma.PagamentoUpdateInput = { estadoPagamento: estado };
    if (extras.idGateway !== undefined) data.idGateway = extras.idGateway;
    if (extras.meioPagamento !== undefined) data.meioPagamento = extras.meioPagamento;
    if (extras.qrCode !== undefined) data.qrCode = extras.qrCode;
    if (extras.qrCodeBase64 !== undefined) data.qrCodeBase64 = extras.qrCodeBase64;
    if (extras.expiraEm !== undefined) data.expiraEm = extras.expiraEm;
    if (extras.dadosGateway !== undefined) data.dadosGateway = extras.dadosGateway;
    if (extras.ultimoErroGateway !== undefined)
      data.ultimoErroGateway = extras.ultimoErroGateway;
    if (extras.tentativasIncrement !== undefined)
      data.tentativas = { increment: extras.tentativasIncrement };
    if (extras.sincronizadoEm !== undefined) data.sincronizadoEm = extras.sincronizadoEm;

    const pagamento = await tx.pagamento.update({
      where: { id: pagamentoId },
      data,
    });

    const novoStatusPedido = statusPedidoParaEstado(estado);
    const pedido = await tx.pedido.update({
      where: { id: atual.pedidoId },
      data: {
        statusPagamento: estado,
        ...(novoStatusPedido ? { statusPedido: novoStatusPedido } : {}),
      },
    });

    return { pagamento, pedido };
  });
}

// ─── Helpers de cobrança ──────────────────────────────────────────────────────

const SUCESSO_TERMINAL: EstadoPagamento[] = ["APROVADO", "ESTORNADO"];

/** Registra a última falha do gateway no Pagamento (tentativas + mensagem). */
export async function registrarFalhaGateway(pagamentoId: number, err: unknown) {
  await prisma.pagamento.update({
    where: { id: pagamentoId },
    data: {
      tentativas: { increment: 1 },
      ultimoErroGateway: err instanceof Error ? err.message : String(err),
      sincronizadoEm: new Date(),
    },
  });
}

function aplicaCobrancaNoExtras(
  cobranca: CobrancaCriada,
  extras: AtualizacaoPagamento,
): AtualizacaoPagamento {
  return {
    ...extras,
    idGateway: cobranca.idGateway,
    meioPagamento: cobranca.meioPagamento,
    qrCode: cobranca.pix?.qrCode ?? undefined,
    qrCodeBase64: cobranca.pix?.qrCodeBase64 ?? undefined,
    expiraEm: cobranca.pix?.expiraEm ?? undefined,
    dadosGateway: (cobranca.dadosGateway ?? undefined) as
      | Prisma.InputJsonValue
      | undefined,
  };
}

async function carregarPedidoComPagamento(pedidoId: number) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      cliente: true,
      pagamentos: { orderBy: { id: "desc" } },
    },
  });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");

  // Permite criar/recriar cobrança para pedidos ainda pagáveis (inclusive os
  // que tiveram pagamento recusado/cancelado/expirado — retry na mesma ordem).
  const pagavel = [
    "AGUARDANDO_PAGAMENTO",
    "RECUSADO",
    "CANCELADO",
  ].includes(pedido.statusPedido);
  if (!pagavel) {
    throw new HttpError(
      409,
      "Pedido não aceita nova cobrança (status atual não permite pagamento).",
    );
  }

  const pagamento = pedido.pagamentos[0];
  if (!pagamento) {
    throw new HttpError(409, "Pedido sem registro de pagamento. Refça o checkout.");
  }
  return { pedido, pagamento };
}

// ─── Criação de cobrança (PIX e cartão tokenizado) ────────────────────────────

export type CriarCobrancaInput = {
  metodo: "pix" | "cartao";
  email?: string;
  token?: string;
  paymentMethodId?: string;
  installments?: number;
  notifyUrl?: string;
};

export type ResultadoCobranca = {
  criada: boolean;
  pedido: {
    id: number;
    numeroPedido: string;
    statusPedido: StatusPedido;
    statusPagamento: EstadoPagamento;
    total: Prisma.Decimal;
  };
  pagamento: {
    id: number;
    gateway: string;
    estadoPagamento: EstadoPagamento;
    meioPagamento: string | null;
    idGateway: string | null;
    valor: Prisma.Decimal;
    qrCode: string | null;
    qrCodeBase64: string | null;
    expiraEm: Date | null;
    tentativas: number;
    sincronizadoEm: Date | null;
    ultimoErroGateway: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

/**
 * Cria a cobrança no gateway para o pagamento do pedido.
 * - Pedido precisa estar AGUARDANDO_PAGAMENTO.
 * - Pagamento já concluído (APROVADO/ESTORNADO) → 409.
 * - Cobrança já criada e ainda PENDENTE/INICIADO → devolve a existente
 *   (idempotente, sem duplicar cobrança no provedor).
 * - Estado de falha (RECUSADO/CANCELADO/EXPIRADO) → cria uma COBRANÇA NOVA
 *   (retry), mantendo a idempotência no cliente.
 * - Falha de comunicação/timeout no gateway → registra erro no Pagamento,
 *   mantém INICIADO e permite nova tentativa.
 */
export async function criarCobranca(
  pedidoId: number,
  input: CriarCobrancaInput,
): Promise<ResultadoCobranca> {
  const { pedido, pagamento } = await carregarPedidoComPagamento(pedidoId);

  if (SUCESSO_TERMINAL.includes(pagamento.estadoPagamento)) {
    throw new HttpError(409, "Pagamento já concluído (aprovado ou estornado).");
  }

  const emailPagador = input.email ?? pedido.cliente.email;
  if (!emailPagador) {
    throw new HttpError(
      400,
      "E-mail do pagador é obrigatório (informe `email` no corpo ou cadastre-o no cliente).",
    );
  }

  // Cobrança já criada e ainda em aberto (aguardando pagamento) → idempotente.
  const emAberto = ["INICIADO", "PENDENTE"] as const;
  if (
    pagamento.idGateway &&
    emAberto.includes(pagamento.estadoPagamento as (typeof emAberto)[number])
  ) {
    const metodoAtual = pagamento.meioPagamento ?? "";
    const mesmoMetodo =
      (input.metodo === "pix" && metodoAtual === "pix") ||
      (input.metodo === "cartao" && metodoAtual !== "pix");
    if (mesmoMetodo) {
      return montarResultado(pedido, pedido.pagamentos[0], false);
    }

    // Troca de método em aberto (ex.: PIX → cartão ou cartão → PIX):
    // limpa os campos do gateway para permitir gerar uma nova cobrança.
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        idGateway: null,
        meioPagamento: null,
        qrCode: null,
        qrCodeBase64: null,
        expiraEm: null,
        dadosGateway: Prisma.DbNull,
      },
    });
  }

  const descricao = `Pedido ${pedido.numeroPedido}`;
  // `idempotencyKey` da chave do pedido + tentativa → nunca repete no provedor
  const chaveTentativa = `${pagamento.idempotencyKey}:${Date.now()}`;

  let cobranca: CobrancaCriada;
  try {
    const gateway: GatewayPagamento = getGateway();
    cobranca =
      input.metodo === "pix"
        ? await gateway.criarCobrancaPix({
            idempotencyKey: chaveTentativa,
            valor: Number(pedido.total),
            email: emailPagador,
            descricao,
            notifyUrl: input.notifyUrl,
          })
        : await gateway.criarCobrancaCartao({
            idempotencyKey: chaveTentativa,
            valor: Number(pedido.total),
            email: emailPagador,
            descricao,
            token: input.token as string,
            paymentMethodId: input.paymentMethodId as string,
            installments: input.installments,
            notifyUrl: input.notifyUrl,
          });
  } catch (err) {
    await registrarFalhaGateway(pagamento.id, err);
if (isGatewayError(err)) {
        throw new HttpError(
          err.statusCode === 503 || err.retriable ? 503 : 502,
          `Falha no gateway de pagamento: ${mensagemErro(err)}`,
        );
      }
    throw err;
  }

  const estado = paraEstadoPagamento(cobranca.status);
  const extras = aplicaCobrancaNoExtras(cobranca, { sincronizadoEm: new Date() });

  const { pedido: pedidoAtualizado, pagamento: pagamentoAtualizado } =
    await aplicarEstadoGateway(pagamento.id, estado, extras);

  return montarResultado(pedidoAtualizado, pagamentoAtualizado, true);
}

function isGatewayError(err: unknown): err is GatewayError {
  return (
    typeof err === "object" &&
    err !== null &&
    "retriable" in err &&
    typeof (err as { retriable?: unknown }).retriable === "boolean"
  );
}

function mensagemErro(err: GatewayError): string {
  return err.message;
}

function montarResultado(
  pedido: {
    id: number;
    numeroPedido: string;
    statusPedido: StatusPedido;
    statusPagamento: EstadoPagamento;
    total: Prisma.Decimal;
  },
  pagamento: {
    id: number;
    gateway: string;
    estadoPagamento: EstadoPagamento;
    meioPagamento: string | null;
    idGateway: string | null;
    valor: Prisma.Decimal;
    qrCode: string | null;
    qrCodeBase64: string | null;
    expiraEm: Date | null;
    tentativas: number;
    sincronizadoEm: Date | null;
    ultimoErroGateway: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  criada: boolean,
): ResultadoCobranca {
  const erro = pagamento.ultimoErroGateway ?? null;
  return {
    criada,
    pedido: {
      id: pedido.id,
      numeroPedido: pedido.numeroPedido,
      statusPedido: pedido.statusPedido,
      statusPagamento: pedido.statusPagamento,
      total: pedido.total,
    },
    pagamento: {
      id: pagamento.id,
      gateway: pagamento.gateway,
      estadoPagamento: pagamento.estadoPagamento,
      meioPagamento: pagamento.meioPagamento,
      idGateway: pagamento.idGateway,
      valor: pagamento.valor,
      qrCode: pagamento.qrCode,
      qrCodeBase64: pagamento.qrCodeBase64,
      expiraEm: pagamento.expiraEm,
      tentativas: pagamento.tentativas,
      sincronizadoEm: pagamento.sincronizadoEm,
      ultimoErroGateway: erro,
      createdAt: pagamento.createdAt,
      updatedAt: pagamento.updatedAt,
    },
  };
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export type ResultadoNotificacao = {
  processado: boolean;
  idGateway?: string;
  estado?: EstadoPagamento;
  ignorado?: boolean;
};

/**
 * Processa uma notificação HTTP do gateway. NUNCA confia no corpo da
 * notificação: primeiro valida a assinatura (quando configurada) e depois
 * CONSULTA o status real no gateway (fonte da verdade).
 */
export async function processarNotificacao(
  notificacao: NotificacaoHttp,
): Promise<ResultadoNotificacao> {
  const gateway = getGateway();

  const parseado = gateway.parseNotificacao(notificacao);
  if (!parseado) return { processado: false };

  const { idGateway } = parseado;
  const pagamento = await prisma.pagamento.findFirst({ where: { idGateway } });
  if (!pagamento) {
    // Notificação de pagamento que não geramos — ignora, retorna 200 pro provedor.
    return { processado: true, idGateway, ignorado: true };
  }

  const status: StatusGatewayInfo = await gateway.consultarStatus(idGateway);
  const estado = paraEstadoPagamento(status.status);

  try {
    const { pagamento: atualizado } = await aplicarEstadoGateway(pagamento.id, estado, {
      meioPagamento: status.meioPagamento ?? undefined,
      sincronizadoEm: new Date(),
    });
    return {
      processado: true,
      idGateway,
      estado: atualizado.estadoPagamento,
    };
  } catch (err) {
    if (err instanceof HttpError && err.status === 409) {
      // Transição inválida (ex.: notificação atrasada para pagamento já
      // aprovado) → ignora para não derrubar o webhook ao voltar a pagar.
      return { processado: true, idGateway, ignorado: true };
    }
    throw err;
  }
}

// ─── Consulta de status ───────────────────────────────────────────────────────

export type ResultadoConsulta = {
  sincronizado: boolean;
  pedido: {
    id: number;
    numeroPedido: string;
    statusPedido: StatusPedido;
    statusPagamento: EstadoPagamento;
    total: Prisma.Decimal;
    createdAt: Date;
  };
  pagamento: ResultadoCobranca["pagamento"];
};

/**
 * Consulta o status local do pagamento. Com `sincronizar: true`, consulta o
 * gateway (GET /v1/payments/:id) e aplica a máquina de estados — é o caminho
 * de reprocessamento ("pagamento aprovado sem pedido finalizado").
 */
export async function consultarStatusPagamento(
  pedidoId: number,
  opts: { sincronizar?: boolean } = {},
): Promise<ResultadoConsulta> {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { pagamentos: { orderBy: { id: "desc" } } },
  });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");
  const pagamento = pedido.pagamentos[0];
  if (!pagamento) throw new HttpError(404, "Pedido sem registro de pagamento.");

  let sincronizado = false;
  if (opts.sincronizar && pagamento.idGateway) {
    const gateway = getGateway();
    try {
      const status = await gateway.consultarStatus(pagamento.idGateway);
      const estado = paraEstadoPagamento(status.status);
      await aplicarEstadoGateway(pagamento.id, estado, {
        meioPagamento: status.meioPagamento ?? undefined,
        sincronizadoEm: new Date(),
      });
      sincronizado = true;
    } catch (err) {
      if (err instanceof HttpError && err.status === 409) {
        // Transição inválida → mantém o que já temos (fonte local preservada).
      } else {
        throw err;
      }
    }
  }

  const atualizado = await prisma.pagamento.findUniqueOrThrow({
    where: { id: pagamento.id },
  });
  const pedidoAtualizado = await prisma.pedido.findUniqueOrThrow({
    where: { id: pedidoId },
  });

  return {
    sincronizado,
    pedido: {
      id: pedidoAtualizado.id,
      numeroPedido: pedidoAtualizado.numeroPedido,
      statusPedido: pedidoAtualizado.statusPedido,
      statusPagamento: pedidoAtualizado.statusPagamento,
      total: pedidoAtualizado.total,
      createdAt: pedidoAtualizado.createdAt,
    },
    pagamento: {
      id: atualizado.id,
      gateway: atualizado.gateway,
      estadoPagamento: atualizado.estadoPagamento,
      meioPagamento: atualizado.meioPagamento,
      idGateway: atualizado.idGateway,
      valor: atualizado.valor,
      qrCode: atualizado.qrCode,
      qrCodeBase64: atualizado.qrCodeBase64,
      expiraEm: atualizado.expiraEm,
      tentativas: atualizado.tentativas,
      sincronizadoEm: atualizado.sincronizadoEm,
      ultimoErroGateway: atualizado.ultimoErroGateway,
      createdAt: atualizado.createdAt,
      updatedAt: atualizado.updatedAt,
    },
  };
}
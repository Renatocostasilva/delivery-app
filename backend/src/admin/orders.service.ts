import { Prisma, type StatusPedido } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import { type EstornoRealizado, type GatewayError, getGateway } from "../payments/gateway.js";
import { registrarFalhaGateway } from "../payments/service.js";

// ─── Máquina de estados do pedido (REN-14) ────────────────────────────────────
//
//   RECEBIDO ──▶ PAGAMENTO_APROVADO ──▶ EM_PREPARACAO ──▶ PRONTO
//                                                                 │
//                          ┌──────────────────────────────────────┘
//                          ▼
//                  SAIU_PARA_ENTREGA ──▶ ENTREGUE
//
//   Cancelamento bloqueado para ENTREGUE.
//   Estorno é uma ação que atualiza statusPagamento do pedido.

const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  RECEBIDO: [
    "PAGAMENTO_APROVADO",
    "EM_PREPARACAO",
    "CANCELADO",
  ],
  AGUARDANDO_PAGAMENTO: [
    "PAGAMENTO_APROVADO",
    "CANCELADO",
    "RECUSADO",
    "FALHA_PAGAMENTO",
  ],
  PAGAMENTO_APROVADO: [
    "EM_PREPARACAO",
    "CANCELADO",
  ],
  EM_PREPARACAO: [
    "PRONTO",
    "CANCELADO",
  ],
  PRONTO: [
    "SAIU_PARA_ENTREGA",
    "CANCELADO",
  ],
  SAIU_PARA_ENTREGA: [
    "ENTREGUE",
    "CANCELADO",
  ],
  ENTREGUE: [],
  CANCELADO: [],
  RECUSADO: [],
  FALHA_PAGAMENTO: [],
  ESTORNADO: [],
};

function podeTransicionarPedido(atual: StatusPedido, destino: StatusPedido): boolean {
  return (TRANSICOES[atual] ?? []).includes(destino);
}

// ─── Listar pedidos ──────────────────────────────────────────────────────────

export type ListPedidosParams = {
  status?: StatusPedido;
  busca?: string;
  dataInicio?: Date;
  dataFim?: Date;
  page: number;
  pageSize: number;
};

export async function listPedidos(params: ListPedidosParams) {
  const { status, busca, dataInicio, dataFim, page, pageSize } = params;

  const where: Prisma.PedidoWhereInput = {};
  if (status) where.statusPedido = status;
  if (dataInicio || dataFim) {
    where.createdAt = {};
    if (dataInicio) where.createdAt.gte = dataInicio;
    if (dataFim) {
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      where.createdAt.lte = fim;
    }
  }
  if (busca) {
    where.OR = [
      { numeroPedido: { contains: busca } },
      { cliente: { nome: { contains: busca } } },
      { cliente: { telefone: { contains: busca } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.pedido.findMany({
      where,
      include: {
        cliente: { select: { id: true, nome: true, telefone: true } },
        itens: { select: { produtoNome: true, quantidade: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pedido.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ─── Buscar pedido por ID ────────────────────────────────────────────────────

export async function getPedido(id: number) {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: true,
      itens: true,
      pagamentos: { orderBy: { id: "desc" } },
      historico: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");
  return pedido;
}

// ─── Buscar pedido por número ────────────────────────────────────────────────

export async function getPedidoByNumero(numeroPedido: string) {
  const pedido = await prisma.pedido.findUnique({
    where: { numeroPedido },
    include: {
      cliente: true,
      itens: true,
      pagamentos: { orderBy: { id: "desc" } },
      historico: { orderBy: { criadoEm: "asc" } },
    },
  });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");
  return pedido;
}

// ─── Atualizar status do pedido ─────────────────────────────────────────────

export async function atualizarStatusPedido(
  pedidoId: number,
  novoStatus: StatusPedido,
  adminId: number,
  observacao?: string,
) {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new HttpError(404, "Pedido não encontrado.");

    if (!podeTransicionarPedido(pedido.statusPedido, novoStatus)) {
      throw new HttpError(
        409,
        `Transição inválida: ${pedido.statusPedido} → ${novoStatus}.`,
      );
    }

    await tx.pedido.update({
      where: { id: pedidoId },
      data: { statusPedido: novoStatus },
    });

    await tx.statusHistorico.create({
      data: {
        pedidoId,
        de: pedido.statusPedido,
        para: novoStatus,
        adminId,
        observacao,
      },
    });

    return tx.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      include: {
        cliente: true,
        itens: true,
        pagamentos: { orderBy: { id: "desc" } },
        historico: { orderBy: { criadoEm: "asc" } },
      },
    });
  });
}

// ─── Cancelar pedido ────────────────────────────────────────────────────────

export async function cancelarPedido(
  pedidoId: number,
  adminId: number,
  motivo: string,
) {
  return atualizarStatusPedido(pedidoId, "CANCELADO", adminId, motivo);
}

// ─── Estornar pedido ────────────────────────────────────────────────────────

/**
 * Estorna um pedido com pagamento aprovado. Só marca ESTORNADO no banco após
 * confirmação REAL do gateway (refund). Em falha de comunicação/timeout,
 * NÃO marca estornado: registra `ultimoErroGateway` e lança 502/503.
 */
export async function estornarPedido(
  pedidoId: number,
  adminId: number,
  motivo: string,
) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { pagamentos: { orderBy: { id: "desc" } } },
  });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");

  if (pedido.statusPagamento !== "APROVADO") {
    throw new HttpError(
      409,
      "Só é possível estornar pedidos com pagamento aprovado.",
    );
  }

  const pagamento = pedido.pagamentos[0];
  if (!pagamento?.idGateway) {
    throw new HttpError(
      409,
      "Pedido sem pagamento registrado no gateway. Não é possível estornar.",
    );
  }

  let resultado: EstornoRealizado;
  try {
    const gateway = getGateway();
    resultado = await gateway.estornar({
      idGateway: pagamento.idGateway,
      valor: Number(pagamento.valor),
      idempotencyKey: pagamento.idempotencyKey,
    });
  } catch (err) {
    await registrarFalhaGateway(pagamento.id, err);
    if (isGatewayError(err)) {
      throw new HttpError(
        err.statusCode === 503 || err.retriable ? 503 : 502,
        `Falha no gateway de pagamento: ${err.message}`,
      );
    }
    throw err;
  }

  if (resultado.status !== "ESTORNADO") {
    throw new HttpError(
      409,
      `Estorno não confirmado pelo gateway. Estado atual do pagamento: ${resultado.status}.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.pagamento.update({
      where: { id: pagamento.id },
      data: {
        estadoPagamento: "ESTORNADO",
        sincronizadoEm: new Date(),
        ultimoErroGateway: null,
        dadosGateway: (resultado.dadosGateway ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        statusPedido: "ESTORNADO",
        statusPagamento: "ESTORNADO",
      },
    });

    await tx.statusHistorico.create({
      data: {
        pedidoId,
        de: pedido.statusPedido,
        para: "ESTORNADO",
        adminId,
        observacao: motivo,
      },
    });

    return tx.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      include: {
        cliente: true,
        itens: true,
        pagamentos: { orderBy: { id: "desc" } },
        historico: { orderBy: { criadoEm: "asc" } },
      },
    });
  });
}

function isGatewayError(err: unknown): err is GatewayError {
  return (
    typeof err === "object" &&
    err !== null &&
    "retriable" in err &&
    typeof (err as { retriable?: unknown }).retriable === "boolean"
  );
}

// ─── Reimprimir pedido ──────────────────────────────────────────────────────

export async function reimprimirPedido(pedidoId: number) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: {
      cliente: { select: { nome: true, telefone: true, email: true } },
      itens: true,
      pagamentos: { orderBy: { id: "desc" } },
    },
  });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");

  return {
    numeroPedido: pedido.numeroPedido,
    status: pedido.statusPedido,
    cliente: pedido.cliente,
    itens: pedido.itens.map((item) => ({
      nome: item.produtoNome,
      variacao: item.variacaoNome,
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
      adicionais: item.adicionais,
      total: item.total,
    })),
    subtotal: pedido.totalProdutos,
    taxaEntrega: pedido.taxasEntrega,
    desconto: pedido.desconto,
    total: pedido.total,
    formaPagamento: pedido.formaPagamento,
    observacoes: pedido.observacoes,
    criadoEm: pedido.createdAt,
  };
}

// ─── Histórico de status ─────────────────────────────────────────────────────

export async function getHistorico(pedidoId: number) {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");

  return prisma.statusHistorico.findMany({
    where: { pedidoId },
    orderBy: { criadoEm: "asc" },
  });
}

// ─── Clientes admin ──────────────────────────────────────────────────────────

export type ListClientesParams = {
  busca?: string;
  page: number;
  pageSize: number;
};

export async function listClientes(params: ListClientesParams) {
  const { busca, page, pageSize } = params;

  const where: Prisma.ClienteWhereInput = {};
  if (busca) {
    where.OR = [
      { nome: { contains: busca } },
      { telefone: { contains: busca } },
      { email: { contains: busca } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      include: {
        _count: { select: { pedidos: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.cliente.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ─── Pagamentos admin ────────────────────────────────────────────────────────

export async function getPagamentos(pedidoId: number) {
  const pedido = await prisma.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");

  return prisma.pagamento.findMany({
    where: { pedidoId },
    orderBy: { id: "desc" },
  });
}

// ─── Excluir pedido ──────────────────────────────────────────────────────────
//
// Regra de negócio (admin): só é possível excluir um pedido quando NÃO houver
// pagamento registrado OU quando TODOS os pagamentos estiverem estornados.
// Havendo pagamento não estornado, a exclusão é recusada até o estorno.
// O acesso à rota é restrito a admins (requireAuth em orders.routes.ts).

export async function excluirPedido(id: number) {
  const pedido = await prisma.pedido.findUnique({
    where: { id },
    include: { pagamentos: true },
  });
  if (!pedido) throw new HttpError(404, "Pedido não encontrado.");

  const semPagamento = pedido.pagamentos.length === 0;
  const todosEstornados =
    pedido.pagamentos.length > 0 &&
    pedido.pagamentos.every((p) => p.estadoPagamento === "ESTORNADO");

  if (!semPagamento && !todosEstornados) {
    throw new HttpError(
      409,
      "Não é possível excluir o pedido: há pagamento não estornado. Estorne o pagamento antes de excluir.",
    );
  }

  // Sem onDelete: Cascade, removemos os filhos em transação antes do pedido.
  await prisma.$transaction([
    prisma.statusHistorico.deleteMany({ where: { pedidoId: id } }),
    prisma.itemPedido.deleteMany({ where: { pedidoId: id } }),
    prisma.pagamento.deleteMany({ where: { pedidoId: id } }),
    prisma.pedido.delete({ where: { id } }),
  ]);

  return { message: "Pedido excluído.", id };
}

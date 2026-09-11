/**
 * payments/gateway.ts — REN-13
 *
 * Abstração comum de gateway de pagamento. A lógica de pedidos/pagamentos
 * depende APENAS desta interface; o provedor concreto (ex.: Mercado Pago)
 * fica isolado em `integrations/` e é plugado via `setGateway`.
 * Trocar de provedor não exige reescrever a lógica de pedidos.
 */

/**
 * Status normalizado do gateway (independente do provedor).
 */
export type StatusGateway =
  | "PENDENTE"
  | "APROVADO"
  | "RECUSADO"
  | "CANCELADO"
  | "EXPIRADO"
  | "ESTORNADO";

export type MetodoPagamento = "pix" | "cartao";

/** Entrada para criação de cobrança PIX. */
export type CriarCobrancaPixInput = {
  idempotencyKey: string;
  valor: number;
  email: string;
  descricao: string;
  notifyUrl?: string;
};

/** Entrada para criação de cobrança com cartão tokenizado. */
export type CriarCobrancaCartaoInput = {
  idempotencyKey: string;
  valor: number;
  email: string;
  descricao: string;
  token: string;
  paymentMethodId: string;
  installments?: number;
  notifyUrl?: string;
};

/** Dados da cobrança criada no gateway. */
export type CobrancaCriada = {
  idGateway: string;
  status: StatusGateway;
  meioPagamento: string;
  /** Presente no PIX: copia-e-cola e QR image. */
  pix?: { qrCode: string | null; qrCodeBase64: string | null; expiraEm: Date | null };
  detalhes?: string | null;
  dadosGateway?: unknown;
};

/** Resultado de consulta de status no gateway. */
export type StatusGatewayInfo = {
  idGateway: string;
  status: StatusGateway;
  meioPagamento?: string | null;
  detalhes?: string | null;
  atualizadoEm?: Date | null;
};

/** Payload bruto de notificação recebido via HTTP (webhook). */
export type NotificacaoHttp = {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Contrato que todo provedor de pagamento precisa preencher.
 */
export interface GatewayPagamento {
  readonly nome: string;
  criarCobrancaPix(input: CriarCobrancaPixInput): Promise<CobrancaCriada>;
  criarCobrancaCartao(input: CriarCobrancaCartaoInput): Promise<CobrancaCriada>;
  consultarStatus(idGateway: string): Promise<StatusGatewayInfo>;
  /**
   * Interpreta uma notificação HTTP do provedor: valida assinatura (quando
   * configurada) e extrai o id do pagamento. Retorna null se não reconhecida.
   * Lança erro com `status` (ex.: 401) se a assinatura for inválida.
   */
  parseNotificacao(notificacao: NotificacaoHttp): { idGateway: string } | null;
}

/** Erro originado pelo gateway (rede, timeout, recusa da API, ...). */
export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly retriable = false,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

// ─── Registro do provedor ativo ───────────────────────────────────────────────

let gatewayAtivo: GatewayPagamento | null = null;

/** Injeta o provedor ativo (prod). Em testes, pluga um gateway fake. */
export function setGateway(gateway: GatewayPagamento): void {
  gatewayAtivo = gateway;
}

/** Desfaz a injeção (usado em testes/orquestração). */
export function clearGateway(): void {
  gatewayAtivo = null;
}

/**
 * Provedor ativo. É injetado no bootstrap do servidor (src/index.ts) ou em
 * testes via `setGateway`. Antes de qualquer cobrança real, o gateway deve
 * estar configurado; a API responde 503 caso contrário.
 */
export function getGateway(): GatewayPagamento {
  if (!gatewayAtivo) {
    throw new GatewayError(
      "Nenhum gateway de pagamento configurado. Injete via setGateway ou configure as credenciais.",
      false,
      503,
    );
  }
  return gatewayAtivo;
}
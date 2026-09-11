/**
 * fake-gateway.ts — REN-13
 *
 * Gateway de pagamento simulado para testes. Configurável para retornar
 * status pré-definidos, simular timeout, falhas, etc.
 */

import type {
  CobrancaCriada,
  CriarCobrancaCartaoInput,
  CriarCobrancaPixInput,
  GatewayPagamento,
  NotificacaoHttp,
  StatusGateway,
  StatusGatewayInfo,
} from "./gateway.js";

export type FakeGatewayConfig = {
  /** Status retornado por padrão ao criar PIX (default: "PENDENTE"). */
  pixStatus?: StatusGateway;
  /** Status retornado por padrão ao criar cartão (default: "PENDENTE"). */
  cartaoStatus?: StatusGateway;
  /** Se definido, criarCobrancaPix lança este erro. */
  criarPixErro?: Error;
  /** Se definido, criarCobrancaCartao lança este erro. */
  criarCartaoErro?: Error;
  /** Se definido, consultarStatus lança este erro. */
  consultarStatusErro?: Error;
  /** Status a ser retornado ao consultar um idGateway específico. */
  statusPorId?: Map<string, StatusGateway>;
  /** Se true, a assinatura do webhook é validada (usando webhookSecret). */
  validarAssinatura?: boolean;
  webhookSecret?: string;
  id?: number;
};

export class FakeGateway implements GatewayPagamento {
  readonly nome = "fake";
  private config: FakeGatewayConfig;
  private contador: number;

  constructor(config: FakeGatewayConfig = {}) {
    this.config = config;
    this.contador = config.id ?? 1000;
  }

  updateConfig(patch: Partial<FakeGatewayConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  async criarCobrancaPix(input: CriarCobrancaPixInput): Promise<CobrancaCriada> {
    if (this.config.criarPixErro) throw this.config.criarPixErro;
    const id = String(++this.contador);
    return {
      idGateway: id,
      status: this.config.pixStatus ?? "PENDENTE",
      meioPagamento: "pix",
      detalhes: "created",
      pix: {
        qrCode: `PIX-${id}-${Date.now()}`,
        qrCodeBase64: `base64-qr-${id}`,
        expiraEm: new Date(Date.now() + 30 * 60 * 1000),
      },
      dadosGateway: { id, external_reference: input.descricao },
    };
  }

  async criarCobrancaCartao(input: CriarCobrancaCartaoInput): Promise<CobrancaCriada> {
    if (this.config.criarCartaoErro) throw this.config.criarCartaoErro;
    const id = String(++this.contador);
    return {
      idGateway: id,
      status: this.config.cartaoStatus ?? "PENDENTE",
      meioPagamento: input.paymentMethodId,
      detalhes: "created",
      dadosGateway: { id, external_reference: input.descricao },
    };
  }

  async consultarStatus(idGateway: string): Promise<StatusGatewayInfo> {
    if (this.config.consultarStatusErro) throw this.config.consultarStatusErro;
    const status = this.config.statusPorId?.get(idGateway) ?? "PENDENTE";
    return {
      idGateway,
      status,
      meioPagamento: "pix",
      detalhes: null,
      atualizadoEm: new Date(),
    };
  }

  parseNotificacao(notificacao: NotificacaoHttp): { idGateway: string } | null {
    if (this.config.validarAssinatura && this.config.webhookSecret) {
      const signature = notificacao.headers["x-signature"];
      if (!signature || typeof signature !== "string") {
        throw Object.assign(new Error("x-signature ausente"), { status: 401 });
      }
    }
    const body = notificacao.body as Record<string, unknown> | undefined;
    if (!body) return null;
    const data = body.data as Record<string, unknown> | undefined;
    const id = data?.id ?? body.id;
    if (id === undefined || id === null) return null;
    return { idGateway: String(id) };
  }

  /** Helper para registrar status mock de um idGateway específico. */
  setStatus(idGateway: string, status: StatusGateway): void {
    if (!this.config.statusPorId) this.config.statusPorId = new Map();
    this.config.statusPorId.set(idGateway, status);
  }

  gerarId(): string {
    return String(++this.contador);
  }
}

/**
 * Retorna um fake-gateway já instanciado. Cria um novo por chamada
 * para isolar testes (controla cada suite independentemente).
 */
export function createFakeGateway(config: FakeGatewayConfig = {}): FakeGateway {
  return new FakeGateway(config);
}
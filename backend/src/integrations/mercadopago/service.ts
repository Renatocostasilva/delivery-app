/**
 * integrations/mercadopago/service.ts — REN-13
 *
 * Implementação concreta de `GatewayPagamento` para o MercadoPago.
 * Traduz os payloads da API REST do provedor para o vocabulário do domínio
 * (StatusGateway) e valida notificações de webhook (HMAC assinado,
 * quando `MERCADOPAGO_WEBHOOK_SECRET` está configurado).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "../../lib/http.js";
import {
  GatewayError,
  type CobrancaCriada,
  type CriarCobrancaCartaoInput,
  type CriarCobrancaPixInput,
  type EstornarPagamentoInput,
  type EstornoRealizado,
  type GatewayPagamento,
  type NotificacaoHttp,
  type StatusGateway,
  type StatusGatewayInfo,
} from "../../payments/gateway.js";
import { MercadoPagoClient } from "./client.js";
import type { MercadoPagoPayment, MercadoPagoPaymentRequest } from "./types.js";

export type MercadoPagoGatewayConfig = {
  client: MercadoPagoClient;
  /** Secret usada na assinatura HMAC dos webhooks. Opcional (dev/test). */
  webhookSecret?: string;
  /** URL de notificação enviada ao provedor na criação da cobrança. */
  notifyUrl?: string;
  /** Janela de tolerância do timestamp do webhook (ms). Default 5 min. */
  webhookToleranciaMs?: number;
};

const MAPA_STATUS: Record<string, StatusGateway> = {
  pending: "PENDENTE",
  in_process: "PENDENTE",
  authorized: "PENDENTE",
  in_mediation: "PENDENTE",
  approved: "APROVADO",
  rejected: "RECUSADO",
  cancelled: "CANCELADO",
  expired: "EXPIRADO",
  refunded: "ESTORNADO",
  charged_back: "ESTORNADO",
};

export function statusGatewayMercadoPago(status: string): StatusGateway {
  const normalizado = MAPA_STATUS[status];
  if (!normalizado) throw new HttpError(502, `Status desconhecido do MercadoPago: "${status}".`);
  return normalizado;
}

function dataPix(p: MercadoPagoPayment): CobrancaCriada["pix"] {
  if (!p.point_of_interaction?.transaction_data) return undefined;
  const td = p.point_of_interaction.transaction_data;
  return {
    qrCode: td.qr_code ?? null,
    qrCodeBase64: td.qr_code_base64 ?? null,
    expiraEm: dataValida(p.date_of_expiration, p.date_expiration),
  };
}

function dataValida(...datas: (string | null | undefined)[]): Date | null {
  for (const d of datas) {
    if (d) {
      const parsed = new Date(d);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function detalhesStatus(p: MercadoPagoPayment): string | null {
  return p.status_detail ?? null;
}

function parsearAssinatura(signHeader: string | undefined): { ts: string; v1: string } {
  if (!signHeader) throw new HttpError(401, "x-signature ausente no webhook.");
  const partes = Object.fromEntries(
    signHeader
      .split(",")
      .map((par) => {
        const [k, ...rest] = par.trim().split("=");
        return [k, rest.join("=") ?? ""];
      }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) throw new HttpError(401, "x-signature malformada no webhook.");
  return { ts, v1 };
}

export class MercadoPagoGateway implements GatewayPagamento {
  readonly nome = "mercadopago";

  constructor(private readonly config: MercadoPagoGatewayConfig) {}

  async criarCobrancaPix(input: CriarCobrancaPixInput): Promise<CobrancaCriada> {
    const payload: MercadoPagoPaymentRequest = {
      transaction_amount: input.valor,
      description: input.descricao,
      payment_method_id: "pix",
      payer: { email: input.email },
      external_reference: input.descricao,
      ...(input.notifyUrl ?? this.config.notifyUrl
        ? { notification_url: input.notifyUrl ?? this.config.notifyUrl }
        : {}),
    };

    const p = await this.config.client.criarPagamento(payload, input.idempotencyKey);

    return {
      idGateway: String(p.id),
      status: statusGatewayMercadoPago(p.status),
      meioPagamento: p.payment_method_id ?? "pix",
      detalhes: detalhesStatus(p),
      pix: dataPix(p),
      dadosGateway: p,
    };
  }

  async criarCobrancaCartao(input: CriarCobrancaCartaoInput): Promise<CobrancaCriada> {
    const payload: MercadoPagoPaymentRequest = {
      transaction_amount: input.valor,
      description: input.descricao,
      payment_method_id: input.paymentMethodId,
      payer: { email: input.email },
      token: input.token,
      installments: input.installments ?? 1,
      external_reference: input.descricao,
      ...(input.notifyUrl ?? this.config.notifyUrl
        ? { notification_url: input.notifyUrl ?? this.config.notifyUrl }
        : {}),
    };

    const p = await this.config.client.criarPagamento(payload, input.idempotencyKey);

    return {
      idGateway: String(p.id),
      status: statusGatewayMercadoPago(p.status),
      meioPagamento: p.payment_method_id ?? "cartao",
      detalhes: detalhesStatus(p),
      dadosGateway: p,
    };
  }

  async consultarStatus(idGateway: string): Promise<StatusGatewayInfo> {
    const p = await this.config.client.consultarPagamento(idGateway);
    return {
      idGateway: String(p.id),
      status: statusGatewayMercadoPago(p.status),
      meioPagamento: p.payment_method_id ?? null,
      detalhes: detalhesStatus(p),
      atualizadoEm:
        dataValida(p.date_approved, p.date_of_expiration) ?? new Date(),
    };
  }

  /**
   * Estorno real via POST /v1/payments/:id/refunds (refund total). A resposta
   * do refund não traz `status`: a confirmação vem do STATUS da cobrança
   * (GET /v1/payments/:id) — que vira `refunded`/`charged_back` → ESTORNADO.
   * - Timeout/falha de rede (retriable) → propaga (o chamador registra erro).
   * - Erro 4xx no refund (ex.: já estornado, status inválido) → consulta o
   *   status real do pagamento e devolve o estado verdadeiro.
   */
  async estornar(input: EstornarPagamentoInput): Promise<EstornoRealizado> {
    try {
      await this.config.client.estornarPagamento(
        input.idGateway,
        input.valor,
        input.idempotencyKey,
      );
    } catch (err) {
      if (err instanceof GatewayError && err.retriable) {
        throw err;
      }
      // 4xx: sem confirmação de refund via POST — decide pelo status real.
    }

    const p = await this.config.client.consultarPagamento(input.idGateway);
    return {
      idGateway: String(p.id),
      status: statusGatewayMercadoPago(p.status),
      meioPagamento: p.payment_method_id ?? null,
      detalhes: detalhesStatus(p),
      dadosGateway: p,
    };
  }

  parseNotificacao(notificacao: NotificacaoHttp): { idGateway: string } | null {
    const body = notificacao.body;
    const idGateway =
      typeof body === "object" && body !== null
        ? ((body as Record<string, unknown>).data as Record<string, unknown> | undefined)?.id ??
          (body as Record<string, unknown>).id
        : undefined;

    if (idGateway === undefined || idGateway === null) return null;

    if (this.config.webhookSecret) {
      this.#validarAssinatura(notificacao, idGateway);
    }

    return { idGateway: String(idGateway) };
  }

  #validarAssinatura(notificacao: NotificacaoHttp, idGateway: unknown): void {
    const webhookSecret = this.config.webhookSecret;
    if (!webhookSecret) {
      throw new HttpError(500, "Webhook secret não configurado.");
    }

    const signHeader = primeiroCabecalho(notificacao.headers["x-signature"]);
    const { ts, v1 } = parsearAssinatura(signHeader);

    const tolerancia = this.config.webhookToleranciaMs ?? 5 * 60 * 1000;
    const tsNumero = Number(ts);
    if (Number.isNaN(tsNumero) || Math.abs(Date.now() - tsNumero * 1000) > tolerancia) {
      throw new HttpError(401, "Webhook rejeitado: timestamp expirado.");
    }

    const requestIdHeader = primeiroCabecalho(
      notificacao.headers["x-request-id"],
    ) ?? "";
    const manifest = `id:${idGateway};request-id:${requestIdHeader};ts:${ts};`;
    const esperado = createHmac("sha256", webhookSecret)
      .update(manifest)
      .digest("hex");

    const a = Buffer.from(esperado);
    const b = Buffer.from(v1);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new HttpError(401, "Webhook rejeitado: assinatura inválida.");
    }
  }
}

function primeiroCabecalho(
  valor: string | string[] | undefined,
): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}
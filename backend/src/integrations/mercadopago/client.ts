/**
 * integrations/mercadopago/client.ts — REN-13
 *
 * Cliente HTTP da API REST do MercadoPago (api.mercadopago.com).
 * Autentica via `Authorization: Bearer <access_token>` e envia
 * `X-Idempotency-Key` na criação de pagamentos (idempotência no provedor).
 *
 * NÃO usa o MCP do MercadoPago em runtime — o MCP serve apenas para
 * configuração/credenciais/testes. Em runtime usa-se a API REST.
 */

import { GatewayError } from "../../payments/gateway.js";
import {
  type MercadoPagoErrorBody,
  type MercadoPagoPayment,
  type MercadoPagoPaymentRequest,
} from "./types.js";

export type MercadoPagoClientConfig = {
  /** Access token (test ou produção) usado no Bearer header. */
  accessToken: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

const API_BASE = "https://api.mercadopago.com";

export class MercadoPagoClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: MercadoPagoClientConfig) {
    this.baseUrl = (config.baseUrl ?? API_BASE).replace(/\/$/, "");
    this.timeoutMs = config.timeoutMs ?? 8000;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** POST /v1/payments — cria PIX ou cartão tokenizado (idempotente). */
  async criarPagamento(
    payload: MercadoPagoPaymentRequest,
    idempotencyKey: string,
  ): Promise<MercadoPagoPayment> {
    return this.#request("/v1/payments", {
      method: "POST",
      headers: { "X-Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    });
  }

  /** GET /v1/payments/:id — consulta o status (fonte da verdade). */
  async consultarPagamento(idGateway: string): Promise<MercadoPagoPayment> {
    const id = encodeURIComponent(idGateway);
    return this.#request(`/v1/payments/${id}`);
  }

  async #request(
    path: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<MercadoPagoPayment> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
        body: init?.body,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new GatewayError(
          `Timeout ao chamar o MercadoPago (${this.timeoutMs}ms).`,
          true,
        );
      }
      throw new GatewayError(
        `Falha de comunicação com o MercadoPago: ${err instanceof Error ? err.message : String(err)}.`,
        true,
      );
    } finally {
      clearTimeout(timer);
    }

    const body: MercadoPagoPayment & MercadoPagoErrorBody | null =
      await res.json().catch(() => null);

    if (!res.ok) {
      const mensagem = Array.isArray(body?.message)
        ? body.message.join("; ")
        : (body?.message ?? body?.error ?? `MercadoPago respondeu ${res.status}.`);
      throw new GatewayError(mensagem, res.status >= 500, res.status);
    }

    return (body ?? {}) as MercadoPagoPayment;
  }
}
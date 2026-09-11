/**
 * integrations/mercadopago/index.ts — REN-13
 *
 * Fábrica do gateway MercadoPago a partir de variáveis de ambiente.
 * As credenciais ficam em .env/.env.local (NUNCA commitadas).
 */

import { MercadoPagoClient } from "./client.js";
import { MercadoPagoGateway } from "./service.js";

export { MercadoPagoClient } from "./client.js";
export { MercadoPagoGateway, statusGatewayMercadoPago } from "./service.js";
export type { MercadoPagoGatewayConfig } from "./service.js";
export type {
  MercadoPagoPayment,
  MercadoPagoPaymentRequest,
  MercadoPagoPaymentStatus,
} from "./types.js";

function getAccessToken(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === "production") {
    return env.MERCADOPAGO_ACCESS_TOKEN_PROD ?? env.MERCADOPAGO_ACCESS_TOKEN ?? "";
  }
  return env.MERCADOPAGO_ACCESS_TOKEN_TEST ?? env.MERCADOPAGO_ACCESS_TOKEN ?? "";
}

/** True se o ambiente possui o token de acesso (test ou produção). */
export function mercadoPagoConfigurado(env: NodeJS.ProcessEnv = process.env): boolean {
  return getAccessToken(env).length > 0;
}

/**
 * Instancia o gateway MercadoPago com as credenciais do ambiente.
 * Lança erro claro se o access token não estiver configurado.
 */
export function createMercadoPagoGateway(
  env: NodeJS.ProcessEnv = process.env,
): MercadoPagoGateway {
  const accessToken = getAccessToken(env);
  if (!accessToken) {
    const chave =
      env.NODE_ENV === "production"
        ? "MERCADOPAGO_ACCESS_TOKEN_PROD"
        : "MERCADOPAGO_ACCESS_TOKEN_TEST";
    throw new Error(
      `MercadoPago não configurado: defina ${chave} (ou MERCADOPAGO_ACCESS_TOKEN).`,
    );
  }

  const client = new MercadoPagoClient({
    accessToken,
    baseUrl: env.MERCADOPAGO_API_URL || undefined,
    timeoutMs: env.MERCADOPAGO_TIMEOUT_MS
      ? Number(env.MERCADOPAGO_TIMEOUT_MS)
      : undefined,
  });

  return new MercadoPagoGateway({
    client,
    webhookSecret: env.MERCADOPAGO_WEBHOOK_SECRET || undefined,
    notifyUrl: env.MERCADOPAGO_WEBHOOK_URL || undefined,
  });
}

/** Public key exposta para o frontend (tokenização do cartão). */
export function getPublicKeyTest(env: NodeJS.ProcessEnv = process.env): string {
  return env.MERCADOPAGO_PUBLIC_KEY_TEST ?? "";
}
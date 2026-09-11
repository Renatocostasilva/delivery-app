/**
 * integrations/mercadopago/types.ts — REN-13
 *
 * Tipos da API REST do MercadoPago (payments v1) usados na integração.
 * Refletem apenas os campos relevantes da resposta do provedor.
 */

export type MercadoPagoPaymentStatus =
  | "pending"
  | "approved"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | "authorized"
  | "expired";

export type MercadoPagoPayer = {
  email?: string;
};

export type MercadoPagoTransactionData = {
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
};

export type MercadoPagoPointOfInteraction = {
  transaction_data?: MercadoPagoTransactionData;
};

/** Resposta de POST /v1/payments e GET /v1/payments/:id. */
export type MercadoPagoPayment = {
  id: number | string;
  status: MercadoPagoPaymentStatus;
  status_detail?: string;
  transaction_amount?: number;
  payment_method_id?: string;
  description?: string;
  external_reference?: string | null;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  date_expiration?: string | null;
  payer?: MercadoPagoPayer;
  point_of_interaction?: MercadoPagoPointOfInteraction;
};

/** Payload para POST /v1/payments (PIX ou cartão tokenizado). */
export type MercadoPagoPaymentRequest = {
  transaction_amount: number;
  description: string;
  payment_method_id: string;
  payer: { email: string };
  token?: string;
  installments?: number;
  external_reference?: string;
  notification_url?: string;
  date_of_expiration?: string;
};

export type MercadoPagoErrorBody = {
  message?: string | string[];
  error?: string;
  status?: number;
};
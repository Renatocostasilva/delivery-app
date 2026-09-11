/**
 * payments/routes.ts — REN-13
 *
 * Endpoints de pagamento:
 *   - POST /api/payments/:pedidoId/cobrancas  — cria a cobrança (PIX ou cartão)
 *                                               no gateway para o pedido
 *                                               AGUARDANDO_PAGAMENTO.
 *   - POST /api/payments/webhooks/mercadopago — notificação do provedor
 *                                               (confirmação via consulta ao
 *                                               gateway; valida assinatura).
 *   - GET  /api/payments/:pedidoId            — consulta o status local do
 *                                               pagamento (com ?sync=true,
 *                                               sincroniza com o gateway).
 */

import { Router } from "express";
import * as v from "../lib/validate.js";
import { HttpError, parseIdParam } from "../lib/http.js";
import {
  consultarStatusPagamento,
  criarCobranca,
  processarNotificacao,
} from "./service.js";

export const paymentsRouter: Router = Router();

// POST /api/payments/:pedidoId/cobrancas
// Body: { metodo: "pix"|"cartao", email?, token?, paymentMethodId?,
//         installments?, notifyUrl? }
paymentsRouter.post("/:pedidoId/cobrancas", async (req, res, next) => {
  try {
    const pedidoId = parseIdParam(req.params.pedidoId);
    const body = req.body as Record<string, unknown>;

    const metodo = v.text(body.metodo, "metodo", { required: true }) as string;
    if (metodo !== "pix" && metodo !== "cartao") {
      throw new HttpError(400, `Campo "metodo" deve ser "pix" ou "cartao".`);
    }

    const email = v.text(body.email, "email");
    const installments = v.intField(body.installments, "installments", {
      min: 1,
    });

    let token: string | undefined;
    let paymentMethodId: string | undefined;
    if (metodo === "cartao") {
      token = v.text(body.token, "token", { required: true }) as string;
      paymentMethodId = v.text(body.paymentMethodId, "paymentMethodId", {
        required: true,
      }) as string;
    }

    const result = await criarCobranca(pedidoId, {
      metodo,
      email,
      token,
      paymentMethodId,
      installments,
      notifyUrl: v.text(body.notifyUrl, "notifyUrl"),
    });

    res.status(result.criada ? 201 : 200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhooks/mercadopago
// O corpo NUNCA é confiado: a confirmação real vem de GET /v1/payments/:id.
// Assinatura (x-signature) só é exigida quando webhookSecret está configurado.
paymentsRouter.post("/webhooks/mercadopago", async (req, res, next) => {
  try {
    const resultado = await processarNotificacao({
      body: req.body,
      headers: {
        "x-signature": req.get("x-signature"),
        "x-request-id": req.get("x-request-id"),
      },
    });
    res.json({ ok: true, ...resultado });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:pedidoId?sync=true
paymentsRouter.get("/:pedidoId", async (req, res, next) => {
  try {
    const pedidoId = parseIdParam(req.params.pedidoId);
    const sincronizar = req.query.sync === "true";
    const result = await consultarStatusPagamento(pedidoId, { sincronizar });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
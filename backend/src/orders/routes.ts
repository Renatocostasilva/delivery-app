/**
 * orders/routes.ts — REN-12
 *
 * Checkout em etapas (identificação → entrega → resumo → confirmação).
 * Endpoints públicos: o cliente é identificado pelo cartKey + idempotencyKey.
 */

import { Router } from "express";
import * as v from "../lib/validate.js";
import {
  identificarCliente,
  definirEntrega,
  resumoPedido,
  confirmarPedido,
} from "./service.js";

export const checkoutRouter: Router = Router();

// POST /api/checkout/identify — etapa 1: identificação do cliente
// Body: { cartKey, nome, telefone }
checkoutRouter.post("/identify", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;

    const cartKey = v.text(body.cartKey, "cartKey", {
      required: true,
    }) as string;
    const nome = v.text(body.nome, "nome", { required: true }) as string;
    const telefone = v.text(body.telefone, "telefone", {
      required: true,
    }) as string;

    const data = await identificarCliente({ cartKey, nome, telefone });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/checkout/delivery — etapa 2: opção de entrega
// Body: { cartKey, tipoEntrega: "RETIRADA"|"ENTREGA", endereco? }
checkoutRouter.post("/delivery", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;

    const cartKey = v.text(body.cartKey, "cartKey", {
      required: true,
    }) as string;
    const tipoEntrega = v.text(body.tipoEntrega, "tipoEntrega", {
      required: true,
    }) as string;

    const data = await definirEntrega({
      cartKey,
      tipoEntrega,
      endereco: body.endereco,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/checkout/summary — etapa 3: resumo com total recalculado
// Body: { cartKey, tipoEntrega }
checkoutRouter.post("/summary", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;

    const cartKey = v.text(body.cartKey, "cartKey", {
      required: true,
    }) as string;
    const tipoEntrega = v.text(body.tipoEntrega, "tipoEntrega", {
      required: true,
    }) as string;

    const data = await resumoPedido({ cartKey, tipoEntrega });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/checkout/confirm — etapa 4: cria pedido + itens + pagamento
// Body: { cartKey, idempotencyKey, nome, telefone, tipoEntrega, endereco?,
//         observacoes? }
checkoutRouter.post("/confirm", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;

    const cartKey = v.text(body.cartKey, "cartKey", {
      required: true,
    }) as string;
    const idempotencyKey = v.text(body.idempotencyKey, "idempotencyKey", {
      required: true,
    }) as string;

    const result = await confirmarPedido({
      cartKey,
      idempotencyKey,
      nome: body.nome as string,
      telefone: body.telefone as string,
      tipoEntrega: body.tipoEntrega as string,
      endereco: body.endereco,
      observacoes: body.observacoes as string | null | undefined,
      formaPagamento: body.formaPagamento as string | undefined,
    });

    res.status(result.jaExistia ? 200 : 201).json(result.pedido);
  } catch (err) {
    next(err);
  }
});
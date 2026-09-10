/**
 * cart/routes.ts — REN-11
 *
 * Rotas REST do carrinho. Todos os endpoints são públicos (sem auth):
 * o cliente é identificado apenas pelo cartKey (UUID gerado no servidor).
 */

import { Router } from "express";
import * as v from "../lib/validate.js";
import { HttpError } from "../lib/http.js";
import {
  criarCarrinho,
  getCarrinho,
  adicionarItem,
  alterarQuantidade,
  editarItem,
  removerItem,
  limparCarrinho,
  aplicarCupom,
} from "./service.js";
import type { AdicionalSelecionado } from "./service.js";

export const cartRouter: Router = Router();

// POST /api/cart — cria carrinho e devolve cartKey
cartRouter.post("/", async (_req, res, next) => {
  try {
    const result = await criarCarrinho();
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/cart/:cartKey — retorna carrinho recalculado
cartRouter.get("/:cartKey", async (req, res, next) => {
  try {
    const data = await getCarrinho(req.params.cartKey);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/:cartKey/items — adiciona item
cartRouter.post("/:cartKey/items", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;

    const produtoId = v.intField(body.produtoId, "produtoId", {
      required: true,
      min: 1,
    }) as number;

    const variacaoId = v.intField(body.variacaoId, "variacaoId", { min: 1 });

    const quantidade = v.intField(body.quantidade, "quantidade", {
      required: true,
      min: 1,
    }) as number;

    const observacoes = v.nullString(body.observacoes, "observacoes");

    // Adicionais: [{adicionalId, quantidade}]
    let adicionaisSelecionados: AdicionalSelecionado[] = [];
    if (
      body.adicionaisSelecionados !== undefined &&
      body.adicionaisSelecionados !== null
    ) {
      if (!Array.isArray(body.adicionaisSelecionados)) {
        throw new HttpError(
          400,
          'Campo "adicionaisSelecionados" deve ser um array.',
        );
      }
      adicionaisSelecionados = (
        body.adicionaisSelecionados as unknown[]
      ).map((el, idx) => {
        const e = el as Record<string, unknown>;
        const adicionalId = v.intField(e.adicionalId, `adicionais[${idx}].adicionalId`, {
          required: true,
          min: 1,
        }) as number;
        const qtd = v.intField(e.quantidade, `adicionais[${idx}].quantidade`, {
          required: true,
          min: 1,
        }) as number;
        return { adicionalId, quantidade: qtd };
      });
    }

    const data = await adicionarItem(req.params.cartKey, {
      produtoId,
      variacaoId: variacaoId ?? null,
      quantidade,
      adicionaisSelecionados,
      observacoes,
    });

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cart/:cartKey/items/:itemId — altera quantidade
cartRouter.patch("/:cartKey/items/:itemId", async (req, res, next) => {
  try {
    const itemId = parseItemId(req.params.itemId);
    const body = req.body as Record<string, unknown>;
    const quantidade = v.intField(body.quantidade, "quantidade", {
      required: true,
      min: 1,
    }) as number;

    const data = await alterarQuantidade(
      req.params.cartKey,
      itemId,
      quantidade,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/cart/:cartKey/items/:itemId — edita adicionais/observações
cartRouter.put("/:cartKey/items/:itemId", async (req, res, next) => {
  try {
    const itemId = parseItemId(req.params.itemId);
    const body = req.body as Record<string, unknown>;

    const quantidade = v.intField(body.quantidade, "quantidade", { min: 1 });
    const observacoes =
      body.observacoes !== undefined
        ? v.nullString(body.observacoes, "observacoes")
        : undefined;

    let adicionaisSelecionados: AdicionalSelecionado[] | undefined;
    if (
      body.adicionaisSelecionados !== undefined &&
      body.adicionaisSelecionados !== null
    ) {
      if (!Array.isArray(body.adicionaisSelecionados)) {
        throw new HttpError(
          400,
          'Campo "adicionaisSelecionados" deve ser um array.',
        );
      }
      adicionaisSelecionados = (
        body.adicionaisSelecionados as unknown[]
      ).map((el, idx) => {
        const e = el as Record<string, unknown>;
        const adicionalId = v.intField(
          e.adicionalId,
          `adicionais[${idx}].adicionalId`,
          { required: true, min: 1 },
        ) as number;
        const qtd = v.intField(
          e.quantidade,
          `adicionais[${idx}].quantidade`,
          { required: true, min: 1 },
        ) as number;
        return { adicionalId, quantidade: qtd };
      });
    }

    const data = await editarItem(req.params.cartKey, itemId, {
      quantidade: quantidade ?? undefined,
      adicionaisSelecionados,
      observacoes,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/:cartKey/items/:itemId — remove item
cartRouter.delete("/:cartKey/items/:itemId", async (req, res, next) => {
  try {
    const itemId = parseItemId(req.params.itemId);
    const data = await removerItem(req.params.cartKey, itemId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/cart/:cartKey — limpa/esvazia carrinho
cartRouter.delete("/:cartKey", async (req, res, next) => {
  try {
    const data = await limparCarrinho(req.params.cartKey);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/cart/:cartKey/apply-coupon — aplica cupom
cartRouter.post("/:cartKey/apply-coupon", async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const codigo = v.text(body.cupom, "cupom", { required: true }) as string;
    const data = await aplicarCupom(req.params.cartKey, codigo);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseItemId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "itemId inválido.");
  }
  return id;
}

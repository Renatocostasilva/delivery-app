import { Router } from "express";
import { optionalQueryText, pagination } from "../lib/query.js";
import {
  listCategorias,
  listProdutos,
  getProduto,
  getHome,
} from "./service.js";

export const catalogRouter = Router();

catalogRouter.get("/categories", async (_req, res, next) => {
  try {
    const data = await listCategorias();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/products", async (req, res, next) => {
  try {
    const { page, pageSize } = pagination(req.query);
    const data = await listProdutos({
      busca: optionalQueryText(req.query.busca),
      categoriaId: req.query.categoriaId
        ? Number(req.query.categoriaId)
        : undefined,
      emDestaque:
        req.query.emDestaque === "true"
          ? true
          : req.query.emDestaque === "false"
            ? false
            : undefined,
      maisVendido:
        req.query.maisVendido === "true"
          ? true
          : req.query.maisVendido === "false"
            ? false
            : undefined,
      page,
      pageSize,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/products/:idOrSlug", async (req, res, next) => {
  try {
    const produto = await getProduto(req.params.idOrSlug);
    res.json(produto);
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/home", async (_req, res, next) => {
  try {
    const data = await getHome();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

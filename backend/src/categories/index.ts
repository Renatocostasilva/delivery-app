import { Router } from "express";
import { requireAuth } from "../admin/middleware.js";
import { parseIdParam } from "../lib/http.js";
import {
  optionalQueryBool,
  optionalQueryText,
  pagination,
} from "../lib/query.js";
import { booleanField, intField, text } from "../lib/validate.js";
import * as categoriaService from "./service.js";

export const categoriesAdminRouter: Router = Router();

categoriesAdminRouter.use(requireAuth);

categoriesAdminRouter.get("/", async (req, res) => {
  const { page, pageSize } = pagination(req.query);
  const result = await categoriaService.listCategorias({
    busca: optionalQueryText(req.query.busca),
    ativa: optionalQueryBool(req.query.ativa, "ativa"),
    page,
    pageSize,
  });
  res.json(result);
});

categoriesAdminRouter.get("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await categoriaService.getCategoria(id));
});

categoriesAdminRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const nome = text(body.nome, "nome", { required: true });
  const slug = body.slug !== undefined ? text(body.slug, "slug") : undefined;
  const ordem = body.ordem !== undefined ? intField(body.ordem, "ordem", { min: 0 }) : undefined;
  const ativa = body.ativa !== undefined ? booleanField(body.ativa, "ativa") : undefined;
  const categoria = await categoriaService.createCategoria({
    nome: nome!,
    slug,
    ordem,
    ativa,
  });
  res.status(201).json(categoria);
});

categoriesAdminRouter.patch("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const body = req.body ?? {};
  const nome = body.nome !== undefined ? text(body.nome, "nome", { required: true }) : undefined;
  const slug = body.slug !== undefined ? text(body.slug, "slug") : undefined;
  const ordem = body.ordem !== undefined ? intField(body.ordem, "ordem", { min: 0 }) : undefined;
  const ativa = body.ativa !== undefined ? booleanField(body.ativa, "ativa") : undefined;
  res.json(await categoriaService.updateCategoria(id, { nome, slug, ordem, ativa }));
});

categoriesAdminRouter.delete("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const result = await categoriaService.deleteCategoria(id);
  if (result.deleted) {
    res.status(204).end();
    return;
  }
  res.json({
    message: "Categoria em uso; foi inativada para preservar histórico.",
    ...result,
  });
});
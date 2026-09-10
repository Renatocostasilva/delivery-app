import { Router } from "express";
import { requireAuth } from "../admin/middleware.js";
import { parseIdParam } from "../lib/http.js";
import {
  optionalQueryBool,
  optionalQueryInt,
  optionalQueryText,
  pagination,
} from "../lib/query.js";
import { booleanField, intField, text } from "../lib/validate.js";
import {
  parseAdicionalInput,
  parseProdutoInput,
  parseVariacaoInput,
} from "./validation.js";
import * as produtoService from "./service.js";

export const productsAdminRouter: Router = Router();

productsAdminRouter.use(requireAuth);

productsAdminRouter.get("/", async (req, res) => {
  const { page, pageSize } = pagination(req.query);
  const result = await produtoService.listProdutos({
    busca: optionalQueryText(req.query.busca),
    categoriaId: optionalQueryInt(req.query.categoriaId, "categoriaId"),
    ativo: optionalQueryBool(req.query.ativo, "ativo"),
    emDestaque: optionalQueryBool(req.query.emDestaque, "emDestaque"),
    maisVendido: optionalQueryBool(req.query.maisVendido, "maisVendido"),
    comEstoque: optionalQueryBool(req.query.comEstoque, "comEstoque"),
    page,
    pageSize,
  });
  res.json(result);
});

productsAdminRouter.get("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await produtoService.getProduto(id));
});

productsAdminRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const data = parseProdutoInput(body, "create");
  const produto = await produtoService.createProduto(data, req.admin!.email);
  res.status(201).json(produto);
});

productsAdminRouter.patch("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const body = req.body ?? {};
  const data = parseProdutoInput(body, "update");
  res.json(await produtoService.updateProduto(id, data, req.admin!.email));
});

productsAdminRouter.delete("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  await produtoService.deleteProduto(id);
  res.status(204).end();
});

productsAdminRouter.get("/:productId/images", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  res.json(await produtoService.listImagens(productId));
});

productsAdminRouter.post("/:productId/images", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const body = req.body ?? {};
  const url = text(body.url, "url", { required: true });
  const ordem = body.ordem !== undefined ? intField(body.ordem, "ordem", { min: 0 }) : undefined;
  const principal = body.principal !== undefined ? booleanField(body.principal, "principal") : undefined;
  const imagem = await produtoService.addImagem(productId, {
    url: url!,
    ordem,
    principal,
  });
  res.status(201).json(imagem);
});

productsAdminRouter.patch("/:productId/images/:imageId", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const imageId = parseIdParam(req.params.imageId, "imageId");
  const body = req.body ?? {};
  const principal = body.principal !== undefined ? booleanField(body.principal, "principal") : undefined;
  const ordem = body.ordem !== undefined ? intField(body.ordem, "ordem", { min: 0 }) : undefined;
  res.json(await produtoService.updateImagem(productId, imageId, { principal, ordem }));
});

productsAdminRouter.delete("/:productId/images/:imageId", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const imageId = parseIdParam(req.params.imageId, "imageId");
  await produtoService.removeImagem(productId, imageId);
  res.status(204).end();
});

productsAdminRouter.get("/:productId/variacoes", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  res.json(await produtoService.listVariacoes(productId));
});

productsAdminRouter.post("/:productId/variacoes", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const body = req.body ?? {};
  const variacao = await produtoService.createVariacao(
    productId,
    parseVariacaoInput(body, "create"),
  );
  res.status(201).json(variacao);
});

productsAdminRouter.patch("/:productId/variacoes/:variacaoId", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const variacaoId = parseIdParam(req.params.variacaoId, "variacaoId");
  const body = req.body ?? {};
  res.json(
    await produtoService.updateVariacao(
      productId,
      variacaoId,
      parseVariacaoInput(body, "update"),
    ),
  );
});

productsAdminRouter.delete("/:productId/variacoes/:variacaoId", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const variacaoId = parseIdParam(req.params.variacaoId, "variacaoId");
  await produtoService.deleteVariacao(productId, variacaoId);
  res.status(204).end();
});

productsAdminRouter.get("/:productId/adicionais", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  res.json(await produtoService.listAdicionais(productId));
});

productsAdminRouter.post("/:productId/adicionais", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const body = req.body ?? {};
  const adicional = await produtoService.createAdicional(
    productId,
    parseAdicionalInput(body, "create"),
  );
  res.status(201).json(adicional);
});

productsAdminRouter.patch("/:productId/adicionais/:adicionalId", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const adicionalId = parseIdParam(req.params.adicionalId, "adicionalId");
  const body = req.body ?? {};
  res.json(
    await produtoService.updateAdicional(
      productId,
      adicionalId,
      parseAdicionalInput(body, "update"),
    ),
  );
});

productsAdminRouter.delete("/:productId/adicionais/:adicionalId", async (req, res) => {
  const productId = parseIdParam(req.params.productId);
  const adicionalId = parseIdParam(req.params.adicionalId, "adicionalId");
  await produtoService.deleteAdicional(productId, adicionalId);
  res.status(204).end();
});
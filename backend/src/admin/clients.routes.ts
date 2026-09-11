import { Router } from "express";
import { requireAuth } from "./middleware.js";
import { parseIdParam } from "../lib/http.js";
import {
  optionalQueryBool,
  optionalQueryText,
  pagination,
} from "../lib/query.js";
import { booleanField, nullString, text } from "../lib/validate.js";
import {
  createCliente,
  createEndereco,
  deleteCliente,
  deleteEndereco,
  getCliente,
  listClientes,
  listEnderecos,
  parseEnderecoUpdatesArray,
  parseEnderecosArray,
  updateCliente,
  updateEndereco,
} from "./clients.service.js";

export const clientsAdminRouter: Router = Router();

clientsAdminRouter.use(requireAuth);

// ─── GET / — listar clientes (paginação, busca e filtros) ───────────────────

clientsAdminRouter.get("/", async (req, res) => {
  const { page, pageSize } = pagination(req.query);
  const dataInicio = req.query.dataInicio
    ? new Date(String(req.query.dataInicio))
    : undefined;
  const dataFim = req.query.dataFim
    ? new Date(String(req.query.dataFim))
    : undefined;

  const result = await listClientes({
    busca: optionalQueryText(req.query.busca),
    ativo: optionalQueryBool(req.query.ativo, "ativo"),
    temPedidos: optionalQueryBool(req.query.temPedidos, "temPedidos"),
    dataInicio,
    dataFim,
    page,
    pageSize,
  });
  res.json(result);
});

// ─── GET /:id — detalhe (dados + endereços + pedidos + resumo) ──────────────

clientsAdminRouter.get("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await getCliente(id));
});

// ─── POST / — criar cliente (base única por telefone) ───────────────────────

clientsAdminRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const nome = text(body.nome, "nome", { required: true }) as string;
  const telefone = text(body.telefone, "telefone", { required: true }) as string;
  const email = body.email !== undefined ? nullString(body.email, "email") : undefined;
  const enderecos =
    body.enderecos !== undefined ? parseEnderecosArray(body.enderecos) : undefined;

  const cliente = await createCliente({ nome, telefone, email, enderecos });
  res.status(201).json(cliente);
});

// ─── PATCH /:id — atualizar cliente (campos + endereços aninhados) ──────────

clientsAdminRouter.patch("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const body = req.body ?? {};
  const nome =
    body.nome !== undefined ? (text(body.nome, "nome", { required: true }) as string) : undefined;
  const email = body.email !== undefined ? nullString(body.email, "email") : undefined;
  const ativo = body.ativo !== undefined ? booleanField(body.ativo, "ativo") : undefined;
  const enderecos =
    body.enderecos !== undefined
      ? parseEnderecoUpdatesArray(body.enderecos)
      : undefined;

  res.json(await updateCliente(id, { nome, email, ativo, enderecos }));
});

// ─── DELETE /:id — inativar cliente (soft delete) ───────────────────────────

clientsAdminRouter.delete("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  await deleteCliente(id);
  res.status(204).end();
});

// ─── Endereços aninhados ─────────────────────────────────────────────────────

clientsAdminRouter.get("/:id/enderecos", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await listEnderecos(id));
});

clientsAdminRouter.post("/:id/enderecos", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const body = req.body ?? {};
  const enderecos = parseEnderecosArray([body]);
  const endereco = await createEndereco(id, enderecos[0]);
  res.status(201).json(endereco);
});

clientsAdminRouter.patch("/:id/enderecos/:enderecoId", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const enderecoId = parseIdParam(req.params.enderecoId, "enderecoId");
  const body = req.body ?? {};

  const updates = parseEnderecoUpdatesArray([body]);
  const patch = updates[0];
  if (patch.remover === true) {
    await deleteEndereco(id, enderecoId);
    res.status(204).end();
    return;
  }
  res.json(await updateEndereco(id, enderecoId, patch));
});

clientsAdminRouter.delete("/:id/enderecos/:enderecoId", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const enderecoId = parseIdParam(req.params.enderecoId, "enderecoId");
  await deleteEndereco(id, enderecoId);
  res.status(204).end();
});
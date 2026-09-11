import { Router } from "express";
import { requireAuth } from "./middleware.js";
import { parseIdParam } from "../lib/http.js";
import { pagination, optionalQueryText } from "../lib/query.js";
import { text } from "../lib/validate.js";
import type { StatusPedido } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import * as ordersService from "./orders.service.js";

export const ordersAdminRouter: Router = Router();

ordersAdminRouter.use(requireAuth);

// ─── GET / — listar pedidos ──────────────────────────────────────────────────

ordersAdminRouter.get("/", async (req, res) => {
  const { page, pageSize } = pagination(req.query);
  const statusRaw = optionalQueryText(req.query.status);
  let status: StatusPedido | undefined;
  if (statusRaw) {
    const valid: StatusPedido[] = [
      "RECEBIDO", "AGUARDANDO_PAGAMENTO", "PAGAMENTO_APROVADO",
      "EM_PREPARACAO", "PRONTO", "SAIU_PARA_ENTREGA", "ENTREGUE",
      "CANCELADO", "RECUSADO", "FALHA_PAGAMENTO", "ESTORNADO",
    ];
    if (!valid.includes(statusRaw as StatusPedido)) {
      throw new HttpError(400, `Status inválido: ${statusRaw}.`);
    }
    status = statusRaw as StatusPedido;
  }
  const dataInicio = req.query.dataInicio ? new Date(String(req.query.dataInicio)) : undefined;
  const dataFim = req.query.dataFim ? new Date(String(req.query.dataFim)) : undefined;

  const result = await ordersService.listPedidos({
    status,
    busca: optionalQueryText(req.query.busca),
    dataInicio,
    dataFim,
    page,
    pageSize,
  });
  res.json(result);
});

// ─── GET /:id — buscar pedido por ID ────────────────────────────────────────

ordersAdminRouter.get("/:id", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await ordersService.getPedido(id));
});

// ─── PATCH /:id/status — atualizar status ───────────────────────────────────

ordersAdminRouter.patch("/:id/status", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const body = req.body ?? {};
  const novoStatus = text(body.status, "status", { required: true }) as StatusPedido;

  const valid: StatusPedido[] = [
    "RECEBIDO", "PAGAMENTO_APROVADO", "EM_PREPARACAO",
    "PRONTO", "SAIU_PARA_ENTREGA", "ENTREGUE", "CANCELADO",
  ];
  if (!valid.includes(novoStatus)) {
    throw new HttpError(400, `Status inválido: ${novoStatus}.`);
  }

  const observacao = body.observacao ? text(body.observacao, "observacao") : undefined;
  const adminId = req.admin!.id;

  res.json(
    await ordersService.atualizarStatusPedido(id, novoStatus, adminId, observacao),
  );
});

// ─── POST /:id/cancel — cancelar pedido ─────────────────────────────────────

ordersAdminRouter.post("/:id/cancel", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const body = req.body ?? {};
  const motivo = text(body.motivo, "motivo", { required: true }) as string;
  const adminId = req.admin!.id;

  res.json(await ordersService.cancelarPedido(id, adminId, motivo));
});

// ─── POST /:id/refund — estornar pedido ─────────────────────────────────────

ordersAdminRouter.post("/:id/refund", async (req, res) => {
  const id = parseIdParam(req.params.id);
  const body = req.body ?? {};
  const motivo = text(body.motivo, "motivo", { required: true }) as string;
  const adminId = req.admin!.id;

  res.json(await ordersService.estornarPedido(id, adminId, motivo));
});

// ─── GET /:id/receipt — reimprimir comprovante ──────────────────────────────

ordersAdminRouter.get("/:id/receipt", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await ordersService.reimprimirPedido(id));
});

// ─── GET /:id/history — histórico de status ─────────────────────────────────

ordersAdminRouter.get("/:id/history", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await ordersService.getHistorico(id));
});

// ─── GET /clients — listar clientes ──────────────────────────────────────────

ordersAdminRouter.get("/clients/list", async (req, res) => {
  const { page, pageSize } = pagination(req.query);
  const result = await ordersService.listClientes({
    busca: optionalQueryText(req.query.busca),
    page,
    pageSize,
  });
  res.json(result);
});

// ─── GET /:id/payments — pagamentos do pedido ───────────────────────────────

ordersAdminRouter.get("/:id/payments", async (req, res) => {
  const id = parseIdParam(req.params.id);
  res.json(await ordersService.getPagamentos(id));
});

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";
import { hashPassword } from "./password.js";

const ADMIN_EMAIL = "admin@delivery.local";
const ADMIN_SENHA = "admin123";

let token: string;
let clienteId: number;
let pedidoId: number;
let pedidoNumero: string;

beforeAll(async () => {
  await resetDatabase();

  await prisma.adminUser.create({
    data: {
      email: ADMIN_EMAIL,
      senhaHash: await hashPassword(ADMIN_SENHA),
      nome: "Administrador Teste",
    },
  });

  const cliente = await prisma.cliente.create({
    data: {
      nome: "Cliente Teste",
      telefone: "+5511999998888",
      email: "cliente@teste.com",
    },
  });
  clienteId = cliente.id;

  const cat = await prisma.categoria.create({
    data: { nome: "Testes", slug: "testes" },
  });

  const produto = await prisma.produto.create({
    data: {
      nome: "Bolo Teste",
      sku: "BOL-001",
      categoriaId: cat.id,
      precoVenda: 25.5,
    },
  });

  const pedido = await prisma.pedido.create({
    data: {
      numeroPedido: "PED-20260911-TEST01",
      clienteId,
      statusPedido: "RECEBIDO",
      statusPagamento: "PENDENTE",
      tipoEntrega: "RETIRADA",
      total: 25.5,
      totalProdutos: 25.5,
    },
  });
  pedidoId = pedido.id;
  pedidoNumero = pedido.numeroPedido;

  await prisma.itemPedido.create({
    data: {
      pedidoId,
      produtoId: produto.id,
      produtoNome: "Bolo Teste",
      quantidade: 1,
      precoUnitario: 25.5,
      total: 25.5,
    },
  });

  await prisma.pagamento.create({
    data: {
      pedidoId,
      gateway: "fake",
      valor: 25.5,
      estadoPagamento: "PENDENTE",
      idempotencyKey: "test-key-001",
    },
  });
});

beforeEach(async () => {
  const res = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });
  token = res.body.token;
});

// ─── Auth ────────────────────────────────────────────────────────────────────

describe("admin orders — autenticação", () => {
  it("rejeita acesso sem token", async () => {
    const res = await request(app).get("/api/admin/orders");
    expect(res.status).toBe(401);
  });

  it("rejeita token inválido", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", "Bearer invalido");
    expect(res.status).toBe(401);
  });
});

// ─── Listar pedidos ──────────────────────────────────────────────────────────

describe("GET /api/admin/orders", () => {
  it("retorna lista de pedidos com paginação", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.page).toBe(1);
  });

  it("filtra por status", async () => {
    const res = await request(app)
      .get("/api/admin/orders?status=RECEBIDO")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((p: { statusPedido: string }) => p.statusPedido === "RECEBIDO")).toBe(true);
  });

  it("rejeita status inválido", async () => {
    const res = await request(app)
      .get("/api/admin/orders?status=INVALIDO")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("filtra por busca (nome do cliente)", async () => {
    const res = await request(app)
      .get("/api/admin/orders?busca=Cliente")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Buscar pedido por ID ────────────────────────────────────────────────────

describe("GET /api/admin/orders/:id", () => {
  it("retorna pedido com todas as relações", async () => {
    const res = await request(app)
      .get(`/api/admin/orders/${pedidoId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(pedidoId);
    expect(res.body.numeroPedido).toBe(pedidoNumero);
    expect(res.body.cliente).toBeDefined();
    expect(res.body.itens).toBeInstanceOf(Array);
    expect(res.body.pagamentos).toBeInstanceOf(Array);
    expect(res.body.historico).toBeInstanceOf(Array);
  });

  it("retorna 404 para pedido inexistente", async () => {
    const res = await request(app)
      .get("/api/admin/orders/99999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── Atualizar status ────────────────────────────────────────────────────────

describe("PATCH /api/admin/orders/:id/status", () => {
  beforeEach(async () => {
    // Reseta o pedido para RECEBIDO antes de cada teste de status
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { statusPedido: "RECEBIDO", statusPagamento: "PENDENTE" },
    });
    await prisma.statusHistorico.deleteMany({ where: { pedidoId } });
  });

  it("transição válida: RECEBIDO → PAGAMENTO_APROVADO", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PAGAMENTO_APROVADO" });
    expect(res.status).toBe(200);
    expect(res.body.statusPedido).toBe("PAGAMENTO_APROVADO");
    expect(res.body.historico.length).toBe(1);
    expect(res.body.historico[0].de).toBe("RECEBIDO");
    expect(res.body.historico[0].para).toBe("PAGAMENTO_APROVADO");
  });

  it("transição válida: RECEBIDO → EM_PREPARACAO", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "EM_PREPARACAO" });
    expect(res.status).toBe(200);
    expect(res.body.statusPedido).toBe("EM_PREPARACAO");
  });

  it("transição inválida: RECEBIDO → ENTREGUE", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "ENTREGUE" });
    expect(res.status).toBe(409);
  });

  it("status inválido no body", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "STATUS_INVALIDO" });
    expect(res.status).toBe(400);
  });

  it("status obrigatório", async () => {
    const res = await request(app)
      .patch(`/api/admin/orders/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("transição em cadeia: RECEBIDO → EM_PREPARACAO → PRONTO", async () => {
    await request(app)
      .patch(`/api/admin/orders/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "EM_PREPARACAO" });

    const res = await request(app)
      .patch(`/api/admin/orders/${pedidoId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "PRONTO" });
    expect(res.status).toBe(200);
    expect(res.body.statusPedido).toBe("PRONTO");
    expect(res.body.historico.length).toBe(2);
  });
});

// ─── Cancelar pedido ────────────────────────────────────────────────────────

describe("POST /api/admin/orders/:id/cancel", () => {
  beforeEach(async () => {
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { statusPedido: "RECEBIDO", statusPagamento: "PENDENTE" },
    });
    await prisma.statusHistorico.deleteMany({ where: { pedidoId } });
  });

  it("cancela pedido RECEBIDO com motivo", async () => {
    const res = await request(app)
      .post(`/api/admin/orders/${pedidoId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "Cliente desistiu" });
    expect(res.status).toBe(200);
    expect(res.body.statusPedido).toBe("CANCELADO");
  });

  it("exige motivo", async () => {
    const res = await request(app)
      .post(`/api/admin/orders/${pedidoId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("não cancela pedido ENTREGUE", async () => {
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { statusPedido: "ENTREGUE" },
    });
    const res = await request(app)
      .post(`/api/admin/orders/${pedidoId}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "Teste" });
    expect(res.status).toBe(409);
  });
});

// ─── Estornar pedido ────────────────────────────────────────────────────────

describe("POST /api/admin/orders/:id/refund", () => {
  beforeEach(async () => {
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { statusPedido: "PAGAMENTO_APROVADO", statusPagamento: "APROVADO" },
    });
    await prisma.pagamento.updateMany({
      where: { pedidoId },
      data: { estadoPagamento: "APROVADO" },
    });
    await prisma.statusHistorico.deleteMany({ where: { pedidoId } });
  });

  it("estorna pedido com pagamento aprovado", async () => {
    const res = await request(app)
      .post(`/api/admin/orders/${pedidoId}/refund`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "Produto com defeito" });
    expect(res.status).toBe(200);
    expect(res.body.statusPedido).toBe("ESTORNADO");
    expect(res.body.statusPagamento).toBe("ESTORNADO");
  });

  it("não estorna pedido sem pagamento aprovado", async () => {
    await prisma.pedido.update({
      where: { id: pedidoId },
      data: { statusPagamento: "PENDENTE" },
    });
    await prisma.pagamento.updateMany({
      where: { pedidoId },
      data: { estadoPagamento: "PENDENTE" },
    });
    const res = await request(app)
      .post(`/api/admin/orders/${pedidoId}/refund`)
      .set("Authorization", `Bearer ${token}`)
      .send({ motivo: "Teste" });
    expect(res.status).toBe(409);
  });
});

// ─── Reimprimir comprovante ─────────────────────────────────────────────────

describe("GET /api/admin/orders/:id/receipt", () => {
  it("retorna dados do comprovante", async () => {
    const res = await request(app)
      .get(`/api/admin/orders/${pedidoId}/receipt`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.numeroPedido).toBe(pedidoNumero);
    expect(res.body.itens).toBeInstanceOf(Array);
    expect(res.body.total).toBeDefined();
    expect(res.body.cliente).toBeDefined();
  });
});

// ─── Histórico de status ─────────────────────────────────────────────────────

describe("GET /api/admin/orders/:id/history", () => {
  it("retorna histórico do pedido", async () => {
    const res = await request(app)
      .get(`/api/admin/orders/${pedidoId}/history`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});

// ─── Clientes admin ──────────────────────────────────────────────────────────

describe("GET /api/admin/orders/clients/list", () => {
  it("retorna lista de clientes", async () => {
    const res = await request(app)
      .get("/api/admin/orders/clients/list")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it("filtra por busca", async () => {
    const res = await request(app)
      .get("/api/admin/orders/clients/list?busca=Cliente")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Pagamentos admin ────────────────────────────────────────────────────────

describe("GET /api/admin/orders/:id/payments", () => {
  it("retorna pagamentos do pedido", async () => {
    const res = await request(app)
      .get(`/api/admin/orders/${pedidoId}/payments`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Dashboard ───────────────────────────────────────────────────────────────

describe("GET /api/admin/dashboard", () => {
  it("retorna dados do dashboard", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.resumo).toBeDefined();
    expect(res.body.resumo.totalPedidos).toBeGreaterThanOrEqual(1);
    expect(res.body.pedidosPorStatus).toBeDefined();
    expect(res.body.topProdutos).toBeInstanceOf(Array);
    expect(res.body.pedidosRecentes).toBeInstanceOf(Array);
  });

  it("filtra por período", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard?dataInicio=2026-01-01&dataFim=2026-12-31")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.resumo).toBeDefined();
  });

  it("rejeita acesso sem token", async () => {
    const res = await request(app).get("/api/admin/dashboard");
    expect(res.status).toBe(401);
  });
});

/**
 * payments/payments.test.ts — REN-13
 *
 * Testes de integração (supertest) para os endpoints de pagamento:
 *   - Fluxo PIX: criação → status PENDENTE → QR code retornado
 *   - Fluxo cartão: criação → aprovado/recusado → pedido atualizado
 *   - Idempotência: repetir cobrança retorna a existente (sem duplicar)
 *   - Webhook: confirmação via notificação → status sincronizado
 *   - Consulta: GET com ?sync=true → sincroniza com o gateway
 *   - Erros: timeout → 503, transição inválida → ignorado, gateway ausente → 503
 *   - Máquina de estados: proibição de regressão APROVADO → RECUSADO
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";
import { setGateway, clearGateway, GatewayError } from "./gateway.js";
import { FakeGateway } from "../../test/fake-gateway.js";

let fake: FakeGateway;

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(async () => {
  fake = new FakeGateway();
  setGateway(fake);
  await resetDatabase();
});

afterAll(() => {
  clearGateway();
});

// Helper: cria cliente + pedido AGUARDANDO_PAGAMENTO + Pagamento INICIADO
async function seedPedido(overrides?: {
  idempotencyKey?: string;
  estadoPagamento?: string;
  idGateway?: string;
  emailCliente?: string | null;
}) {
  const cliente = await prisma.cliente.create({
    data: {
      nome: "Cliente MP",
      telefone: "+5511999999999",
      email: overrides?.emailCliente ?? "mp@teste.com",
    },
  });

  const pedido = await prisma.pedido.create({
    data: {
      clienteId: cliente.id,
      numeroPedido: `PED-MP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      statusPedido: "AGUARDANDO_PAGAMENTO",
      statusPagamento: "INICIADO",
      tipoEntrega: "RETIRADA",
      totalProdutos: 100,
      total: 100,
      pagamentos: {
        create: {
          gateway: "mercadopago",
          valor: 100,
          idempotencyKey: overrides?.idempotencyKey ?? `idem-${Date.now()}`,
          estadoPagamento: overrides?.estadoPagamento ?? "INICIADO",
          ...(overrides?.idGateway ? { idGateway: overrides.idGateway } : {}),
        },
      },
    },
    include: { pagamentos: true, cliente: true },
  });

  return { cliente, pedido, pagamento: pedido.pagamentos[0] };
}

describe("POST /api/payments/:pedidoId/cobrancas — PIX", () => {
  it("cria cobrança PIX e retorna QR code", async () => {
    const { pedido } = await seedPedido();

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix", email: "pix@teste.com" })
      .expect(201);

    expect(res.body.criada).toBe(true);
    expect(res.body.pagamento.estadoPagamento).toBe("PENDENTE");
    expect(res.body.pagamento.qrCode).toContain("PIX-");
    expect(res.body.pagamento.qrCodeBase64).toContain("base64-qr-");
    expect(res.body.pedido.statusPedido).toBe("AGUARDANDO_PAGAMENTO");
    expect(res.body.pedido.statusPagamento).toBe("PENDENTE");
    expect(res.body.pagamento.idGateway).toBeTruthy();
  });

  it("rejeita pedido que não está AGUARDANDO_PAGAMENTO", async () => {
    const { pedido } = await seedPedido({ estadoPagamento: "APROVADO" });
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { statusPedido: "PAGAMENTO_APROVADO" },
    });

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix", email: "pix@teste.com" })
      .expect(409);

    expect(res.body.error).toContain("não aceita nova cobrança");
  });

  it("rejeita pagamento já concluído (APROVADO)", async () => {
    const { pedido, pagamento } = await seedPedido({ idGateway: "999" });
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { estadoPagamento: "APROVADO" },
    });
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { statusPagamento: "APROVADO", statusPedido: "PAGAMENTO_APROVADO" },
    });

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix", email: "pix@teste.com" })
      .expect(409);

    expect(res.body.error).toContain("não aceita nova cobrança");
  });

  it("idempotente: retorna existente quando cobrança já foi criada e está PENDENTE", async () => {
    const { pedido } = await seedPedido();

    // 1ª chamada: cria a cobrança
    const r1 = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix" })
      .expect(201);
    expect(r1.body.criada).toBe(true);

    // 2ª chamada: devolve a existente (não duplica no provedor)
    const r2 = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix" })
      .expect(200);
    expect(r2.body.criada).toBe(false);
    expect(r2.body.pagamento.idGateway).toBe(r1.body.pagamento.idGateway);
  });
});

describe("POST /api/payments/:pedidoId/cobrancas — Cartão", () => {
  it("cria cobrança cartão e retorna status APROVADO", async () => {
    fake.updateConfig({ cartaoStatus: "APROVADO" });
    const { pedido } = await seedPedido();

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({
        metodo: "cartao",
        token: "fake-token-visa",
        paymentMethodId: "visa",
      })
      .expect(201);

    expect(res.body.criada).toBe(true);
    expect(res.body.pagamento.estadoPagamento).toBe("APROVADO");
    expect(res.body.pedido.statusPagamento).toBe("APROVADO");
    expect(res.body.pedido.statusPedido).toBe("PAGAMENTO_APROVADO");
  });

  it("cria cobrança cartão recusado e atualiza pedido RECUSADO", async () => {
    fake.updateConfig({ cartaoStatus: "RECUSADO" });
    const { pedido } = await seedPedido();

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({
        metodo: "cartao",
        token: "fake-token-visa",
        paymentMethodId: "visa",
      })
      .expect(201);

    expect(res.body.criada).toBe(true);
    expect(res.body.pagamento.estadoPagamento).toBe("RECUSADO");
    expect(res.body.pedido.statusPagamento).toBe("RECUSADO");
    expect(res.body.pedido.statusPedido).toBe("RECUSADO");
  });

  it("exige token + paymentMethodId para cartão", async () => {
    const { pedido } = await seedPedido();

    await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "cartao" })
      .expect(400);
  });
});

describe("POST /api/payments/webhooks/mercadopago", () => {
  it("processa notificação e sincroniza status via consulta ao gateway", async () => {
    const { pedido, pagamento } = await seedPedido({ idGateway: "2001" });
    // Simula que o gateway agora retorna APROVADO para esse idGateway
    fake.setStatus("2001", "APROVADO");

    const res = await request(app)
      .post("/api/payments/webhooks/mercadopago")
      .send({ data: { id: 2001 }, type: "payment" })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.processado).toBe(true);
    expect(res.body.estado).toBe("APROVADO");

    // Verifica que o pedido foi atualizado no banco
    const pedidoAtualizado = await prisma.pedido.findUniqueOrThrow({
      where: { id: pedido.id },
    });
    expect(pedidoAtualizado.statusPagamento).toBe("APROVADO");
    expect(pedidoAtualizado.statusPedido).toBe("PAGAMENTO_APROVADO");

    const pagamentoAtualizado = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamento.id },
    });
    expect(pagamentoAtualizado.estadoPagamento).toBe("APROVADO");
  });

  it("retorna processado:false quando body não contém id", async () => {
    const res = await request(app)
      .post("/api/payments/webhooks/mercadopago")
      .send({ tipo: "unknown" })
      .expect(200);

    expect(res.body.processado).toBe(false);
  });

  it("ignora transição inválida (APROVADO → RECUSADO) e retorna ignorado:true", async () => {
    const { pagamento } = await seedPedido({
      idGateway: "3001",
      estadoPagamento: "APROVADO",
    });
    await prisma.pedido.update({
      where: { id: pagamento.pedidoId },
      data: { statusPagamento: "APROVADO", statusPedido: "PAGAMENTO_APROVADO" },
    });
    // Gateway diz que está RECUSADO (cenário impossível, mas webhook atrasado)
    fake.setStatus("3001", "RECUSADO");

    const res = await request(app)
      .post("/api/payments/webhooks/mercadopago")
      .send({ data: { id: 3001 }, type: "payment" })
      .expect(200);

    expect(res.body.processado).toBe(true);
    expect(res.body.ignorado).toBe(true);

    // Pedido NÃO deve ter regredido
    const pedido = await prisma.pedido.findUniqueOrThrow({
      where: { id: pagamento.pedidoId },
    });
    expect(pedido.statusPagamento).toBe("APROVADO");
    expect(pedido.statusPedido).toBe("PAGAMENTO_APROVADO");
  });

  it("ignora notificação de pagamento desconhecido (sem registro no banco)", async () => {
    const res = await request(app)
      .post("/api/payments/webhooks/mercadopago")
      .send({ data: { id: 999999 }, type: "payment" })
      .expect(200);

    expect(res.body.processado).toBe(true);
    expect(res.body.ignorado).toBe(true);
  });
});

describe("GET /api/payments/:pedidoId", () => {
  it("retorna status local do pagamento", async () => {
    const { pedido, pagamento } = await seedPedido();

    const res = await request(app)
      .get(`/api/payments/${pedido.id}`)
      .expect(200);

    expect(res.body.pagamento.estadoPagamento).toBe("INICIADO");
    expect(res.body.pagamento.id).toBe(pagamento.id);
  });

  it("com ?sync=true sincroniza com o gateway", async () => {
    const { pedido } = await seedPedido({ idGateway: "4001" });
    fake.setStatus("4001", "APROVADO");

    const res = await request(app)
      .get(`/api/payments/${pedido.id}?sync=true`)
      .expect(200);

    expect(res.body.sincronizado).toBe(true);
    expect(res.body.pagamento.estadoPagamento).toBe("APROVADO");
    expect(res.body.pedido.statusPagamento).toBe("APROVADO");
    expect(res.body.pedido.statusPedido).toBe("PAGAMENTO_APROVADO");
  });

  it("com ?sync=false retorna dados locais (sem consultar gateway)", async () => {
    const { pedido } = await seedPedido({ idGateway: "5001" });

    const res = await request(app)
      .get(`/api/payments/${pedido.id}`)
      .expect(200);

    expect(res.body.sincronizado).toBe(false);
    expect(res.body.pagamento.estadoPagamento).toBe("INICIADO");
  });

  it("retorna 404 para pedido inexistente", async () => {
    await request(app).get("/api/payments/999999").expect(404);
  });
});

describe("Erros e timeout", () => {
  it("timeout no gateway retorna 503", async () => {
    fake.updateConfig({
      criarPixErro: new GatewayError("Timeout ao chamar o MercadoPago.", true),
    });
    const { pedido } = await seedPedido();

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix" })
      .expect(503);

    expect(res.body.error).toContain("gateway");
  });

  it("erro não-retriable do gateway retorna 502", async () => {
    fake.updateConfig({
      criarPixErro: new GatewayError("Bad Request", false, 400),
    });
    const { pedido } = await seedPedido();

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix" })
      .expect(502);

    expect(res.body.error).toContain("gateway");
  });

  it("regista falha no pagamento sem derrubar o estado", async () => {
    fake.updateConfig({ criarPixErro: new GatewayError("Timeout", true) });
    const { pedido, pagamento } = await seedPedido();

    await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix" })
      .expect(503);

    const atualizado = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamento.id },
    });
    expect(atualizado.estadoPagamento).toBe("INICIADO");
    expect(atualizado.tentativas).toBe(1);
    expect(atualizado.ultimoErroGateway).toContain("Timeout");
  });

  it("gateway não configurado retorna 503", async () => {
    clearGateway();
    const { pedido } = await seedPedido();

    await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "pix" })
      .expect(503);

    // Restaura o gateway para outros testes
    setGateway(fake);
  });
});

describe("Máquina de estados — transições", () => {
  it("permite retry após recusa: criação de NOVA cobrança", async () => {
    // Cria com cartão recusado
    fake.updateConfig({ cartaoStatus: "RECUSADO" });
    const { pedido, pagamento } = await seedPedido();

    await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "cartao", token: "tok1", paymentMethodId: "visa" })
      .expect(201);

    const aposRecusa = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamento.id },
    });
    expect(aposRecusa.estadoPagamento).toBe("RECUSADO");
    expect(aposRecusa.idGateway).toBeTruthy();

    // Agora recria a cobrança (recusa terminal com idGateway → permite retry)
    fake.updateConfig({
      cartaoStatus: "APROVADO",
      statusPorId: undefined, // limpa qualquer mock anterior
    });

    const res = await request(app)
      .post(`/api/payments/${pedido.id}/cobrancas`)
      .send({ metodo: "cartao", token: "tok2", paymentMethodId: "visa" })
      .expect(201);

    expect(res.body.criada).toBe(true);
    expect(res.body.pagamento.estadoPagamento).toBe("APROVADO");
    expect(res.body.pedido.statusPedido).toBe("PAGAMENTO_APROVADO");
  });

  it("permite INICIADO → EXPIRADO via webhook", async () => {
    const { pedido, pagamento } = await seedPedido({ idGateway: "6001" });
    fake.setStatus("6001", "EXPIRADO");

    await request(app)
      .post("/api/payments/webhooks/mercadopago")
      .send({ data: { id: 6001 }, type: "payment" })
      .expect(200);

    const atualizado = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamento.id },
    });
    expect(atualizado.estadoPagamento).toBe("EXPIRADO");

    const pedidoAtualizado = await prisma.pedido.findUniqueOrThrow({
      where: { id: pedido.id },
    });
    expect(pedidoAtualizado.statusPedido).toBe("CANCELADO");
  });

  it("ESTORNADO é terminal — webhook com EXPIRADO é ignorado", async () => {
    const { pedido, pagamento } = await seedPedido({ idGateway: "7001" });
    await prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { estadoPagamento: "ESTORNADO" },
    });
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { statusPagamento: "ESTORNADO", statusPedido: "ESTORNADO" },
    });

    fake.setStatus("7001", "EXPIRADO");

    const res = await request(app)
      .post("/api/payments/webhooks/mercadopago")
      .send({ data: { id: 7001 }, type: "payment" })
      .expect(200);

    expect(res.body.ignorado).toBe(true);

    const atualizado = await prisma.pagamento.findUniqueOrThrow({
      where: { id: pagamento.id },
    });
    expect(atualizado.estadoPagamento).toBe("ESTORNADO");
  });
});
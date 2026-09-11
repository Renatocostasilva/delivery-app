/**
 * orders/checkout.test.ts — REN-12
 *
 * Testes de integração (supertest) do checkout em etapas e criação de pedido.
 * Banco isolado: test.db (definido no vitest.config.ts).
 */

import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";
import { TAXA_ENTREGA } from "../cart/service.js";

// ─── Seed local ───────────────────────────────────────────────────────────────

let catId: number;
let produtoSimples: { id: number; precoVenda: Prisma.Decimal };
let produtoComVariacao: { id: number };
let variacaoId: number;
let adicionalId: number;

beforeAll(async () => {
  await resetDatabase();

  const cat = await prisma.categoria.create({
    data: { nome: "Bolos Checkout", slug: "bolos-checkout", ordem: 1, ativa: true },
  });
  catId = cat.id;

  produtoSimples = await prisma.produto.create({
    data: {
      nome: "Bolo Simples",
      sku: "CHECK-SIMPLES",
      categoriaId: catId,
      ativo: true,
      disponivel: true,
      precoVenda: new Prisma.Decimal("50.00"),
    },
  });

  const pv = await prisma.produto.create({
    data: {
      nome: "Bolo Especial",
      sku: "CHECK-ESP",
      categoriaId: catId,
      ativo: true,
      disponivel: true,
      precoVenda: new Prisma.Decimal("80.00"),
    },
  });
  produtoComVariacao = pv;

  const variacao = await prisma.variacao.create({
    data: {
      produtoId: pv.id,
      nome: "Médio (3kg)",
      precoAdicional: new Prisma.Decimal("15.00"),
      ativo: true,
      ordem: 1,
    },
  });
  variacaoId = variacao.id;

  const adicional = await prisma.adicional.create({
    data: {
      produtoId: pv.id,
      nome: "Chocolate Extra",
      precoAdicional: new Prisma.Decimal("5.00"),
      obrigatorio: false,
      quantidadeMinima: 0,
      quantidadeMaxima: 3,
      ativo: true,
      ordem: 1,
    },
  });
  adicionalId = adicional.id;
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function criarCarrinho(): Promise<string> {
  const res = await request(app).post("/api/cart");
  expect(res.status).toBe(201);
  return (res.body as { cartKey: string }).cartKey;
}

async function criarCarrinhoComItem(): Promise<{ cartKey: string; subtotal: number }> {
  const cartKey = await criarCarrinho();
  const add = await request(app)
    .post(`/api/cart/${cartKey}/items`)
    .send({ produtoId: produtoSimples.id, quantidade: 2 });
  expect(add.status).toBe(201);
  return {
    cartKey,
    subtotal: Number(add.body.subtotalProdutos), // 100
  };
}

const ENDERECO_VALIDO = {
  logradouro: "Rua das Flores",
  numero: "123",
  complemento: "Apto 45",
  bairro: "Centro",
  cidade: "São Paulo",
  cep: "01001-000",
  referencia: "Próximo à praça",
};

const idempotencia = () =>
  `idem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

// ─── Etapa 1: POST /api/checkout/identify ─────────────────────────────────────

describe("POST /api/checkout/identify", () => {
  it("persiste cliente com telefone normalizado e retorna", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/identify").send({
      cartKey,
      nome: "Renato Teste",
      telefone: "(11) 99999-8888",
    });

    expect(res.status).toBe(200);
    expect(res.body.cliente.nome).toBe("Renato Teste");
    expect(res.body.cliente.telefone).toBe("+5511999998888");
  });

  it("reusa cliente existente pelo telefone (base única)", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    await request(app).post("/api/checkout/identify").send({
      cartKey,
      nome: "Primeiro Nome",
      telefone: "11988887777",
    });

    // Segundo checkout com o mesmo telefone e nome diferente → mesmo cliente
    const { cartKey: cartKey2 } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/identify").send({
      cartKey: cartKey2,
      nome: "Nome Atualizado",
      telefone: "+5511988887777",
    });

    expect(res.status).toBe(200);
    expect(res.body.cliente.telefone).toBe("+5511988887777");
    expect(res.body.cliente.nome).toBe("Nome Atualizado");
    // Não deve ter criado duplicado
    const count = await prisma.cliente.count({
      where: { telefone: "+5511988887777" },
    });
    expect(count).toBe(1);
  });

  it("rejeita telefone inválido (poucos dígitos)", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/identify").send({
      cartKey,
      nome: "Sem Telefone",
      telefone: "119999",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Telefone inválido/);
  });

  it("rejeita celular com 11 dígitos que não começa em 9", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/identify").send({
      cartKey,
      nome: "Fixo",
      telefone: "11000000000",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Telefone inválido/);
  });

  it("rejeita carrinho inexistente", async () => {
    const res = await request(app).post("/api/checkout/identify").send({
      cartKey: "00000000-0000-0000-0000-000000000000",
      nome: "Ninguem",
      telefone: "+5511999998888",
    });
    expect(res.status).toBe(404);
  });

  it("rejeita carrinho vazio", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app).post("/api/checkout/identify").send({
      cartKey,
      nome: "Vazio",
      telefone: "+5511999998888",
    });
    expect(res.status).toBe(422);
  });
});

// ─── Etapa 2: POST /api/checkout/delivery ─────────────────────────────────────

describe("POST /api/checkout/delivery", () => {
  it("aceita retirada sem endereço com taxa zero", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/delivery").send({
      cartKey,
      tipoEntrega: "RETIRADA",
    });

    expect(res.status).toBe(200);
    expect(res.body.tipoEntrega).toBe("RETIRADA");
    expect(res.body.endereco).toBeNull();
    expect(Number(res.body.taxaEntrega)).toBe(0);
  });

  it("aceita entrega com endereço e taxa fixa", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/delivery").send({
      cartKey,
      tipoEntrega: "ENTREGA",
      endereco: ENDERECO_VALIDO,
    });

    expect(res.status).toBe(200);
    expect(res.body.tipoEntrega).toBe("ENTREGA");
    expect(res.body.endereco.cep).toBe("01001000");
    expect(Number(res.body.taxaEntrega)).toBeCloseTo(
      TAXA_ENTREGA.toNumber(),
      2,
    );
  });

  it("rejeita entrega sem endereço", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/delivery").send({
      cartKey,
      tipoEntrega: "ENTREGA",
    });
    expect(res.status).toBe(400);
  });

  it("rejeita retirada com endereço informado", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/delivery").send({
      cartKey,
      tipoEntrega: "RETIRADA",
      endereco: ENDERECO_VALIDO,
    });
    expect(res.status).toBe(400);
  });

  it("rejeita endereço inválido (campos obrigatórios faltando)", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/delivery").send({
      cartKey,
      tipoEntrega: "ENTREGA",
      endereco: { logradouro: "Rua X" },
    });
    expect(res.status).toBe(400);
  });

  it("rejeita CEP inválido", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/delivery").send({
      cartKey,
      tipoEntrega: "ENTREGA",
      endereco: { ...ENDERECO_VALIDO, cep: "12345" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/CEP/);
  });

  it("rejeita tipoEntrega inválido", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/delivery").send({
      cartKey,
      tipoEntrega: "PAD",
    });
    expect(res.status).toBe(400);
  });
});

// ─── Etapa 3: POST /api/checkout/summary ──────────────────────────────────────

describe("POST /api/checkout/summary", () => {
  it("recalcula total para retirada (taxa zero)", async () => {
    const { cartKey, subtotal } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/summary").send({
      cartKey,
      tipoEntrega: "RETIRADA",
    });

    expect(res.status).toBe(200);
    expect(Number(res.body.subtotalProdutos)).toBe(subtotal);
    expect(Number(res.body.taxaEntrega)).toBe(0);
    expect(Number(res.body.total)).toBeCloseTo(subtotal, 2);
    expect(res.body.itens).toHaveLength(1);
  });

  it("recalcula total para entrega (taxa fixa)", async () => {
    const { cartKey, subtotal } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/summary").send({
      cartKey,
      tipoEntrega: "ENTREGA",
    });

    expect(Number(res.body.taxaEntrega)).toBeCloseTo(
      TAXA_ENTREGA.toNumber(),
      2,
    );
    expect(Number(res.body.total)).toBeCloseTo(
      subtotal + TAXA_ENTREGA.toNumber(),
      2,
    );
  });

  it("recalcula total com cupom de desconto", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    await prisma.cupom.create({
      data: {
        codigo: "CHECK20",
        tipo: "PORCENTAGEM",
        valor: new Prisma.Decimal("20"),
        ativo: true,
      },
    });
    await request(app).post(`/api/cart/${cartKey}/apply-coupon`).send({
      cupom: "CHECK20",
    });

    const res = await request(app).post("/api/checkout/summary").send({
      cartKey,
      tipoEntrega: "RETIRADA",
    });

    expect(res.status).toBe(200);
    expect(Number(res.body.desconto)).toBe(20); // 20% de 100
    expect(Number(res.body.total)).toBeCloseTo(80, 2);
  });

  it("rejeita carrinho vazio", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app).post("/api/checkout/summary").send({
      cartKey,
      tipoEntrega: "RETIRADA",
    });
    expect(res.status).toBe(422);
  });
});

// ─── Etapa 4: POST /api/checkout/confirm ──────────────────────────────────────

describe("POST /api/checkout/confirm", () => {
  it("cria pedido RETIRADA com estado AGUARDANDO_PAGAMENTO + pagamento INICIADO", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, variacaoId, quantidade: 1 });
    const addRes = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({
        produtoId: produtoComVariacao.id,
        variacaoId,
        quantidade: 1,
        adicionaisSelecionados: [{ adicionalId, quantidade: 2 }],
      });
    expect(addRes.status).toBe(201);

    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "Maria Silva",
      telefone: "+5511987654321",
      tipoEntrega: "RETIRADA",
    });

    expect(res.status).toBe(201);
    expect(res.body.numeroPedido).toMatch(/^PED-\d{8}-[A-Z0-9]{5}$/);
    expect(res.body.statusPedido).toBe("AGUARDANDO_PAGAMENTO");
    expect(res.body.tipoEntrega).toBe("RETIRADA");
    expect(res.body.enderecoSnapshot).toBeNull();
    expect(res.body.cliente.telefone).toBe("+5511987654321");

    // Total: (80 + 15) × 2 + (5 × 2) = 200
    expect(Number(res.body.totalProdutos)).toBe(200);
    expect(Number(res.body.total)).toBe(200);
    expect(Number(res.body.taxasEntrega)).toBe(0);

    // Itens snapshot
    expect(res.body.itens).toHaveLength(2);
    const item = res.body.itens[1];
    expect(item.produtoNome).toBe("Bolo Especial");
    expect(item.variacaoNome).toBe("Médio (3kg)");
    expect(Number(item.precoUnitario)).toBe(95); // 80 + 15
    expect(item.adicionais).toEqual([
      { nome: "Chocolate Extra", preco: 5, quantidade: 2 },
    ]);
    expect(Number(item.total)).toBe(105); // (95 + 10) × 1

    // Pagamento associado
    expect(res.body.pagamentos).toHaveLength(1);
    const pag = res.body.pagamentos[0];
    expect(pag.gateway).toBe("mercadopago");
    expect(pag.estadoPagamento).toBe("INICIADO");
    expect(Number(pag.valor)).toBe(200);

    // Carrinho convertido
    const cart = await prisma.cart.findUnique({ where: { cartKey } });
    expect(cart?.status).toBe("CONVERTIDO");
  });

  it("cria pedido ENTREGA com endereço snapshot e taxa", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });

    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "João Entrega",
      telefone: "(21) 97777-6666",
      tipoEntrega: "ENTREGA",
      endereco: ENDERECO_VALIDO,
      observacoes: "Tocar campainha 2x",
    });

    expect(res.status).toBe(201);
    expect(res.body.statusPedido).toBe("AGUARDANDO_PAGAMENTO");
    expect(res.body.tipoEntrega).toBe("ENTREGA");
    expect(res.body.enderecoSnapshot.cep).toBe("01001000");
    expect(res.body.enderecoSnapshot.complemento).toBe("Apto 45");
    expect(res.body.observacoes).toBe("Tocar campainha 2x");
    expect(Number(res.body.totalProdutos)).toBe(50);
    expect(Number(res.body.taxasEntrega)).toBeCloseTo(
      TAXA_ENTREGA.toNumber(),
      2,
    );
    expect(Number(res.body.total)).toBeCloseTo(
      50 + TAXA_ENTREGA.toNumber(),
      2,
    );

    // Cliente persistido de forma única
    const existing = await prisma.cliente.count({
      where: { telefone: "+5521977776666" },
    });
    expect(existing).toBe(1);
  });

  it("reaplicação com a mesma idempotencyKey não duplica o pedido", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });
    const key = idempotencia();

    const first = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: key,
      nome: "Idem Teste",
      telefone: "+5511988889999",
      tipoEntrega: "RETIRADA",
    });
    expect(first.status).toBe(201);

    // Reenvio idêntico → 200 com o MESMO pedido
    const second = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: key,
      nome: "Idem Teste",
      telefone: "+5511988889999",
      tipoEntrega: "RETIRADA",
    });
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.numeroPedido).toBe(first.body.numeroPedido);

    // Apenas 1 pedido e 1 pagamento foram criados
    const pedidos = await prisma.pedido.count({
      where: { cliente: { telefone: "+5511988889999" } },
    });
    const pagamentos = await prisma.pagamento.count({
      where: { idempotencyKey: key },
    });
    expect(pedidos).toBe(1);
    expect(pagamentos).toBe(1);
  });

  it("rejeita reenvio do mesmo cartKey convertido com outra chave (409)", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });

    await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "Convertido",
      telefone: "+5511977776666",
      tipoEntrega: "RETIRADA",
    });

    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(), // chave diferente → deve falhar
      nome: "Convertido",
      telefone: "+5511977776666",
      tipoEntrega: "RETIRADA",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/não está mais ativo/);
  });

  it("rejeita carrinho vazio (422)", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "Vazia",
      telefone: "+5511999991111",
      tipoEntrega: "RETIRADA",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Carrinho vazio/);
  });

  it("rejeita telefone inválido no confirm (400)", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "Sem Tel",
      telefone: "42",
      tipoEntrega: "RETIRADA",
    });
    expect(res.status).toBe(400);
  });

  it("rejeita entrega sem endereço no confirm (400)", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "Sem End",
      telefone: "+5511999992222",
      tipoEntrega: "ENTREGA",
    });
    expect(res.status).toBe(400);
  });

  it("aplica cupom no pedido e incrementa uso do cupom", async () => {
    const { cartKey } = await criarCarrinhoComItem();
    await prisma.cupom.create({
      data: {
        codigo: "CHECKFIXO",
        tipo: "FIXO",
        valor: new Prisma.Decimal("25"),
        ativo: true,
        usoMaximo: 5,
      },
    });
    const couponRes = await request(app)
      .post(`/api/cart/${cartKey}/apply-coupon`)
      .send({ cupom: "CHECKFIXO" })
      .expect(200);

    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "Cupom Teste",
      telefone: "+5511966665555",
      tipoEntrega: "RETIRADA",
    });

    expect(res.status).toBe(201);
    expect(Number(res.body.desconto)).toBe(25);
    expect(Number(res.body.total)).toBeCloseTo(75, 2); // 100 - 25

    // Cupom incrementado
    const cupom = await prisma.cupom.findUnique({ where: { codigo: "CHECKFIXO" } });
    expect(cupom?.usoAtual).toBe(couponRes.status === 200 ? 1 : 1);
  });

  it("bloqueia item indisponível (422)", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });
    // Torna produto indisponível depois de adicionar ao carrinho
    await prisma.produto.update({
      where: { id: produtoSimples.id },
      data: { disponivel: false },
    });

    const res = await request(app).post("/api/checkout/confirm").send({
      cartKey,
      idempotencyKey: idempotencia(),
      nome: "Indisp",
      telefone: "+5511955554444",
      tipoEntrega: "RETIRADA",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/indisponíveis/);

    await prisma.produto.update({
      where: { id: produtoSimples.id },
      data: { disponivel: true },
    });
  });
});
/**
 * cart/cart.test.ts — REN-11
 *
 * Testes de integração (supertest) do carrinho persistente no servidor.
 * Banco isolado: test.db (definido no vitest.config.ts).
 */

import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";
import { TAXA_ENTREGA } from "./service.js";

// ─── Seed local ───────────────────────────────────────────────────────────────

let catId: number;
let produtoSimples: { id: number };
let produtoComVariacao: { id: number };
let variacaoId: number;
let adicionalId: number;
let produtoSemEstoque: { id: number };
let produtoInativo: { id: number };
let produtoIndisponivel: { id: number };

beforeAll(async () => {
  await resetDatabase();

  const cat = await prisma.categoria.create({
    data: { nome: "Bolos Teste", slug: "bolos-teste", ordem: 1, ativa: true },
  });
  catId = cat.id;

  // Produto simples (sem variação, sem adicional, sem controle de estoque)
  produtoSimples = await prisma.produto.create({
    data: {
      nome: "Bolo Simples",
      sku: "CART-SIMPLES",
      categoriaId: catId,
      ativo: true,
      disponivel: true,
      precoVenda: new Prisma.Decimal("50.00"),
    },
  });

  // Produto com variação e adicional, com controle de estoque (5 unidades)
  const pv = await prisma.produto.create({
    data: {
      nome: "Bolo Especial",
      sku: "CART-ESP",
      categoriaId: catId,
      ativo: true,
      disponivel: true,
      precoVenda: new Prisma.Decimal("80.00"),
      controlarEstoque: true,
      vendaSemEstoque: false,
      estoqueAtual: 5,
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

  // Produto com estoque zerado (não vende sem estoque)
  produtoSemEstoque = await prisma.produto.create({
    data: {
      nome: "Bolo Esgotado",
      sku: "CART-ESTOQ",
      categoriaId: catId,
      ativo: true,
      disponivel: true,
      precoVenda: new Prisma.Decimal("60.00"),
      controlarEstoque: true,
      vendaSemEstoque: false,
      estoqueAtual: 0,
    },
  });

  // Produto inativo
  produtoInativo = await prisma.produto.create({
    data: {
      nome: "Bolo Inativo",
      sku: "CART-INAT",
      categoriaId: catId,
      ativo: false,
      precoVenda: new Prisma.Decimal("40.00"),
    },
  });

  // Produto indisponível (ativo mas disponivel=false)
  produtoIndisponivel = await prisma.produto.create({
    data: {
      nome: "Bolo Indisponivel",
      sku: "CART-INDISP",
      categoriaId: catId,
      ativo: true,
      disponivel: false,
      precoVenda: new Prisma.Decimal("45.00"),
    },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function criarCarrinho(): Promise<string> {
  const res = await request(app).post("/api/cart");
  expect(res.status).toBe(201);
  return (res.body as { cartKey: string }).cartKey;
}

// ─── POST /api/cart ───────────────────────────────────────────────────────────

describe("POST /api/cart", () => {
  it("cria carrinho e retorna cartKey UUID", async () => {
    const res = await request(app).post("/api/cart");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("cartKey");
    expect(typeof res.body.cartKey).toBe("string");
    expect(res.body.cartKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("cada chamada gera cartKey diferente", async () => {
    const r1 = await request(app).post("/api/cart");
    const r2 = await request(app).post("/api/cart");
    expect(r1.body.cartKey).not.toBe(r2.body.cartKey);
  });
});

// ─── GET /api/cart/:cartKey ───────────────────────────────────────────────────

describe("GET /api/cart/:cartKey", () => {
  it("retorna carrinho vazio com totais zerados", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app).get(`/api/cart/${cartKey}`);
    expect(res.status).toBe(200);
    expect(res.body.cartKey).toBe(cartKey);
    expect(res.body.itens).toHaveLength(0);
    expect(Number(res.body.subtotalProdutos)).toBe(0);
    expect(Number(res.body.total)).toBeGreaterThanOrEqual(0);
  });

  it("retorna 404 para cartKey inexistente", async () => {
    const res = await request(app).get(
      "/api/cart/00000000-0000-0000-0000-000000000000",
    );
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/cart/:cartKey/items ────────────────────────────────────────────

describe("POST /api/cart/:cartKey/items", () => {
  it("adiciona item simples e calcula preço no servidor", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 2 });

    expect(res.status).toBe(201);
    expect(res.body.itens).toHaveLength(1);
    const item = res.body.itens[0];
    expect(item.produtoId).toBe(produtoSimples.id);
    expect(item.quantidade).toBe(2);
    // Preço vem do banco: 50.00 × 2 = 100.00
    expect(Number(item.precoBase)).toBe(50);
    expect(Number(item.subtotal)).toBe(100);
    expect(Number(res.body.subtotalProdutos)).toBe(100);
  });

  it("adiciona item com variação e adicional, calcula preço correto", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({
        produtoId: produtoComVariacao.id,
        variacaoId,
        quantidade: 1,
        adicionaisSelecionados: [{ adicionalId, quantidade: 2 }],
      });

    expect(res.status).toBe(201);
    const item = res.body.itens[0];
    // preço: 80 (base) + 15 (variação) + 5×2 (adicional) = 105
    expect(Number(item.precoBase)).toBe(80);
    expect(Number(item.precoVariacao)).toBe(15);
    expect(Number(item.adicionais[0].subtotal)).toBe(10);
    expect(Number(item.precoUnitario)).toBe(105);
    expect(Number(item.subtotal)).toBe(105);
  });

  it("rejeita produto inativo (404)", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoInativo.id, quantidade: 1 });
    expect(res.status).toBe(404);
  });

  it("rejeita produto indisponível (422)", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoIndisponivel.id, quantidade: 1 });
    expect(res.status).toBe(422);
  });

  it("rejeita quando estoque insuficiente (422)", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSemEstoque.id, quantidade: 1 });
    expect(res.status).toBe(422);
  });

  it("rejeita quantidade 0", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 0 });
    expect(res.status).toBe(400);
  });

  it("rejeita variação que não pertence ao produto", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({
        produtoId: produtoSimples.id,
        variacaoId, // variação pertence a outro produto
        quantidade: 1,
      });
    expect(res.status).toBe(422);
  });

  it("unifica itens idênticos (mesmo produto+variacao+adicionais+obs)", async () => {
    const cartKey = await criarCarrinho();

    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, variacaoId, quantidade: 1 });
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, variacaoId, quantidade: 2 });

    const res = await request(app).get(`/api/cart/${cartKey}`);
    expect(res.body.itens).toHaveLength(1);
    expect(res.body.itens[0].quantidade).toBe(3);
  });

  it("NÃO unifica itens diferentes (variação diferente)", async () => {
    const cartKey = await criarCarrinho();

    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, variacaoId, quantidade: 1 });
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, quantidade: 1 }); // sem variação

    const res = await request(app).get(`/api/cart/${cartKey}`);
    expect(res.body.itens).toHaveLength(2);
  });

  it("rejeita adicional que não pertence ao produto", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({
        produtoId: produtoSimples.id,
        quantidade: 1,
        adicionaisSelecionados: [{ adicionalId: 9999, quantidade: 1 }],
      });
    expect(res.status).toBe(422);
  });
});

// ─── PATCH /api/cart/:cartKey/items/:itemId ───────────────────────────────────

describe("PATCH /api/cart/:cartKey/items/:itemId", () => {
  it("altera quantidade do item", async () => {
    const cartKey = await criarCarrinho();
    const addRes = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });
    const itemId = addRes.body.itens[0].id as number;

    const res = await request(app)
      .patch(`/api/cart/${cartKey}/items/${itemId}`)
      .send({ quantidade: 3 });

    expect(res.status).toBe(200);
    expect(res.body.itens[0].quantidade).toBe(3);
    expect(Number(res.body.subtotalProdutos)).toBe(150); // 50×3
  });

  it("rejeita quantidade > estoque (422)", async () => {
    const cartKey = await criarCarrinho();
    // produtoComVariacao tem estoqueAtual=5, pede 3 primeiro
    const addRes = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, quantidade: 3 });
    const itemId = addRes.body.itens[0].id as number;

    const res = await request(app)
      .patch(`/api/cart/${cartKey}/items/${itemId}`)
      .send({ quantidade: 10 }); // mais que o estoque
    expect(res.status).toBe(422);
  });

  it("retorna 404 para item de outro carrinho", async () => {
    const key1 = await criarCarrinho();
    const key2 = await criarCarrinho();

    const addRes = await request(app)
      .post(`/api/cart/${key1}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });
    const itemId = addRes.body.itens[0].id as number;

    const res = await request(app)
      .patch(`/api/cart/${key2}/items/${itemId}`)
      .send({ quantidade: 2 });
    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/cart/:cartKey/items/:itemId ─────────────────────────────────────

describe("PUT /api/cart/:cartKey/items/:itemId", () => {
  it("edita observações do item", async () => {
    const cartKey = await criarCarrinho();
    const addRes = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });
    const itemId = addRes.body.itens[0].id as number;

    const res = await request(app)
      .put(`/api/cart/${cartKey}/items/${itemId}`)
      .send({ observacoes: "sem glúten" });

    expect(res.status).toBe(200);
    expect(res.body.itens[0].observacoes).toBe("sem glúten");
  });

  it("edita adicionais do item com revalidação", async () => {
    const cartKey = await criarCarrinho();
    const addRes = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, variacaoId, quantidade: 1 });
    const itemId = addRes.body.itens[0].id as number;

    const res = await request(app)
      .put(`/api/cart/${cartKey}/items/${itemId}`)
      .send({
        adicionaisSelecionados: [{ adicionalId, quantidade: 3 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.itens[0].adicionais[0].quantidade).toBe(3);
    // 80 + 15 (variacao) + 5×3 = 110
    expect(Number(res.body.itens[0].precoUnitario)).toBe(110);
  });
});

// ─── DELETE /api/cart/:cartKey/items/:itemId ─────────────────────────────────

describe("DELETE /api/cart/:cartKey/items/:itemId", () => {
  it("remove item do carrinho", async () => {
    const cartKey = await criarCarrinho();
    const addRes = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });
    const itemId = addRes.body.itens[0].id as number;

    const res = await request(app).delete(
      `/api/cart/${cartKey}/items/${itemId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.itens).toHaveLength(0);
    expect(Number(res.body.subtotalProdutos)).toBe(0);
  });
});

// ─── DELETE /api/cart/:cartKey ────────────────────────────────────────────────

describe("DELETE /api/cart/:cartKey", () => {
  it("limpa todos os itens do carrinho", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, quantidade: 1 });

    const res = await request(app).delete(`/api/cart/${cartKey}`);
    expect(res.status).toBe(200);
    expect(res.body.itens).toHaveLength(0);
    expect(Number(res.body.subtotalProdutos)).toBe(0);
  });
});

// ─── POST /api/cart/:cartKey/apply-coupon ─────────────────────────────────────

describe("POST /api/cart/:cartKey/apply-coupon", () => {
  it("aplica cupom de porcentagem e calcula desconto correto", async () => {
    const cartKey = await criarCarrinho();
    // Adiciona item: 50 × 2 = 100
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 2 });

    // Cria cupom 20%
    await prisma.cupom.create({
      data: {
        codigo: "PROMO20",
        tipo: "PORCENTAGEM",
        valor: new Prisma.Decimal("20"),
        ativo: true,
      },
    });

    const res = await request(app)
      .post(`/api/cart/${cartKey}/apply-coupon`)
      .send({ cupom: "PROMO20" });

    expect(res.status).toBe(200);
    expect(Number(res.body.subtotalProdutos)).toBe(100);
    expect(Number(res.body.desconto)).toBe(20); // 20% de 100
    // total = 100 - 20 + frete (sem desconto no frete)
    const freteEsperado = TAXA_ENTREGA.toNumber();
    expect(Number(res.body.total)).toBeCloseTo(80 + freteEsperado, 2);
  });

  it("aplica cupom de valor fixo", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 2 }); // 100

    await prisma.cupom.create({
      data: {
        codigo: "DESC30",
        tipo: "FIXO",
        valor: new Prisma.Decimal("30"),
        ativo: true,
      },
    });

    const res = await request(app)
      .post(`/api/cart/${cartKey}/apply-coupon`)
      .send({ cupom: "desc30" }); // case insensitive

    expect(res.status).toBe(200);
    expect(Number(res.body.desconto)).toBe(30);
  });

  it("rejeita cupom inativo (422)", async () => {
    const cartKey = await criarCarrinho();
    await prisma.cupom.create({
      data: {
        codigo: "INATIVO",
        tipo: "FIXO",
        valor: new Prisma.Decimal("10"),
        ativo: false,
      },
    });

    const res = await request(app)
      .post(`/api/cart/${cartKey}/apply-coupon`)
      .send({ cupom: "INATIVO" });
    expect(res.status).toBe(422);
  });

  it("rejeita cupom expirado (422)", async () => {
    const cartKey = await criarCarrinho();
    await prisma.cupom.create({
      data: {
        codigo: "EXPIRADO",
        tipo: "FIXO",
        valor: new Prisma.Decimal("10"),
        ativo: true,
        dataFim: new Date("2020-01-01"),
      },
    });

    const res = await request(app)
      .post(`/api/cart/${cartKey}/apply-coupon`)
      .send({ cupom: "EXPIRADO" });
    expect(res.status).toBe(422);
  });

  it("rejeita cupom que atingiu limite de uso (422)", async () => {
    const cartKey = await criarCarrinho();
    await prisma.cupom.create({
      data: {
        codigo: "LIMITADO",
        tipo: "FIXO",
        valor: new Prisma.Decimal("5"),
        ativo: true,
        usoMaximo: 1,
        usoAtual: 1,
      },
    });

    const res = await request(app)
      .post(`/api/cart/${cartKey}/apply-coupon`)
      .send({ cupom: "LIMITADO" });
    expect(res.status).toBe(422);
  });

  it("rejeita código de cupom inexistente (422)", async () => {
    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/apply-coupon`)
      .send({ cupom: "NAOEXISTE" });
    expect(res.status).toBe(422);
  });
});

// ─── Cálculo total recalculado no servidor ────────────────────────────────────

describe("Cálculo soberano do servidor", () => {
  it("total recalculado corretamente com múltiplos itens", async () => {
    const cartKey = await criarCarrinho();

    // Item 1: simples × 1 = 50
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });

    // Item 2: com variação (80+15=95) × 1 = 95
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoComVariacao.id, variacaoId, quantidade: 1 });

    const res = await request(app).get(`/api/cart/${cartKey}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.subtotalProdutos)).toBe(145); // 50 + 95
    const freteEsperado = TAXA_ENTREGA.toNumber();
    expect(Number(res.body.taxaEntrega)).toBeCloseTo(freteEsperado, 2);
    expect(Number(res.body.total)).toBeCloseTo(145 + freteEsperado, 2);
  });

  it("GET retorna preço atual do banco (ignora valor do client)", async () => {
    // O cliente não pode enviar preços — preços vêm sempre do banco
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({
        produtoId: produtoSimples.id,
        quantidade: 1,
        precoUnitario: 9999, // campo ignorado pelo servidor
        subtotal: 9999,
      });

    const res = await request(app).get(`/api/cart/${cartKey}`);
    // Preço deve ser o do banco (50), não o enviado pelo cliente (9999)
    expect(Number(res.body.itens[0].precoBase)).toBe(50);
    expect(Number(res.body.itens[0].subtotal)).toBe(50);
  });

  it("item indisponível é marcado com flag e não entra no total", async () => {
    const cartKey = await criarCarrinho();
    await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: produtoSimples.id, quantidade: 1 });

    // Torna o produto indisponível depois de adicionar
    await prisma.produto.update({
      where: { id: produtoSimples.id },
      data: { disponivel: false },
    });

    const res = await request(app).get(`/api/cart/${cartKey}`);
    const item = res.body.itens[0];
    expect(item.indisponivel).toBe(true);
    expect(item.motivoIndisponibilidade).toBeTruthy();
    // Indisponível: não entra no subtotal
    expect(Number(res.body.subtotalProdutos)).toBe(0);
    expect(res.body.itensPendentes).toBe(true);

    // Restaura para outros testes
    await prisma.produto.update({
      where: { id: produtoSimples.id },
      data: { disponivel: true },
    });
  });

  it("preço promocional é usado quando vigente", async () => {
    // Produto com promoção ativa
    const prodPromo = await prisma.produto.create({
      data: {
        nome: "Bolo em Promoção",
        sku: "CART-PROMO",
        categoriaId: catId,
        ativo: true,
        disponivel: true,
        precoVenda: new Prisma.Decimal("100.00"),
        precoPromocional: new Prisma.Decimal("70.00"),
        dataInicioPromocao: new Date("2020-01-01"),
        dataFimPromocao: new Date("2099-12-31"),
      },
    });

    const cartKey = await criarCarrinho();
    const res = await request(app)
      .post(`/api/cart/${cartKey}/items`)
      .send({ produtoId: prodPromo.id, quantidade: 1 });

    expect(res.status).toBe(201);
    // Deve usar precoPromocional (70), não precoVenda (100)
    expect(Number(res.body.itens[0].precoBase)).toBe(70);
    expect(Number(res.body.itens[0].subtotal)).toBe(70);
  });
});

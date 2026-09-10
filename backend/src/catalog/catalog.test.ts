import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";

let catBolos: { id: number; slug: string };
let catDoces: { id: number; slug: string };
let catInativa: { id: number };
let produtoDestaque: { id: number; sku: string };
let produtoInativo: { id: number; sku: string };

beforeAll(async () => {
  await resetDatabase();

  const [b, d, inat] = await Promise.all([
    prisma.categoria.create({
      data: { nome: "Bolos", slug: "bolos", ordem: 1, ativa: true },
    }),
    prisma.categoria.create({
      data: { nome: "Doces", slug: "doces", ordem: 2, ativa: true },
    }),
    prisma.categoria.create({
      data: { nome: "Inativa", slug: "inativa", ordem: 99, ativa: false },
    }),
  ]);
  catBolos = b;
  catDoces = d;
  catInativa = inat;

  const [p1, , , p4] = await Promise.all([
    prisma.produto.create({
      data: {
        nome: "Bolo de Chocolate",
        sku: "BOL-CHOC-001",
        categoriaId: catBolos.id,
        ativo: true,
        emDestaque: true,
        maisVendido: true,
        precoVenda: 50,
        precoPromocional: 40,
        descricaoCurta: "Bolo delicioso.",
        estoqueAtual: 10,
        estoqueMinimo: 2,
        controlarEstoque: true,
      },
    }),
    prisma.produto.create({
      data: {
        nome: "Bolo de Morango",
        sku: "BOL-MORA-002",
        categoriaId: catBolos.id,
        ativo: true,
        emDestaque: false,
        maisVendido: false,
        precoVenda: 45,
        precoPromocional: 35,
        dataInicioPromocao: new Date("2020-01-01"),
        dataFimPromocao: new Date("2099-12-31"),
        estoqueAtual: 5,
        estoqueMinimo: 1,
        controlarEstoque: true,
      },
    }),
    prisma.produto.create({
      data: {
        nome: "Brigadeiro",
        sku: "DOC-BRIG-001",
        categoriaId: catDoces.id,
        ativo: true,
        emDestaque: false,
        maisVendido: false,
        precoVenda: 5,
        estoqueAtual: 50,
        estoqueMinimo: 10,
        controlarEstoque: true,
      },
    }),
    prisma.produto.create({
      data: {
        nome: "Produto Inativo",
        sku: "INAT-001",
        categoriaId: catBolos.id,
        ativo: false,
        precoVenda: 10,
      },
    }),
  ]);
  produtoDestaque = p1;
  produtoInativo = p4;

  await Promise.all([
    prisma.produtoImagem.create({
      data: {
        produtoId: p1.id,
        url: "https://exemplo.com/choc.jpg",
        ordem: 0,
        principal: true,
      },
    }),
    prisma.variacao.create({
      data: {
        produtoId: p1.id,
        nome: "Pequeno",
        precoAdicional: 0,
        ativo: true,
        ordem: 1,
      },
    }),
    prisma.adicional.create({
      data: {
        produtoId: p1.id,
        nome: "Chocolate Extra",
        precoAdicional: 5,
        ativo: true,
        ordem: 1,
      },
    }),
  ]);
});

describe("GET /api/catalog/categories", () => {
  it("retorna apenas categorias ativas", async () => {
    const res = await request(app).get("/api/catalog/categories");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((c: { id: number }) => c.id);
    expect(ids).toContain(catBolos.id);
    expect(ids).toContain(catDoces.id);
    expect(ids).not.toContain(catInativa.id);
  });

  it("inclui contagem de produtos ativos", async () => {
    const res = await request(app).get("/api/catalog/categories");
    const bolos = res.body.find(
      (c: { id: number }) => c.id === catBolos.id,
    );
    expect(bolos._count.produtos).toBeGreaterThanOrEqual(2);
  });

  it("retorna vazio quando não há categorias ativas", async () => {
    await prisma.categoria.updateMany({
      data: { ativa: false },
    });
    const res = await request(app).get("/api/catalog/categories");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    await prisma.categoria.updateMany({
      where: { id: { in: [catBolos.id, catDoces.id] } },
      data: { ativa: true },
    });
  });
});

describe("GET /api/catalog/products", () => {
  it("retorna apenas produtos ativos com paginação", async () => {
    const res = await request(app)
      .get("/api/catalog/products")
      .query({ page: 1, pageSize: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it("filtra por busca (nome/sku)", async () => {
    const res = await request(app)
      .get("/api/catalog/products")
      .query({ busca: "chocolate" });
    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (p: { sku: string }) => p.sku === produtoDestaque.sku,
      ),
    ).toBe(true);
    expect(
      res.body.data.every((p: { ativo: boolean }) => p.ativo === true),
    ).toBe(true);
  });

  it("filtra por categoriaId", async () => {
    const res = await request(app)
      .get("/api/catalog/products")
      .query({ categoriaId: catDoces.id });
    expect(res.status).toBe(200);
    expect(
      res.body.data.every(
        (p: { categoria: { id: number } }) =>
          p.categoria.id === catDoces.id,
      ),
    ).toBe(true);
  });

  it("filtra por emDestaque", async () => {
    const res = await request(app)
      .get("/api/catalog/products")
      .query({ emDestaque: "true" });
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((p: { emDestaque: boolean }) => p.emDestaque),
    ).toBe(true);
  });

  it("filtra por maisVendido", async () => {
    const res = await request(app)
      .get("/api/catalog/products")
      .query({ maisVendido: "true" });
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((p: { maisVendido: boolean }) => p.maisVendido),
    ).toBe(true);
  });

  it("inclui categoria e imagem principal", async () => {
    const res = await request(app)
      .get("/api/catalog/products")
      .query({ busca: "chocolate" });
    const p = res.body.data.find(
      (x: { sku: string }) => x.sku === produtoDestaque.sku,
    );
    expect(p.categoria).toBeDefined();
    expect(p.categoria.nome).toBe("Bolos");
    expect(p.imagens).toHaveLength(1);
    expect(p.imagens[0].principal).toBe(true);
  });

  it("não retorna produtos inativos", async () => {
    const res = await request(app).get("/api/catalog/products");
    const data = res.body.data as Array<{ sku: string }>;
    expect(data.some((p) => p.sku === produtoInativo.sku)).toBe(false);
  });
});

describe("GET /api/catalog/products/:idOrSlug", () => {
  it("retorna produto por id", async () => {
    const res = await request(app).get(
      `/api/catalog/products/${produtoDestaque.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(produtoDestaque.id);
    expect(res.body.categoria.nome).toBe("Bolos");
    expect(res.body.imagens).toHaveLength(1);
    expect(res.body.variacoes).toHaveLength(1);
    expect(res.body.adicionais).toHaveLength(1);
  });

  it("retorna 404 para produto inativo", async () => {
    const res = await request(app).get(
      `/api/catalog/products/${produtoInativo.id}`,
    );
    expect(res.status).toBe(404);
  });

  it("retorna 404 para id inexistente", async () => {
    const res = await request(app).get("/api/catalog/products/999999");
    expect(res.status).toBe(404);
  });

  it("retorna 404 para sku inexistente", async () => {
    const res = await request(app).get("/api/catalog/products/abc");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/catalog/home", () => {
  it("retorna categorias, destaques, maisVendidos e promocoes", async () => {
    const res = await request(app).get("/api/catalog/home");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.categorias)).toBe(true);
    expect(Array.isArray(res.body.destaques)).toBe(true);
    expect(Array.isArray(res.body.maisVendidos)).toBe(true);
    expect(Array.isArray(res.body.promocoes)).toBe(true);

    const idsDestaques = res.body.destaques.map(
      (p: { id: number }) => p.id,
    );
    expect(idsDestaques).toContain(produtoDestaque.id);
  });

  it("filtra promoções por data", async () => {
    const res = await request(app).get("/api/catalog/home");
    const promos = res.body.promocoes as Array<{ emPromocao: boolean }>;
    expect(promos.every((p) => p.emPromocao === true)).toBe(true);
  });

  it("não inclui categorias inativas", async () => {
    const res = await request(app).get("/api/catalog/home");
    const ids = res.body.categorias.map((c: { id: number }) => c.id);
    expect(ids).not.toContain(catInativa.id);
  });
});

import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";
import { hashPassword } from "../admin/password.js";

let token: string;
let categoriaId: number;

function auth() {
  return { Authorization: `Bearer ${token}` };
}

const payloadProduto = {
  nome: "Bolo de Cenoura",
  descricaoCurta: "Bolo de cenoura com cobertura de chocolate.",
  descricaoCompleta: "Massa fofinha de cenoura com cobertura de chocolate.",
  precoVenda: "58.90",
  emDestaque: true,
  controlarEstoque: true,
  estoqueAtual: 10,
  estoqueMinimo: 2,
};

let seq = 0;

async function criarProduto(idCategoria: number, skuOverride?: string) {
  seq += 1;
  const res = await request(app)
    .post("/api/admin/products")
    .set(auth())
    .send({
      ...payloadProduto,
      categoriaId: idCategoria,
      sku: skuOverride ?? `BOLO-CENOURA-${idCategoria}-${seq}`,
    });
  expect(res.status).toBe(201);
  return res.body;
}

beforeAll(async () => {
  await resetDatabase();
  await prisma.adminUser.create({
    data: {
      email: "admin@delivery.local",
      senhaHash: await hashPassword("admin123"),
      nome: "Admin",
    },
  });
  const login = await request(app)
    .post("/api/admin/auth/login")
    .send({ email: "admin@delivery.local", senha: "admin123" });
  token = login.body.token as string;

  const cat = await request(app)
    .post("/api/admin/categories")
    .set(auth())
    .send({ nome: "Bolos" });
  expect(cat.status).toBe(201);
  categoriaId = cat.body.id;
});

describe("CRUD admin de produtos", () => {
  it("cria produto com todos os campos administrativos", async () => {
    const produto = await criarProduto(categoriaId);
    expect(produto.id).toBeGreaterThan(0);
    expect(produto.nome).toBe("Bolo de Cenoura");
    expect(produto.sku.startsWith("BOLO-CENOURA-")).toBe(true);
    expect(produto.precoVenda).toBe("58.9");
    expect(produto.categoria.id).toBe(categoriaId);
    expect(produto.ativo).toBe(true);
    expect(produto.createdBy).toBe("admin@delivery.local");
    expect(produto.updatedBy).toBe("admin@delivery.local");
    expect(produto.imagens).toEqual([]);
    expect(produto.variacoes).toEqual([]);
    expect(produto.adicionais).toEqual([]);
  });

  it("rejeita sku duplicado", async () => {
    const sku = "SKU-DUPLICADO";
    const primeiro = await criarProduto(categoriaId, sku);
    expect(primeiro.id).toBeGreaterThan(0);

    const res = await request(app)
      .post("/api/admin/products")
      .set(auth())
      .send({ ...payloadProduto, sku, categoriaId });
    expect(res.status).toBe(409);
  });

  it("exige campos obrigatórios", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set(auth())
      .send({ nome: "Sem sku" });
    expect(res.status).toBe(400);
  });

  it("lista produtos com paginação e filtros", async () => {
    const produto = await criarProduto(categoriaId);

    const list = await request(app)
      .get("/api/admin/products")
      .set(auth())
      .query({ busca: "cenoura", emDestaque: "true", page: 1, pageSize: 10 });
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(list.body.data.some((p: { id: number }) => p.id === produto.id)).toBe(true);

    const filtroCategoria = await request(app)
      .get("/api/admin/products")
      .set(auth())
      .query({ categoriaId });
    expect(filtroCategoria.status).toBe(200);
    expect(filtroCategoria.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it("busca produto por id", async () => {
    const produto = await criarProduto(categoriaId);
    const res = await request(app)
      .get(`/api/admin/products/${produto.id}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(produto.id);
    expect(res.body.categoria.nome).toBe("Bolos");
  });

  it("retorna 404 para produto inexistente", async () => {
    const res = await request(app)
      .get("/api/admin/products/999999")
      .set(auth());
    expect(res.status).toBe(404);
  });

  it("atualiza produto parcialmente", async () => {
    const produto = await criarProduto(categoriaId);
    const res = await request(app)
      .patch(`/api/admin/products/${produto.id}`)
      .set(auth())
      .send({ precoPromocional: "49.90", maisVendido: true });
    expect(res.status).toBe(200);
    expect(res.body.precoPromocional).toBe("49.9");
    expect(res.body.maisVendido).toBe(true);
    expect(res.body.updatedBy).toBe("admin@delivery.local");
  });

  it("inativa produto com DELETE lógico", async () => {
    const produto = await criarProduto(categoriaId);
    const del = await request(app)
      .delete(`/api/admin/products/${produto.id}`)
      .set(auth());
    expect(del.status).toBe(204);

    const res = await request(app)
      .get(`/api/admin/products/${produto.id}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.ativo).toBe(false);
  });
});

describe("imagens de produto (nested)", () => {
  it("cria, lista, define principal, reordena e remove", async () => {
    const produto = await criarProduto(categoriaId);

    const img1 = await request(app)
      .post(`/api/admin/products/${produto.id}/images`)
      .set(auth())
      .send({ url: "https://exemplo.com/bolo1.jpg", ordem: 1 });
    expect(img1.status).toBe(201);
    expect(img1.body.principal).toBe(true);

    const img2 = await request(app)
      .post(`/api/admin/products/${produto.id}/images`)
      .set(auth())
      .send({ url: "https://exemplo.com/bolo2.jpg", ordem: 2 });
    expect(img2.status).toBe(201);
    expect(img2.body.principal).toBe(false);

    const patch = await request(app)
      .patch(`/api/admin/products/${produto.id}/images/${img1.body.id}`)
      .set(auth())
      .send({ principal: true });
    expect(patch.status).toBe(200);
    expect(patch.body.principal).toBe(true);

    const list = await request(app)
      .get(`/api/admin/products/${produto.id}/images`)
      .set(auth());
    expect(list.status).toBe(200);
    const principais = list.body.filter(
      (i: { principal: boolean }) => i.principal,
    );
    expect(principais).toHaveLength(1);

    const reorder = await request(app)
      .patch(`/api/admin/products/${produto.id}/images/${img2.body.id}`)
      .set(auth())
      .send({ ordem: 5 });
    expect(reorder.body.ordem).toBe(5);

    await request(app)
      .delete(`/api/admin/products/${produto.id}/images/${img1.body.id}`)
      .set(auth());
    const remanescente = await request(app)
      .get(`/api/admin/products/${produto.id}/images`)
      .set(auth());
    expect(remanescente.body).toHaveLength(1);
    expect(remanescente.body[0].principal).toBe(true);
  });
});

describe("variações de produto (nested)", () => {
  it("cria, edita, reordena, inativa e reativa", async () => {
    const produto = await criarProduto(categoriaId);

    const var1 = await request(app)
      .post(`/api/admin/products/${produto.id}/variacoes`)
      .set(auth())
      .send({ nome: "Pequeno (1kg)", precoAdicional: "0", ordem: 1 });
    expect(var1.status).toBe(201);
    expect(var1.body.ativo).toBe(true);

    const var2 = await request(app)
      .post(`/api/admin/products/${produto.id}/variacoes`)
      .set(auth())
      .send({ nome: "Grande (3kg)", precoAdicional: "20.00", ordem: 2 });
    expect(var2.status).toBe(201);

    const edit = await request(app)
      .patch(`/api/admin/products/${produto.id}/variacoes/${var1.body.id}`)
      .set(auth())
      .send({ precoAdicional: "10.00", ordem: 3 });
    expect(edit.status).toBe(200);
    expect(edit.body.precoAdicional).toBe("10");
    expect(edit.body.ordem).toBe(3);

    await request(app)
      .delete(`/api/admin/products/${produto.id}/variacoes/${var1.body.id}`)
      .set(auth());

    const list = await request(app)
      .get(`/api/admin/products/${produto.id}/variacoes`)
      .set(auth());
    const desativada = list.body.find(
      (v: { id: number }) => v.id === var1.body.id,
    );
    expect(desativada.ativo).toBe(false);

    const reactivate = await request(app)
      .patch(`/api/admin/products/${produto.id}/variacoes/${var1.body.id}`)
      .set(auth())
      .send({ ativo: true });
    expect(reactivate.body.ativo).toBe(true);
  });
});

describe("adicionais de produto (nested)", () => {
  it("cria, edita, inativa e reativa", async () => {
    const produto = await criarProduto(categoriaId);

    const add = await request(app)
      .post(`/api/admin/products/${produto.id}/adicionais`)
      .set(auth())
      .send({
        nome: "Chocolate",
        precoAdicional: "5.00",
        obrigatorio: false,
        quantidadeMinima: 0,
        quantidadeMaxima: 3,
        ordem: 1,
      });
    expect(add.status).toBe(201);
    expect(add.body.precoAdicional).toBe("5");

    const edit = await request(app)
      .patch(`/api/admin/products/${produto.id}/adicionais/${add.body.id}`)
      .set(auth())
      .send({ quantidadeMaxima: 5, obrigatorio: true });
    expect(edit.status).toBe(200);
    expect(edit.body.quantidadeMaxima).toBe(5);
    expect(edit.body.obrigatorio).toBe(true);

    await request(app)
      .delete(`/api/admin/products/${produto.id}/adicionais/${add.body.id}`)
      .set(auth());

    const list = await request(app)
      .get(`/api/admin/products/${produto.id}/adicionais`)
      .set(auth());
    expect(list.body[0].ativo).toBe(false);

    const reactivate = await request(app)
      .patch(`/api/admin/products/${produto.id}/adicionais/${add.body.id}`)
      .set(auth())
      .send({ ativo: true });
    expect(reactivate.body.ativo).toBe(true);
  });

  it("valida quantidadeMaxima >= quantidadeMinima", async () => {
    const produto = await criarProduto(categoriaId);
    const res = await request(app)
      .post(`/api/admin/products/${produto.id}/adicionais`)
      .set(auth())
      .send({
        nome: "Extra",
        quantidadeMinima: 3,
        quantidadeMaxima: 1,
      });
    expect(res.status).toBe(400);
  });
});

describe("categorias (admin)", () => {
  it("gera slug único a partir do nome", async () => {
    const criada = await request(app)
      .post("/api/admin/categories")
      .set(auth())
      .send({ nome: "Salgados Fritos" });
    expect(criada.status).toBe(201);
    expect(criada.body.slug).toBe("salgados-fritos");

    const repetida = await request(app)
      .post("/api/admin/categories")
      .set(auth())
      .send({ nome: "Salgados Fritos" });
    expect(repetida.status).toBe(201);
    expect(repetida.body.slug).toBe("salgados-fritos-2");
  });

  it("inativa categoria em uso e exclui categoria sem produtos", async () => {
    const emUso = await request(app)
      .get("/api/admin/categories")
      .set(auth())
      .query({ busca: "Bolos" });
    const idEmUso = emUso.body.data[0].id;

    const inativada = await request(app)
      .delete(`/api/admin/categories/${idEmUso}`)
      .set(auth());
    expect(inativada.status).toBe(200);
    expect(inativada.body.inativada).toBe(true);

    const lista = await request(app)
      .post("/api/admin/categories")
      .set(auth())
      .send({ nome: "Vazia", ordem: 99 });
    const removida = await request(app)
      .delete(`/api/admin/categories/${lista.body.id}`)
      .set(auth());
    expect(removida.status).toBe(204);
  });
});
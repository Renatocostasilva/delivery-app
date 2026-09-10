import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";
import { hashPassword } from "./password.js";

const ADMIN_EMAIL = "admin@delivery.local";
const ADMIN_SENHA = "admin123";

beforeAll(async () => {
  await resetDatabase();
  await prisma.adminUser.create({
    data: {
      email: ADMIN_EMAIL,
      senhaHash: await hashPassword(ADMIN_SENHA),
      nome: "Administrador Teste",
    },
  });
});

describe("POST /api/admin/auth/login", () => {
  it("loga com credenciais válidas e retorna token", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: ADMIN_EMAIL, senha: ADMIN_SENHA });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(0);
    expect(res.body.admin.email).toBe(ADMIN_EMAIL);
  });

  it("rejeita senha incorreta", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: ADMIN_EMAIL, senha: "senha-errada" });
    expect(res.status).toBe(401);
  });

  it("rejeita e-mail desconhecido", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({ email: "nao.existe@delivery.local", senha: ADMIN_SENHA });
    expect(res.status).toBe(401);
  });

  it("exige e-mail e senha", async () => {
    const res = await request(app).post("/api/admin/auth/login").send({});
    expect(res.status).toBe(400);
  });
});

describe("proteção das rotas admin", () => {
  it("nega acesso sem token", async () => {
    const res = await request(app).get("/api/admin/categories");
    expect(res.status).toBe(401);
  });

  it("nega acesso com token inválido", async () => {
    const res = await request(app)
      .get("/api/admin/categories")
      .set("Authorization", "Bearer token-invalido");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/auth/logout", () => {
  it("exige token validado", async () => {
    const res = await request(app).post("/api/admin/auth/logout");
    expect(res.status).toBe(401);
  });
});
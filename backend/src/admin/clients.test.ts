import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { resetDatabase } from "../lib/test-utils.js";
import { hashPassword } from "../admin/password.js";

let token: string;

function auth() {
  return { Authorization: `Bearer ${token}` };
}

const ENDERECO_BASE = {
  logradouro: "Rua das Flores",
  numero: "123",
  complemento: "Apto 45",
  bairro: "Centro",
  cidade: "São Paulo",
  cep: "01001000",
  referencia: "Próximo ao metrô",
  principal: true,
};

let seq = 0;

async function criarCliente(overrides: Record<string, unknown> = {}) {
  seq += 1;
  const payload = {
    nome: `Cliente Teste ${seq}`,
    telefone: `(11) 98887-${String(seq).padStart(4, "0")}`,
    email: `cliente${seq}@exemplo.com`,
    enderecos: [{ ...ENDERECO_BASE, logradouro: `Rua Numero ${seq}` }],
    ...overrides,
  };
  const res = await request(app)
    .post("/api/admin/clients")
    .set(auth())
    .send(payload);
  return res;
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
});

describe("autenticação (401)", () => {
  it("bloqueia listagem e criação sem token", async () => {
    const list = await request(app).get("/api/admin/clients");
    expect(list.status).toBe(401);

    const create = await request(app)
      .post("/api/admin/clients")
      .send({ nome: "Sem token", telefone: "11999998888" });
    expect(create.status).toBe(401);
  });
});

describe("CRUD de clientes (base única por telefone)", () => {
  it("cria cliente com telefone normalizado em E.164 e endereço principal", async () => {
    const res = await criarCliente();
    expect(res.status).toBe(201);
    expect(res.body.telefone).toBe(`+551198887${String(seq).padStart(4, "0")}`);
    expect(res.body.ativo).toBe(true);
    expect(res.body.email).toBe(`cliente${seq}@exemplo.com`);
    expect(res.body.enderecos).toHaveLength(1);
    expect(res.body.enderecos[0].principal).toBe(true);
    expect(res.body.enderecos[0].cep).toBe("01001000");
  });

  it("aceita cliente sem endereços", async () => {
    const res = await criarCliente({ enderecos: undefined });
    expect(res.status).toBe(201);
    expect(res.body.enderecos).toEqual([]);
  });

  it("rejeita telefone inválido (400)", async () => {
    const res = await criarCliente({ telefone: "123" });
    expect(res.status).toBe(400);
  });

  it("rejeita e-mail inválido (400)", async () => {
    const res = await criarCliente({ email: "email-invalido" });
    expect(res.status).toBe(400);
  });

  it("rejeita telefone duplicado com formatos diferentes (409)", async () => {
    const mascarado = await criarCliente({ telefone: "(11) 97777-6666" });
    expect(mascarado.status).toBe(201);

    const duplicado = await criarCliente({ telefone: "11977776666" });
    expect(duplicado.status).toBe(409);
  });

  it("lista clientes com paginação e busca por nome", async () => {
    await criarCliente({ nome: "Busca XYZ" });
    await criarCliente({ nome: "Outro" });

    const list = await request(app)
      .get("/api/admin/clients")
      .set(auth())
      .query({ busca: "busca", page: 1, pageSize: 10 });
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);
    expect(list.body.data.some((c: { nome: string }) => c.nome === "Busca XYZ")).toBe(true);
    expect(list.body.page).toBe(1);
    expect(list.body.pageSize).toBe(10);
  });

  it("busca cliente por telefone mascarado no filtro", async () => {
    const telefone = "(11) 96666-5555";
    await criarCliente({ telefone, nome: "Busca Telefone" });

    const list = await request(app)
      .get("/api/admin/clients")
      .set(auth())
      .query({ busca: "966665555" });
    expect(list.status).toBe(200);
    expect(list.body.data.some((c: { nome: string }) => c.nome === "Busca Telefone")).toBe(true);
  });

  it("filtra clientes por temPedidos", async () => {
    const semPedidos = await criarCliente({ nome: "Sem Pedidos" });
    const comPedidos = await criarCliente({ nome: "Com Pedidos" });
    await prisma.pedido.create({
      data: {
        clienteId: comPedidos.body.id,
        numeroPedido: `PED-TEM-${seq}`,
        tipoEntrega: "RETIRADA",
        total: 10,
      },
    });

    const com = await request(app)
      .get("/api/admin/clients")
      .set(auth())
      .query({ temPedidos: "true" });
    expect(com.status).toBe(200);
    expect(com.body.data.some((c: { id: number }) => c.id === semPedidos.body.id)).toBe(false);
    expect(com.body.data.some((c: { id: number }) => c.id === comPedidos.body.id)).toBe(true);

    const sem = await request(app)
      .get("/api/admin/clients")
      .set(auth())
      .query({ temPedidos: "false" });
    expect(sem.body.data.some((c: { id: number }) => c.id === semPedidos.body.id)).toBe(true);
    expect(sem.body.data.some((c: { id: number }) => c.id === comPedidos.body.id)).toBe(false);
  });

  it("retorna 404 para cliente inexistente", async () => {
    const res = await request(app).get("/api/admin/clients/999999").set(auth());
    expect(res.status).toBe(404);
  });
});

describe("detalhe do cliente", () => {
  it("retorna dados, endereços, pedidos e resumo financeiro", async () => {
    const criado = await criarCliente({ nome: "Detalhe Financeiro" });
    const clienteId = criado.body.id;

    await prisma.pedido.create({
      data: {
        clienteId,
        numeroPedido: `PED-DET-1-${seq}`,
        tipoEntrega: "ENTREGA",
        total: 50,
        statusPedido: "ENTREGUE",
        createdAt: new Date("2026-01-05T10:00:00Z"),
      },
    });
    await prisma.pedido.create({
      data: {
        clienteId,
        numeroPedido: `PED-DET-2-${seq}`,
        tipoEntrega: "RETIRADA",
        total: 30,
        statusPedido: "PRONTO",
        createdAt: new Date("2026-02-05T10:00:00Z"),
      },
    });
    await prisma.pedido.create({
      data: {
        clienteId,
        numeroPedido: `PED-DET-3-${seq}`,
        tipoEntrega: "RETIRADA",
        total: 10,
        statusPedido: "CANCELADO",
        createdAt: new Date("2026-03-05T10:00:00Z"),
      },
    });

    const res = await request(app)
      .get(`/api/admin/clients/${clienteId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(clienteId);
    expect(res.body.enderecos).toHaveLength(1);
    expect(res.body.pedidos).toHaveLength(3);
    expect(res.body.resumo.totalPedidos).toBe(3);
    expect(res.body.resumo.totalComprado).toBe("80");
    expect(res.body.resumo.primeiroPedido.numeroPedido).toBe(`PED-DET-1-${seq}`);
    expect(res.body.resumo.ultimoPedido.numeroPedido).toBe(`PED-DET-3-${seq}`);
  });
});

describe("atualização de cliente", () => {
  it("atualiza nome e email", async () => {
    const criado = await criarCliente({ nome: "Antes" });
    const res = await request(app)
      .patch(`/api/admin/clients/${criado.body.id}`)
      .set(auth())
      .send({ nome: "Depois", email: "depois@exemplo.com" });
    expect(res.status).toBe(200);
    expect(res.body.nome).toBe("Depois");
    expect(res.body.email).toBe("depois@exemplo.com");
  });

  it("reativa cliente inativo via ativo=true", async () => {
    const criado = await criarCliente({ nome: "Reativar" });
    await request(app)
      .delete(`/api/admin/clients/${criado.body.id}`)
      .set(auth());
    const res = await request(app)
      .patch(`/api/admin/clients/${criado.body.id}`)
      .set(auth())
      .send({ ativo: true });
    expect(res.status).toBe(200);
    expect(res.body.ativo).toBe(true);
  });

  it("cria, altera e remove endereços via array aninhado", async () => {
    const criado = await criarCliente({ nome: "Enderecos Bulk" });
    const clienteId = criado.body.id;
    const primeiroId = criado.body.enderecos[0].id;

    const adicionar = await request(app)
      .patch(`/api/admin/clients/${clienteId}`)
      .set(auth())
      .send({
        enderecos: [
          { ...ENDERECO_BASE, logradouro: "Rua Nova", principal: true },
        ],
      });
    expect(adicionar.status).toBe(200);
    expect(adicionar.body.enderecos).toHaveLength(2);
    const novos = adicionar.body.enderecos.filter(
      (e: { logradouro: string }) => e.logradouro === "Rua Nova",
    );
    expect(novos).toHaveLength(1);
    expect(novos[0].principal).toBe(true);
    expect(
      adicionar.body.enderecos.find(
        (e: { id: number }) => e.id === primeiroId,
      ).principal,
    ).toBe(false);

    const alterar = await request(app)
      .patch(`/api/admin/clients/${clienteId}`)
      .set(auth())
      .send({
        enderecos: [
          { id: primeiroId, complemento: "Alterado", principal: true },
        ],
      });
    expect(alterar.status).toBe(200);
    const alterado = alterar.body.enderecos.find(
      (e: { id: number }) => e.id === primeiroId,
    );
    expect(alterado.complemento).toBe("Alterado");
    expect(alterado.principal).toBe(true);

    const remover = await request(app)
      .patch(`/api/admin/clients/${clienteId}`)
      .set(auth())
      .send({ enderecos: [{ id: primeiroId, remover: true }] });
    expect(remover.status).toBe(200);
    expect(remover.body.enderecos).toHaveLength(1);
    expect(remover.body.enderecos[0].principal).toBe(true);
  });

  it("404 ao alterar endereço de outro cliente via array", async () => {
    const clienteA = await criarCliente({ nome: "Cliente A" });
    const clienteB = await criarCliente({ nome: "Cliente B" });

    const res = await request(app)
      .patch(`/api/admin/clients/${clienteA.body.id}`)
      .set(auth())
      .send({
        enderecos: [
          { id: clienteB.body.enderecos[0].id, complemento: "X" },
        ],
      });
    expect(res.status).toBe(404);
  });
});

describe("inativação (soft delete)", () => {
  it("inativa cliente preservando pedidos e endereços", async () => {
    const criado = await criarCliente({ nome: "Soft Delete" });
    const clienteId = criado.body.id;
    await prisma.pedido.create({
      data: {
        clienteId,
        numeroPedido: `PED-DEL-${seq}`,
        tipoEntrega: "ENTREGA",
        total: 42,
      },
    });

    const del = await request(app)
      .delete(`/api/admin/clients/${clienteId}`)
      .set(auth());
    expect(del.status).toBe(204);

    const res = await request(app)
      .get(`/api/admin/clients/${clienteId}`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.ativo).toBe(false);
    expect(res.body.enderecos).toHaveLength(1);
    expect(res.body.pedidos).toHaveLength(1);

    const inativos = await request(app)
      .get("/api/admin/clients")
      .set(auth())
      .query({ ativo: "false" });
    expect(inativos.body.data.some((c: { id: number }) => c.id === clienteId)).toBe(true);

    const ativos = await request(app)
      .get("/api/admin/clients")
      .set(auth())
      .query({ ativo: "true" });
    expect(ativos.body.data.some((c: { id: number }) => c.id === clienteId)).toBe(false);
  });
});

describe("endereços aninhados (CRUD dedicado)", () => {
  it("cria endereço e garante apenas um principal", async () => {
    const criado = await criarCliente({ nome: "Enderecos Nested" });
    const clienteId = criado.body.id;

    const novo = await request(app)
      .post(`/api/admin/clients/${clienteId}/enderecos`)
      .set(auth())
      .send({ ...ENDERECO_BASE, logradouro: "Av. Principal", principal: true });
    expect(novo.status).toBe(201);

    const list = await request(app)
      .get(`/api/admin/clients/${clienteId}/enderecos`)
      .set(auth());
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    const principais = list.body.filter((e: { principal: boolean }) => e.principal);
    expect(principais).toHaveLength(1);
    expect(principais[0].logradouro).toBe("Av. Principal");
  });

  it("atualiza e remove endereço com reatribuição do principal", async () => {
    const criado = await criarCliente({ nome: "Enderecos Reassign" });
    const clienteId = criado.body.id;
    const enderecoId = criado.body.enderecos[0].id;

    const patch = await request(app)
      .patch(`/api/admin/clients/${clienteId}/enderecos/${enderecoId}`)
      .set(auth())
      .send({ bairro: "Vila Nova" });
    expect(patch.status).toBe(200);
    expect(patch.body.bairro).toBe("Vila Nova");
    expect(patch.body.principal).toBe(true);

    const del = await request(app)
      .delete(`/api/admin/clients/${clienteId}/enderecos/${enderecoId}`)
      .set(auth());
    expect(del.status).toBe(204);

    const list = await request(app)
      .get(`/api/admin/clients/${clienteId}/enderecos`)
      .set(auth());
    expect(list.body).toHaveLength(0);
  });

  it("404 ao acessar endereço de outro cliente", async () => {
    const clienteA = await criarCliente({ nome: "Endereco A" });
    const clienteB = await criarCliente({ nome: "Endereco B" });

    const res = await request(app)
      .patch(
        `/api/admin/clients/${clienteA.body.id}/enderecos/${clienteB.body.enderecos[0].id}`,
      )
      .set(auth())
      .send({ bairro: "X" });
    expect(res.status).toBe(404);
  });
});
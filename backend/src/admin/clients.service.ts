/**
 * admin/clients.service.ts — REN-10
 *
 * CRUD administrativo de clientes (base única por telefone, E.164 +55).
 * Endereços são gerenciados aninhados (model Endereco). Remoção é soft
 * (inativa o cliente) para não quebrar pedidos/endereços existentes.
 */

import { Prisma, type StatusPedido } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import { normalizarTelefone } from "../clients/service.js";
import {
  booleanField,
  intField,
  nullString,
  text,
} from "../lib/validate.js";

// Pedidos com esses status contam como "não comprados" no total do cliente.
const PEDIDOS_SEM_TOTAL: StatusPedido[] = [
  "CANCELADO",
  "RECUSADO",
  "ESTORNADO",
  "FALHA_PAGAMENTO",
];

export type EnderecoInput = {
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  cep: string;
  referencia: string | null;
  principal: boolean;
};

export type EnderecoUpdateItem = Partial<EnderecoInput> & {
  id?: number;
  remover?: boolean;
};

export type ListClientesParams = {
  busca?: string;
  ativo?: boolean;
  temPedidos?: boolean;
  dataInicio?: Date;
  dataFim?: Date;
  page: number;
  pageSize: number;
};

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseEnderecoInput(value: unknown, prefixo: string): EnderecoInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, `Cada item de "${prefixo}" deve ser um objeto.`);
  }
  const e = value as Record<string, unknown>;

  const logradouro = text(e.logradouro, `${prefixo}.logradouro`, {
    required: true,
  }) as string;
  const numero = text(e.numero, `${prefixo}.numero`, {
    required: true,
  }) as string;
  const bairro = text(e.bairro, `${prefixo}.bairro`, {
    required: true,
  }) as string;
  const cidade = text(e.cidade, `${prefixo}.cidade`, {
    required: true,
  }) as string;
  const cepRaw = text(e.cep, `${prefixo}.cep`, { required: true }) as string;

  const cep = cepRaw.replace(/\D/g, "");
  if (cep.length !== 8) {
    throw new HttpError(400, `${prefixo}.cep deve ter 8 dígitos.`);
  }

  const complemento = nullString(e.complemento, `${prefixo}.complemento`);
  const referencia = nullString(e.referencia, `${prefixo}.referencia`);
  const principal = booleanField(e.principal, `${prefixo}.principal`) ?? false;

  return {
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    cep,
    referencia,
    principal,
  };
}

export function parseEnderecosArray(value: unknown): EnderecoInput[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Campo \"enderecos\" deve ser uma lista de endereços.");
  }
  return value.map((item) => parseEnderecoInput(item, "enderecos"));
}

export function parseEnderecoUpdatesArray(value: unknown): EnderecoUpdateItem[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Campo \"enderecos\" deve ser uma lista de endereços.");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new HttpError(400, "Cada item de \"enderecos\" deve ser um objeto.");
    }
    const e = item as Record<string, unknown>;
    const id = e.id !== undefined ? intField(e.id, "enderecos.id", { min: 1 }) : undefined;
    const remover = e.remover !== undefined ? booleanField(e.remover, "enderecos.remover") : undefined;

    if (remover === true) return { id, remover };

    const out: EnderecoUpdateItem = { id, remover };
    for (const campo of ["logradouro", "numero", "bairro", "cidade"] as const) {
      if (e[campo] !== undefined) {
        out[campo] = text(e[campo], `enderecos.${campo}`, { required: true }) as string;
      }
    }
    if (e.cep !== undefined) {
      const cepRaw = text(e.cep, "enderecos.cep", { required: true }) as string;
      const cep = cepRaw.replace(/\D/g, "");
      if (cep.length !== 8) {
        throw new HttpError(400, "enderecos.cep deve ter 8 dígitos.");
      }
      out.cep = cep;
    }
    if (e.complemento !== undefined) out.complemento = nullString(e.complemento, "enderecos.complemento");
    if (e.referencia !== undefined) out.referencia = nullString(e.referencia, "enderecos.referencia");
    if (e.principal !== undefined) out.principal = booleanField(e.principal, "enderecos.principal");
    return out;
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function validarEmail(email: string | null | undefined) {
  if (email !== null && email !== undefined && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new HttpError(400, "Campo \"email\" deve ser um e-mail válido.");
  }
  return email;
}

async function getClienteOrThrow(id: number) {
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) throw new HttpError(404, "Cliente não encontrado.");
  return cliente;
}

// Garante exatamente um endereço principal por cliente após cada operação.
async function reconciliarPrincipal(
  tx: Prisma.TransactionClient,
  clienteId: number,
) {
  const restantes = await tx.endereco.findMany({
    where: { clienteId },
    orderBy: { id: "asc" },
  });
  if (restantes.length === 0) return;

  const comPrincipal = restantes.filter((e) => e.principal);
  if (comPrincipal.length === 0) {
    await tx.endereco.update({
      where: { id: restantes[0].id },
      data: { principal: true },
    });
  } else if (comPrincipal.length > 1) {
    const primeiro = comPrincipal[0];
    await tx.endereco.updateMany({
      where: { clienteId, NOT: { id: primeiro.id } },
      data: { principal: false },
    });
  }
}

// ─── Listar clientes ─────────────────────────────────────────────────────────

export async function listClientes(params: ListClientesParams) {
  const where: Prisma.ClienteWhereInput = {};
  if (params.ativo !== undefined) where.ativo = params.ativo;
  if (params.temPedidos !== undefined) {
    where.pedidos = params.temPedidos ? { some: {} } : { none: {} };
  }
  if (params.busca) {
    where.OR = [
      { nome: { contains: params.busca } },
      { telefone: { contains: params.busca } },
      { email: { contains: params.busca } },
    ];
  }
  if (params.dataInicio || params.dataFim) {
    where.createdAt = {};
    if (params.dataInicio) where.createdAt.gte = params.dataInicio;
    if (params.dataFim) {
      const fim = new Date(params.dataFim);
      fim.setHours(23, 59, 59, 999);
      where.createdAt.lte = fim;
    }
  }

  const [data, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        enderecos: { orderBy: [{ principal: "desc" }, { id: "asc" }] },
        _count: { select: { pedidos: true } },
      },
    }),
    prisma.cliente.count({ where }),
  ]);

  return { data, total, page: params.page, pageSize: params.pageSize };
}

// ─── Detalhe do cliente ──────────────────────────────────────────────────────

export async function getCliente(id: number) {
  const cliente = await getClienteOrThrow(id);

  const [enderecos, pedidos] = await Promise.all([
    prisma.endereco.findMany({
      where: { clienteId: id },
      orderBy: [{ principal: "desc" }, { id: "asc" }],
    }),
    prisma.pedido.findMany({
      where: { clienteId: id },
      include: {
        itens: {
          select: {
            produtoNome: true,
            variacaoNome: true,
            quantidade: true,
            precoUnitario: true,
            total: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalComprado = pedidos
    .filter((p) => !PEDIDOS_SEM_TOTAL.includes(p.statusPedido))
    .reduce((acc, p) => acc.add(p.total), new Prisma.Decimal(0));

  const ultimo = pedidos[0] ?? null;
  const primeiro = pedidos.length > 0 ? pedidos[pedidos.length - 1] : null;

  const resumo = {
    totalPedidos: pedidos.length,
    totalComprado,
    primeiroPedido: primeiro && {
      id: primeiro.id,
      numeroPedido: primeiro.numeroPedido,
      total: primeiro.total,
      statusPedido: primeiro.statusPedido,
      statusPagamento: primeiro.statusPagamento,
      createdAt: primeiro.createdAt,
    },
    ultimoPedido: ultimo && {
      id: ultimo.id,
      numeroPedido: ultimo.numeroPedido,
      total: ultimo.total,
      statusPedido: ultimo.statusPedido,
      statusPagamento: ultimo.statusPagamento,
      createdAt: ultimo.createdAt,
    },
  };

  return { ...cliente, enderecos, pedidos, resumo };
}

// ─── Criar cliente ───────────────────────────────────────────────────────────

export async function createCliente(data: {
  nome: string;
  telefone: string;
  email?: string | null;
  enderecos?: EnderecoInput[];
}) {
  const telefone = normalizarTelefone(data.telefone);
  const existente = await prisma.cliente.findUnique({ where: { telefone } });
  if (existente) {
    throw new HttpError(409, `Já existe um cliente com o telefone ${telefone}.`);
  }
  const email = validarEmail(data.email);

  const lista = data.enderecos ?? [];
  const temPrincipal = lista.some((e) => e.principal);

  return prisma.cliente.create({
    data: {
      nome: data.nome,
      telefone,
      email: email ?? null,
      enderecos:
        lista.length > 0
          ? {
              create: lista.map((endereco, i) => ({
                ...endereco,
                principal: temPrincipal ? endereco.principal : i === 0,
              })),
            }
          : undefined,
    },
    include: {
      enderecos: { orderBy: [{ principal: "desc" }, { id: "asc" }] },
    },
  });
}

// ─── Atualizar cliente ───────────────────────────────────────────────────────

export async function updateCliente(
  id: number,
  data: {
    nome?: string;
    email?: string | null;
    ativo?: boolean;
    enderecos?: EnderecoUpdateItem[];
  },
) {
  return prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findUnique({ where: { id } });
    if (!cliente) throw new HttpError(404, "Cliente não encontrado.");

    const update: Prisma.ClienteUpdateInput = {};
    if (data.nome !== undefined) update.nome = data.nome;
    if (data.email !== undefined) update.email = validarEmail(data.email);
    if (data.ativo !== undefined) update.ativo = data.ativo;
    if (Object.keys(update).length > 0) {
      await tx.cliente.update({ where: { id }, data: update });
    }

    if (data.enderecos !== undefined && data.enderecos.length > 0) {
      await aplicarEnderecos(tx, id, data.enderecos);
    }

    return tx.cliente.findUnique({
      where: { id },
      include: {
        enderecos: { orderBy: [{ principal: "desc" }, { id: "asc" }] },
      },
    });
  });
}

async function aplicarEnderecos(
  tx: Prisma.TransactionClient,
  clienteId: number,
  itens: EnderecoUpdateItem[],
) {
  for (const item of itens) {
    if (item.remover === true) {
      if (item.id === undefined) {
        throw new HttpError(400, "Para remover um endereço, informe o \"id\".");
      }
      const existente = await tx.endereco.findFirst({
        where: { id: item.id, clienteId },
      });
      if (!existente) {
        throw new HttpError(404, `Endereço ${item.id} não encontrado para este cliente.`);
      }
      await tx.endereco.delete({ where: { id: item.id } });
      continue;
    }

    if (item.id !== undefined) {
      const existente = await tx.endereco.findFirst({
        where: { id: item.id, clienteId },
      });
      if (!existente) {
        throw new HttpError(404, `Endereço ${item.id} não encontrado para este cliente.`);
      }
      const campos = { ...item };
      delete campos.id;
      delete campos.remover;
      await tx.endereco.update({ where: { id: item.id }, data: campos });
      if (item.principal === true) {
        await tx.endereco.updateMany({
          where: { clienteId, NOT: { id: item.id } },
          data: { principal: false },
        });
      }
    } else {
      const novo = parseEnderecoInput(item, "enderecos");
      const criado = await tx.endereco.create({ data: { ...novo, clienteId } });
      if (novo.principal) {
        await tx.endereco.updateMany({
          where: { clienteId, NOT: { id: criado.id } },
          data: { principal: false },
        });
      }
    }
  }

  await reconciliarPrincipal(tx, clienteId);
}

// ─── Inativar cliente (soft delete) ──────────────────────────────────────────

export async function deleteCliente(id: number) {
  await getClienteOrThrow(id);
  return prisma.cliente.update({
    where: { id },
    data: { ativo: false },
  });
}

// ─── Endereços aninhados (CRUD dedicado) ─────────────────────────────────────

export async function listEnderecos(clienteId: number) {
  await getClienteOrThrow(clienteId);
  return prisma.endereco.findMany({
    where: { clienteId },
    orderBy: [{ principal: "desc" }, { id: "asc" }],
  });
}

export async function createEndereco(clienteId: number, input: EnderecoInput) {
  await getClienteOrThrow(clienteId);
  const endereco = await prisma.$transaction(async (tx) => {
    const criado = await tx.endereco.create({ data: { ...input, clienteId } });
    if (input.principal) {
      await tx.endereco.updateMany({
        where: { clienteId, NOT: { id: criado.id } },
        data: { principal: false },
      });
    }
    await reconciliarPrincipal(tx, clienteId);
    return criado;
  });
  return endereco;
}

export async function updateEndereco(
  clienteId: number,
  enderecoId: number,
  input: Partial<EnderecoInput>,
) {
  await getClienteOrThrow(clienteId);
  const endereco = await prisma.endereco.findFirst({
    where: { id: enderecoId, clienteId },
  });
  if (!endereco) throw new HttpError(404, "Endereço não encontrado.");

  await prisma.$transaction(async (tx) => {
    await tx.endereco.update({
      where: { id: enderecoId },
      data: input,
    });
    if (input.principal) {
      await tx.endereco.updateMany({
        where: { clienteId, NOT: { id: enderecoId } },
        data: { principal: false },
      });
    }
    await reconciliarPrincipal(tx, clienteId);
  });

  return prisma.endereco.findUnique({ where: { id: enderecoId } });
}

export async function deleteEndereco(clienteId: number, enderecoId: number) {
  await getClienteOrThrow(clienteId);
  const endereco = await prisma.endereco.findFirst({
    where: { id: enderecoId, clienteId },
  });
  if (!endereco) throw new HttpError(404, "Endereço não encontrado.");

  await prisma.$transaction(async (tx) => {
    await tx.endereco.delete({ where: { id: enderecoId } });
    await reconciliarPrincipal(tx, clienteId);
  });
}
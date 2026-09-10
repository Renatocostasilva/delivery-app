import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";

function isEmPromocao(produto: {
  precoPromocional: Prisma.Decimal | null;
  dataInicioPromocao: Date | null;
  dataFimPromocao: Date | null;
}): boolean {
  if (produto.precoPromocional === null) return false;
  const today = new Date();
  if (
    produto.dataInicioPromocao &&
    today < new Date(produto.dataInicioPromocao)
  )
    return false;
  if (produto.dataFimPromocao && today > new Date(produto.dataFimPromocao))
    return false;
  return true;
}

function parseId(value: string, field = "id"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `${field} inválido.`);
  }
  return id;
}

export type CatalogListParams = {
  busca?: string;
  categoriaId?: number;
  emDestaque?: boolean;
  maisVendido?: boolean;
  page: number;
  pageSize: number;
};

export async function listCategorias() {
  return prisma.categoria.findMany({
    where: { ativa: true },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    select: {
      id: true,
      nome: true,
      slug: true,
      ordem: true,
      _count: { select: { produtos: { where: { ativo: true } } } },
    },
  });
}

export async function listProdutos(params: CatalogListParams) {
  const where: Prisma.ProdutoWhereInput = { ativo: true };
  if (params.busca) {
    where.OR = [
      { nome: { contains: params.busca } },
      { sku: { contains: params.busca } },
    ];
  }
  if (params.categoriaId !== undefined) {
    where.categoriaId = params.categoriaId;
  }
  if (params.emDestaque !== undefined) {
    where.emDestaque = params.emDestaque;
  }
  if (params.maisVendido !== undefined) {
    where.maisVendido = params.maisVendido;
  }

  const [total, data] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      orderBy: [{ ordemExibicao: "asc" }, { id: "desc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        categoria: { select: { id: true, nome: true, slug: true } },
        imagens: {
          where: { principal: true },
          take: 1,
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
        },
      },
    }),
  ]);

  return {
    data,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.ceil(total / params.pageSize),
    },
  };
}

export async function getProduto(idOrSlug: string) {
  const byId = /^\d+$/.test(idOrSlug);
  const produto = await prisma.produto.findUnique({
    where: byId ? { id: parseId(idOrSlug) } : { sku: idOrSlug },
    include: {
      categoria: { select: { id: true, nome: true, slug: true } },
      imagens: { orderBy: [{ ordem: "asc" }, { id: "asc" }] },
      variacoes: {
        where: { ativo: true },
        orderBy: [{ ordem: "asc" }, { id: "asc" }],
      },
      adicionais: {
        where: { ativo: true },
        orderBy: [{ ordem: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!produto || !produto.ativo) {
    throw new HttpError(404, "Produto não encontrado.");
  }
  return { ...produto, emPromocao: isEmPromocao(produto) };
}

export async function getHome() {
  const [categorias, destaques, maisVendidos, promocoes] = await Promise.all([
    prisma.categoria.findMany({
      where: { ativa: true },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: {
        id: true,
        nome: true,
        slug: true,
        ordem: true,
        _count: { select: { produtos: { where: { ativo: true } } } },
      },
    }),
    prisma.produto.findMany({
      where: { ativo: true, emDestaque: true },
      orderBy: [{ ordemExibicao: "asc" }, { id: "desc" }],
      take: 10,
      include: {
        categoria: { select: { id: true, nome: true, slug: true } },
        imagens: {
          where: { principal: true },
          take: 1,
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
        },
      },
    }),
    prisma.produto.findMany({
      where: { ativo: true, maisVendido: true },
      orderBy: [{ ordemExibicao: "asc" }, { id: "desc" }],
      take: 10,
      include: {
        categoria: { select: { id: true, nome: true, slug: true } },
        imagens: {
          where: { principal: true },
          take: 1,
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
        },
      },
    }),
    prisma.produto.findMany({
      where: { ativo: true, precoPromocional: { not: null } },
      orderBy: [{ ordemExibicao: "asc" }, { id: "desc" }],
      take: 10,
      include: {
        categoria: { select: { id: true, nome: true, slug: true } },
        imagens: {
          where: { principal: true },
          take: 1,
          orderBy: [{ ordem: "asc" }, { id: "asc" }],
        },
      },
    }),
  ]);

  return {
    categorias,
    destaques,
    maisVendidos,
    promocoes: promocoes
      .filter(isEmPromocao)
      .map((p) => ({ ...p, emPromocao: true })),
  };
}

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import { slugify } from "../lib/slug.js";

export type ListCategoriasParams = {
  busca?: string;
  ativa?: boolean;
  page: number;
  pageSize: number;
};

async function getCategoriaOrThrow(id: number) {
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) {
    throw new HttpError(404, "Categoria não encontrada.");
  }
  return categoria;
}

async function uniqueSlug(base: string, ignoreId?: number): Promise<string> {
  const baseSlug = slugify(base);
  let candidate = baseSlug;
  let n = 2;
  for (;;) {
    const existing = await prisma.categoria.findUnique({
      where: { slug: candidate },
    });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${baseSlug}-${n}`;
    n += 1;
  }
}

export async function listCategorias(params: ListCategoriasParams) {
  const where: Prisma.CategoriaWhereInput = {};
  if (params.ativa !== undefined) where.ativa = params.ativa;
  if (params.busca) {
    where.OR = [
      { nome: { contains: params.busca } },
      { slug: { contains: params.busca } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.categoria.count({ where }),
    prisma.categoria.findMany({
      where,
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { _count: { select: { produtos: true } } },
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

export async function getCategoria(id: number) {
  await getCategoriaOrThrow(id);
  return prisma.categoria.findUnique({
    where: { id },
    include: {
      produtos: { orderBy: [{ ordemExibicao: "asc" }, { id: "asc" }] },
    },
  });
}

export async function createCategoria(data: {
  nome: string;
  slug?: string;
  ordem?: number;
  ativa?: boolean;
}) {
  const slug =
    data.slug !== undefined
      ? await uniqueSlug(data.slug)
      : await uniqueSlug(data.nome);
  return prisma.categoria.create({
    data: {
      nome: data.nome,
      slug,
      ordem: data.ordem ?? 0,
      ativa: data.ativa ?? true,
    },
  });
}

export async function updateCategoria(
  id: number,
  data: {
    nome?: string;
    slug?: string;
    ordem?: number;
    ativa?: boolean;
  },
) {
  await getCategoriaOrThrow(id);
  const update: Prisma.CategoriaUpdateInput = {};
  if (data.nome === undefined && data.slug !== undefined) {
    update.slug = await uniqueSlug(data.slug, id);
  } else if (data.nome !== undefined) {
    update.nome = data.nome;
    update.slug = await uniqueSlug(data.nome, id);
  }
  if (data.ordem !== undefined) update.ordem = data.ordem;
  if (data.ativa !== undefined) update.ativa = data.ativa;
  return prisma.categoria.update({ where: { id }, data: update });
}

export async function deleteCategoria(id: number): Promise<{
  deleted: boolean;
  inativada: boolean;
}> {
  const categoria = await getCategoriaOrThrow(id);
  const produtos = await prisma.produto.count({
    where: { categoriaId: id },
  });

  if (produtos === 0) {
    await prisma.categoria.delete({ where: { id: categoria.id } });
    return { deleted: true, inativada: false };
  }
  await prisma.categoria.update({
    where: { id: categoria.id },
    data: { ativa: false },
  });
  return { deleted: false, inativada: true };
}
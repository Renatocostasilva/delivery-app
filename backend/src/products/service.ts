import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import type {
  AdicionalPatch,
  ProdutoScalarInput,
  VariacaoPatch,
} from "./validation.js";

export type ListProdutosParams = {
  busca?: string;
  categoriaId?: number;
  ativo?: boolean;
  emDestaque?: boolean;
  maisVendido?: boolean;
  comEstoque?: boolean;
  page: number;
  pageSize: number;
};

async function getProdutoOrThrow(id: number) {
  const produto = await prisma.produto.findUnique({ where: { id } });
  if (!produto) {
    throw new HttpError(404, "Produto não encontrado.");
  }
  return produto;
}

async function assertProdutoExists(id: number) {
  await getProdutoOrThrow(id);
}

async function assertCategoriaExists(id: number) {
  const categoria = await prisma.categoria.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!categoria) {
    throw new HttpError(400, `Categoria ${id} não encontrada.`);
  }
}

export async function listProdutos(params: ListProdutosParams) {
  const where: Prisma.ProdutoWhereInput = {};
  if (params.busca) {
    where.OR = [
      { nome: { contains: params.busca } },
      { sku: { contains: params.busca } },
    ];
  }
  if (params.categoriaId !== undefined) where.categoriaId = params.categoriaId;
  if (params.ativo !== undefined) where.ativo = params.ativo;
  if (params.emDestaque !== undefined) where.emDestaque = params.emDestaque;
  if (params.maisVendido !== undefined) where.maisVendido = params.maisVendido;
  if (params.comEstoque) where.estoqueAtual = { gt: 0 };

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

export async function getProduto(id: number) {
  await getProdutoOrThrow(id);
  return prisma.produto.findUnique({
    where: { id },
    include: {
      categoria: { select: { id: true, nome: true, slug: true } },
      imagens: { orderBy: [{ ordem: "asc" }, { id: "asc" }] },
      variacoes: { orderBy: [{ ordem: "asc" }, { id: "asc" }] },
      adicionais: { orderBy: [{ ordem: "asc" }, { id: "asc" }] },
    },
  });
}

export async function createProduto(
  data: ProdutoScalarInput,
  adminEmail: string,
) {
  await assertCategoriaExists(data.categoriaId!);
  const { nome, sku, categoriaId, precoVenda, ...rest } = data;
  const produto = await prisma.produto.create({
    data: {
      nome: nome!,
      sku: sku!,
      categoriaId: categoriaId!,
      precoVenda: precoVenda!,
      ...rest,
      createdBy: adminEmail,
      updatedBy: adminEmail,
    },
  });
  return getProduto(produto.id);
}

export async function updateProduto(
  id: number,
  data: ProdutoScalarInput,
  adminEmail: string,
) {
  await getProdutoOrThrow(id);
  if (data.categoriaId !== undefined) {
    await assertCategoriaExists(data.categoriaId);
  }
  const { nome, sku, categoriaId, precoVenda, ...rest } = data;
  const update: Prisma.ProdutoUncheckedUpdateInput = {
    ...rest,
    updatedBy: adminEmail,
  };
  if (nome !== undefined) update.nome = nome;
  if (sku !== undefined) update.sku = sku;
  if (categoriaId !== undefined) update.categoriaId = categoriaId;
  if (precoVenda !== undefined) update.precoVenda = precoVenda;
  await prisma.produto.update({ where: { id }, data: update });
  return getProduto(id);
}

export async function deleteProduto(id: number) {
  const produto = await getProdutoOrThrow(id);
  await prisma.produto.update({
    where: { id: produto.id },
    data: { ativo: false },
  });
}

export async function listImagens(produtoId: number) {
  await assertProdutoExists(produtoId);
  return prisma.produtoImagem.findMany({
    where: { produtoId },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
  });
}

export async function addImagem(
  produtoId: number,
  data: { url: string; ordem?: number; principal?: boolean },
) {
  await assertProdutoExists(produtoId);
  const total = await prisma.produtoImagem.count({
    where: { produtoId },
  });
  const principal = data.principal ?? total === 0;
  if (principal) {
    await prisma.produtoImagem.updateMany({
      where: { produtoId, principal: true },
      data: { principal: false },
    });
  }
  return prisma.produtoImagem.create({
    data: {
      produtoId,
      url: data.url,
      ordem: data.ordem ?? total,
      principal,
    },
  });
}

async function getImagemOrThrow(produtoId: number, imagemId: number) {
  const imagem = await prisma.produtoImagem.findFirst({
    where: { id: imagemId, produtoId },
  });
  if (!imagem) {
    throw new HttpError(404, "Imagem não encontrada.");
  }
  return imagem;
}

export async function updateImagem(
  produtoId: number,
  imagemId: number,
  data: { principal?: boolean; ordem?: number },
) {
  const imagem = await getImagemOrThrow(produtoId, imagemId);
  if (data.principal === true) {
    await prisma.produtoImagem.updateMany({
      where: { produtoId, principal: true },
      data: { principal: false },
    });
  }
  return prisma.produtoImagem.update({
    where: { id: imagem.id },
    data: {
      principal: data.principal ?? imagem.principal,
      ...(data.ordem !== undefined ? { ordem: data.ordem } : {}),
    },
  });
}

export async function removeImagem(produtoId: number, imagemId: number) {
  const imagem = await getImagemOrThrow(produtoId, imagemId);
  await prisma.produtoImagem.delete({ where: { id: imagem.id } });
  if (imagem.principal) {
    const next = await prisma.produtoImagem.findFirst({
      where: { produtoId },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
    });
    if (next) {
      await prisma.produtoImagem.update({
        where: { id: next.id },
        data: { principal: true },
      });
    }
  }
}

export async function listVariacoes(produtoId: number) {
  await assertProdutoExists(produtoId);
  return prisma.variacao.findMany({
    where: { produtoId },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
  });
}

export async function createVariacao(
  produtoId: number,
  data: VariacaoPatch,
) {
  await assertProdutoExists(produtoId);
  return prisma.variacao.create({
    data: {
      produtoId,
      nome: data.nome!,
      precoAdicional: data.precoAdicional ?? 0,
      ativo: data.ativo ?? true,
      ordem: data.ordem ?? 0,
    },
  });
}

async function getVariacaoOrThrow(produtoId: number, variacaoId: number) {
  const variacao = await prisma.variacao.findFirst({
    where: { id: variacaoId, produtoId },
  });
  if (!variacao) {
    throw new HttpError(404, "Variação não encontrada.");
  }
  return variacao;
}

export async function updateVariacao(
  produtoId: number,
  variacaoId: number,
  data: VariacaoPatch,
) {
  const variacao = await getVariacaoOrThrow(produtoId, variacaoId);
  const update: Prisma.VariacaoUpdateInput = {};
  if (data.nome !== undefined) update.nome = data.nome;
  if (data.precoAdicional !== undefined) update.precoAdicional = data.precoAdicional;
  if (data.ativo !== undefined) update.ativo = data.ativo;
  if (data.ordem !== undefined) update.ordem = data.ordem;
  return prisma.variacao.update({ where: { id: variacao.id }, data: update });
}

export async function deleteVariacao(produtoId: number, variacaoId: number) {
  const variacao = await getVariacaoOrThrow(produtoId, variacaoId);
  await prisma.variacao.update({
    where: { id: variacao.id },
    data: { ativo: false },
  });
}

export async function listAdicionais(produtoId: number) {
  await assertProdutoExists(produtoId);
  return prisma.adicional.findMany({
    where: { produtoId },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
  });
}

export async function createAdicional(produtoId: number, data: AdicionalPatch) {
  await assertProdutoExists(produtoId);
  return prisma.adicional.create({
    data: {
      produtoId,
      nome: data.nome!,
      precoAdicional: data.precoAdicional ?? 0,
      obrigatorio: data.obrigatorio ?? false,
      quantidadeMinima: data.quantidadeMinima ?? 0,
      quantidadeMaxima: data.quantidadeMaxima ?? 1,
      ativo: data.ativo ?? true,
      ordem: data.ordem ?? 0,
    },
  });
}

async function getAdicionalOrThrow(produtoId: number, adicionalId: number) {
  const adicional = await prisma.adicional.findFirst({
    where: { id: adicionalId, produtoId },
  });
  if (!adicional) {
    throw new HttpError(404, "Adicional não encontrado.");
  }
  return adicional;
}

export async function updateAdicional(
  produtoId: number,
  adicionalId: number,
  data: AdicionalPatch,
) {
  const adicional = await getAdicionalOrThrow(produtoId, adicionalId);
  const update: Prisma.AdicionalUpdateInput = {};
  if (data.nome !== undefined) update.nome = data.nome;
  if (data.precoAdicional !== undefined) update.precoAdicional = data.precoAdicional;
  if (data.obrigatorio !== undefined) update.obrigatorio = data.obrigatorio;
  if (data.quantidadeMinima !== undefined) update.quantidadeMinima = data.quantidadeMinima;
  if (data.quantidadeMaxima !== undefined) update.quantidadeMaxima = data.quantidadeMaxima;
  if (data.ativo !== undefined) update.ativo = data.ativo;
  if (data.ordem !== undefined) update.ordem = data.ordem;
  return prisma.adicional.update({ where: { id: adicional.id }, data: update });
}

export async function deleteAdicional(produtoId: number, adicionalId: number) {
  const adicional = await getAdicionalOrThrow(produtoId, adicionalId);
  await prisma.adicional.update({
    where: { id: adicional.id },
    data: { ativo: false },
  });
}
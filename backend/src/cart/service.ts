/**
 * cart/service.ts — REN-11
 *
 * Toda lógica de negócio do carrinho. Os preços NUNCA vêm do payload
 * do cliente: produto/variação/adicionais são sempre buscados do banco.
 *
 * Frete: taxa fixa configurável via variável de ambiente FRETE_FIXO_CENTAVOS
 * (inteiro em centavos, default 1500 = R$ 15,00). A regra de frete por região
 * será implementada na REN-12 (checkout).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";

// ─── Frete ────────────────────────────────────────────────────────────────────

const FRETE_FIXO_CENTAVOS = parseInt(
  process.env.FRETE_FIXO_CENTAVOS ?? "1500",
  10,
);
export const TAXA_ENTREGA = new Prisma.Decimal(FRETE_FIXO_CENTAVOS).div(100);

// ─── Tipos internos ───────────────────────────────────────────────────────────

export type AdicionalSelecionado = {
  adicionalId: number;
  quantidade: number;
};

/** Linha de adicional calculada (enriquecida com dados do banco). */
export type AdicionalCalculado = {
  adicionalId: number;
  nome: string;
  precoUnitario: Prisma.Decimal;
  quantidade: number;
  subtotal: Prisma.Decimal;
};

/** Item do carrinho enriquecido com preços calculados no servidor. */
export type CartItemCalculado = {
  id: number;
  produtoId: number;
  produtoNome: string;
  variacaoId: number | null;
  variacaoNome: string | null;
  precoBase: Prisma.Decimal;
  precoVariacao: Prisma.Decimal;
  adicionais: AdicionalCalculado[];
  precoUnitario: Prisma.Decimal; // base + variação + adicionais (por unidade)
  quantidade: number;
  subtotal: Prisma.Decimal; // precoUnitario × quantidade
  observacoes: string | null;
  indisponivel: boolean;
  motivoIndisponibilidade: string | null;
};

/** Resposta completa do carrinho (recalculada no servidor). */
export type CartResponse = {
  cartKey: string;
  status: string;
  itens: CartItemCalculado[];
  subtotalProdutos: Prisma.Decimal;
  taxaEntrega: Prisma.Decimal;
  desconto: Prisma.Decimal;
  total: Prisma.Decimal;
  cupom: {
    codigo: string;
    tipo: string;
    valor: Prisma.Decimal;
    aplicavelFrete: boolean;
  } | null;
  itensPendentes: boolean; // true se qualquer item está indisponível
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEmPromocao(produto: {
  precoPromocional: Prisma.Decimal | null;
  dataInicioPromocao: Date | null;
  dataFimPromocao: Date | null;
}): boolean {
  if (!produto.precoPromocional) return false;
  const now = new Date();
  if (produto.dataInicioPromocao && now < produto.dataInicioPromocao)
    return false;
  if (produto.dataFimPromocao && now > produto.dataFimPromocao) return false;
  return true;
}

function precoEfetivo(produto: {
  precoVenda: Prisma.Decimal;
  precoPromocional: Prisma.Decimal | null;
  dataInicioPromocao: Date | null;
  dataFimPromocao: Date | null;
}): Prisma.Decimal {
  return isEmPromocao(produto)
    ? (produto.precoPromocional as Prisma.Decimal)
    : produto.precoVenda;
}

/**
 * Gera uma "chave de identidade" do item para unificação.
 * Dois itens são idênticos se têm mesmo produto+variação+adicionais(ordem
 * não importa, apenas ids e quantidades)+observação.
 */
function itemKey(
  produtoId: number,
  variacaoId: number | null,
  adicionais: AdicionalSelecionado[],
  observacoes: string | null,
): string {
  const ads = [...adicionais]
    .sort((a, b) => a.adicionalId - b.adicionalId)
    .map((a) => `${a.adicionalId}:${a.quantidade}`)
    .join(",");
  return `${produtoId}|${variacaoId ?? ""}|${ads}|${observacoes ?? ""}`;
}

// ─── Busca e validação do produto ─────────────────────────────────────────────

async function buscarProduto(produtoId: number) {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    include: {
      variacoes: { where: { ativo: true } },
      adicionais: { where: { ativo: true } },
    },
  });
  if (!produto || !produto.ativo) {
    throw new HttpError(404, "Produto não encontrado ou inativo.");
  }
  if (!produto.disponivel) {
    throw new HttpError(422, "Produto indisponível para venda.");
  }
  return produto;
}

async function validarAddItem(input: {
  produtoId: number;
  variacaoId?: number | null;
  quantidade: number;
  adicionaisSelecionados: AdicionalSelecionado[];
  observacoes?: string | null;
}) {
  const { produtoId, variacaoId, quantidade, adicionaisSelecionados } = input;

  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new HttpError(400, "Quantidade deve ser um inteiro >= 1.");
  }

  const produto = await buscarProduto(produtoId);

  // Valida variação
  let variacao: { id: number; nome: string; precoAdicional: Prisma.Decimal } | null = null;
  if (variacaoId !== null && variacaoId !== undefined) {
    variacao = produto.variacoes.find((v) => v.id === variacaoId) ?? null;
    if (!variacao) {
      throw new HttpError(
        422,
        "Variação não encontrada, inativa ou não pertence ao produto.",
      );
    }
  }

  // Valida estoque
  if (produto.controlarEstoque && !produto.vendaSemEstoque) {
    if (produto.estoqueAtual < quantidade) {
      throw new HttpError(
        422,
        `Estoque insuficiente. Disponível: ${produto.estoqueAtual}.`,
      );
    }
  }

  // Valida adicionais
  const adicionaisMap = new Map(produto.adicionais.map((a) => [a.id, a]));

  for (const sel of adicionaisSelecionados) {
    const ad = adicionaisMap.get(sel.adicionalId);
    if (!ad) {
      throw new HttpError(
        422,
        `Adicional ${sel.adicionalId} não encontrado, inativo ou não pertence ao produto.`,
      );
    }
    if (sel.quantidade < 1) {
      throw new HttpError(400, `Quantidade do adicional deve ser >= 1.`);
    }
    if (sel.quantidade > ad.quantidadeMaxima) {
      throw new HttpError(
        422,
        `Adicional "${ad.nome}": quantidade máxima é ${ad.quantidadeMaxima}.`,
      );
    }
  }

  // Valida adicionais obrigatórios
  for (const ad of produto.adicionais) {
    if (!ad.obrigatorio || ad.quantidadeMinima === 0) continue;
    const sel = adicionaisSelecionados.find((s) => s.adicionalId === ad.id);
    const qtd = sel?.quantidade ?? 0;
    if (qtd < ad.quantidadeMinima) {
      throw new HttpError(
        422,
        `Adicional "${ad.nome}" é obrigatório (mínimo ${ad.quantidadeMinima}).`,
      );
    }
  }

  return { produto, variacao };
}

// ─── Recálculo do carrinho ────────────────────────────────────────────────────

async function calcularCarrinho(
  cartId: number,
  cupom: {
    codigo: string;
    tipo: string;
    valor: Prisma.Decimal;
    aplicavelFrete: boolean;
  } | null,
): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      itens: { orderBy: { id: "asc" } },
      cupom: true,
    },
  });

  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");

  const itensCalculados: CartItemCalculado[] = [];

  for (const item of cart.itens) {
    // Busca produto atualizado do banco (recalcula sempre)
    const produto = await prisma.produto.findUnique({
      where: { id: item.produtoId },
      include: {
        variacoes: true,
        adicionais: true,
      },
    });

    // Produto removido ou inativo → mantém item com flag
    if (!produto || !produto.ativo) {
      itensCalculados.push({
        id: item.id,
        produtoId: item.produtoId,
        produtoNome: `[Produto removido #${item.produtoId}]`,
        variacaoId: item.variacaoId,
        variacaoNome: null,
        precoBase: new Prisma.Decimal(0),
        precoVariacao: new Prisma.Decimal(0),
        adicionais: [],
        precoUnitario: new Prisma.Decimal(0),
        quantidade: item.quantidade,
        subtotal: new Prisma.Decimal(0),
        observacoes: item.observacoes,
        indisponivel: true,
        motivoIndisponibilidade: "Produto não está mais disponível no catálogo.",
      });
      continue;
    }

    let indisponivel = false;
    let motivoIndisponibilidade: string | null = null;

    if (!produto.disponivel) {
      indisponivel = true;
      motivoIndisponibilidade = "Produto está marcado como indisponível.";
    } else if (
      produto.controlarEstoque &&
      !produto.vendaSemEstoque &&
      produto.estoqueAtual < item.quantidade
    ) {
      indisponivel = true;
      motivoIndisponibilidade = `Estoque insuficiente (disponível: ${produto.estoqueAtual}).`;
    }

    const base = precoEfetivo(produto);

    // Variação
    let variacaoNome: string | null = null;
    let precoVariacao = new Prisma.Decimal(0);
    if (item.variacaoId !== null) {
      const variacao = produto.variacoes.find((v) => v.id === item.variacaoId);
      if (variacao) {
        variacaoNome = variacao.nome;
        precoVariacao = variacao.precoAdicional;
      }
    }

    // Adicionais selecionados (re-busca preços do banco)
    const adicionaisRaw = item.adicionaisSelecionados as AdicionalSelecionado[];
    const adicionaisCalculados: AdicionalCalculado[] = [];

    for (const sel of adicionaisRaw) {
      const ad = produto.adicionais.find((a) => a.id === sel.adicionalId);
      if (ad && ad.ativo) {
        const subtotalAd = ad.precoAdicional.mul(sel.quantidade);
        adicionaisCalculados.push({
          adicionalId: ad.id,
          nome: ad.nome,
          precoUnitario: ad.precoAdicional,
          quantidade: sel.quantidade,
          subtotal: subtotalAd,
        });
      }
      // Adicional removido/inativo: silenciosamente ignorado no cálculo
      // (não duplica erro; o item continua mas sem esse adicional)
    }

    const totalAdicionais = adicionaisCalculados.reduce(
      (acc, a) => acc.plus(a.subtotal),
      new Prisma.Decimal(0),
    );

    const precoUnitario = base.plus(precoVariacao).plus(totalAdicionais);
    const subtotal = precoUnitario.mul(item.quantidade);

    itensCalculados.push({
      id: item.id,
      produtoId: produto.id,
      produtoNome: produto.nome,
      variacaoId: item.variacaoId,
      variacaoNome,
      precoBase: base,
      precoVariacao,
      adicionais: adicionaisCalculados,
      precoUnitario,
      quantidade: item.quantidade,
      subtotal,
      observacoes: item.observacoes,
      indisponivel,
      motivoIndisponibilidade,
    });
  }

  const subtotalProdutos = itensCalculados.reduce(
    (acc, i) => acc.plus(i.indisponivel ? 0 : i.subtotal),
    new Prisma.Decimal(0),
  );

  // Cupom ativo no carrinho (usa o do banco, não o passado como parâmetro)
  const cupomAtivo = cart.cupom
    ? {
        codigo: cart.cupom.codigo,
        tipo: cart.cupom.tipo,
        valor: cart.cupom.valor,
        aplicavelFrete: cart.cupom.aplicavelFrete,
      }
    : cupom;

  let desconto = new Prisma.Decimal(0);
  let taxaEntregaFinal = TAXA_ENTREGA;

  if (cupomAtivo) {
    if (cupomAtivo.tipo === "PORCENTAGEM") {
      // Desconto sobre produtos
      desconto = subtotalProdutos.mul(cupomAtivo.valor).div(100);
      if (cupomAtivo.aplicavelFrete) {
        taxaEntregaFinal = taxaEntregaFinal.mul(
          new Prisma.Decimal(1).minus(cupomAtivo.valor.div(100)),
        );
      }
    } else {
      // FIXO: desconto do valor fixo (limitado ao subtotal)
      const descontoBase = Prisma.Decimal.min(
        cupomAtivo.valor,
        subtotalProdutos,
      );
      desconto = descontoBase;
      if (cupomAtivo.aplicavelFrete) {
        const descontoFrete = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          cupomAtivo.valor.minus(descontoBase),
        );
        taxaEntregaFinal = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          TAXA_ENTREGA.minus(descontoFrete),
        );
      }
    }
  }

  // Garante que total não seja negativo
  const total = Prisma.Decimal.max(
    new Prisma.Decimal(0),
    subtotalProdutos.minus(desconto).plus(taxaEntregaFinal),
  );

  return {
    cartKey: cart.cartKey,
    status: cart.status,
    itens: itensCalculados,
    subtotalProdutos,
    taxaEntrega: taxaEntregaFinal,
    desconto,
    total,
    cupom: cupomAtivo,
    itensPendentes: itensCalculados.some((i) => i.indisponivel),
  };
}

// ─── Funções públicas do serviço ──────────────────────────────────────────────

export async function criarCarrinho(): Promise<{ cartKey: string }> {
  const cart = await prisma.cart.create({ data: {} });
  return { cartKey: cart.cartKey };
}

export async function getCarrinho(cartKey: string): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  return calcularCarrinho(cart.id, null);
}

export async function adicionarItem(
  cartKey: string,
  input: {
    produtoId: number;
    variacaoId?: number | null;
    quantidade: number;
    adicionaisSelecionados?: AdicionalSelecionado[];
    observacoes?: string | null;
  },
): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  if (cart.status !== "ATIVO") {
    throw new HttpError(409, "Carrinho não está mais ativo.");
  }

  const adicionais = input.adicionaisSelecionados ?? [];
  await validarAddItem({
    produtoId: input.produtoId,
    variacaoId: input.variacaoId,
    quantidade: input.quantidade,
    adicionaisSelecionados: adicionais,
    observacoes: input.observacoes,
  });

  // Unificação: verifica se já existe item idêntico
  const itensExistentes = await prisma.cartItem.findMany({
    where: { cartId: cart.id },
  });

  const novaChave = itemKey(
    input.produtoId,
    input.variacaoId ?? null,
    adicionais,
    input.observacoes ?? null,
  );

  const itemExistente = itensExistentes.find((i) => {
    const existKey = itemKey(
      i.produtoId,
      i.variacaoId,
      i.adicionaisSelecionados as AdicionalSelecionado[],
      i.observacoes,
    );
    return existKey === novaChave;
  });

  if (itemExistente) {
    // Unifica: incrementa quantidade
    const novaQtd = itemExistente.quantidade + input.quantidade;

    // Revalida estoque com nova quantidade
    const produto = await prisma.produto.findUniqueOrThrow({
      where: { id: input.produtoId },
    });
    if (
      produto.controlarEstoque &&
      !produto.vendaSemEstoque &&
      produto.estoqueAtual < novaQtd
    ) {
      throw new HttpError(
        422,
        `Estoque insuficiente para ${novaQtd} unidades. Disponível: ${produto.estoqueAtual}.`,
      );
    }

    await prisma.cartItem.update({
      where: { id: itemExistente.id },
      data: { quantidade: novaQtd },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        produtoId: input.produtoId,
        variacaoId: input.variacaoId ?? null,
        quantidade: input.quantidade,
        adicionaisSelecionados: adicionais,
        observacoes: input.observacoes ?? null,
      },
    });
  }

  return calcularCarrinho(cart.id, null);
}

export async function alterarQuantidade(
  cartKey: string,
  itemId: number,
  quantidade: number,
): Promise<CartResponse> {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new HttpError(400, "Quantidade deve ser um inteiro >= 1.");
  }

  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  if (cart.status !== "ATIVO") {
    throw new HttpError(409, "Carrinho não está mais ativo.");
  }

  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cart.id) {
    throw new HttpError(404, "Item não encontrado neste carrinho.");
  }

  // Valida estoque com nova quantidade
  const produto = await prisma.produto.findUniqueOrThrow({
    where: { id: item.produtoId },
  });
  if (
    produto.controlarEstoque &&
    !produto.vendaSemEstoque &&
    produto.estoqueAtual < quantidade
  ) {
    throw new HttpError(
      422,
      `Estoque insuficiente. Disponível: ${produto.estoqueAtual}.`,
    );
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantidade },
  });

  return calcularCarrinho(cart.id, null);
}

export async function editarItem(
  cartKey: string,
  itemId: number,
  input: {
    quantidade?: number;
    adicionaisSelecionados?: AdicionalSelecionado[];
    observacoes?: string | null;
  },
): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  if (cart.status !== "ATIVO") {
    throw new HttpError(409, "Carrinho não está mais ativo.");
  }

  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cart.id) {
    throw new HttpError(404, "Item não encontrado neste carrinho.");
  }

  const novaQtd = input.quantidade ?? item.quantidade;
  const novosAdicionais =
    input.adicionaisSelecionados ??
    (item.adicionaisSelecionados as AdicionalSelecionado[]);
  const novasObs =
    input.observacoes !== undefined ? input.observacoes : item.observacoes;

  // Revalida completo com os novos valores
  await validarAddItem({
    produtoId: item.produtoId,
    variacaoId: item.variacaoId,
    quantidade: novaQtd,
    adicionaisSelecionados: novosAdicionais,
    observacoes: novasObs,
  });

  await prisma.cartItem.update({
    where: { id: itemId },
    data: {
      quantidade: novaQtd,
      adicionaisSelecionados: novosAdicionais,
      observacoes: novasObs ?? null,
    },
  });

  return calcularCarrinho(cart.id, null);
}

export async function removerItem(
  cartKey: string,
  itemId: number,
): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  if (cart.status !== "ATIVO") {
    throw new HttpError(409, "Carrinho não está mais ativo.");
  }

  const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
  if (!item || item.cartId !== cart.id) {
    throw new HttpError(404, "Item não encontrado neste carrinho.");
  }

  await prisma.cartItem.delete({ where: { id: itemId } });
  return calcularCarrinho(cart.id, null);
}

export async function limparCarrinho(cartKey: string): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  if (cart.status !== "ATIVO") {
    throw new HttpError(409, "Carrinho não está mais ativo.");
  }

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  // Remove cupom aplicado ao limpar
  await prisma.cart.update({
    where: { id: cart.id },
    data: { cupomId: null },
  });
  return calcularCarrinho(cart.id, null);
}

export async function aplicarCupom(
  cartKey: string,
  codigo: string,
): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  if (cart.status !== "ATIVO") {
    throw new HttpError(409, "Carrinho não está mais ativo.");
  }

  const agora = new Date();
  const cupom = await prisma.cupom.findUnique({
    where: { codigo: codigo.trim().toUpperCase() },
  });

  if (!cupom || !cupom.ativo) {
    throw new HttpError(422, "Cupom inválido ou inativo.");
  }
  if (cupom.dataInicio && agora < cupom.dataInicio) {
    throw new HttpError(422, "Cupom ainda não está válido.");
  }
  if (cupom.dataFim && agora > cupom.dataFim) {
    throw new HttpError(422, "Cupom expirado.");
  }
  if (cupom.usoMaximo !== null && cupom.usoAtual >= cupom.usoMaximo) {
    throw new HttpError(422, "Cupom atingiu o limite de uso.");
  }

  // Aplica cupom ao carrinho
  await prisma.cart.update({
    where: { id: cart.id },
    data: { cupomId: cupom.id },
  });

  return calcularCarrinho(cart.id, null);
}

export async function removerCupom(cartKey: string): Promise<CartResponse> {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");

  await prisma.cart.update({
    where: { id: cart.id },
    data: { cupomId: null },
  });

  return calcularCarrinho(cart.id, null);
}

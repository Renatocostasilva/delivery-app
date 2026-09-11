/**
 * orders/service.ts — REN-12
 *
 * Checkout em etapas + criação do pedido. O total é sempre recalculado
 * no servidor a partir do carrinho (nunca confia no preço enviado pelo
 * cliente). O Pedido nasce em AGUARDANDO_PAGAMENTO, com um Pagamento
 * associado em INICIADO (gateway mercadopago, sem integração real — REN-13).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import * as v from "../lib/validate.js";
import { getCarrinho, TAXA_ENTREGA } from "../cart/service.js";
import { findOrCreateClient } from "../clients/service.js";
import {
  criarPagamento,
  findPagamentoByIdempotencyKey,
} from "../payments/service.js";

export type TipoEntrega = "RETIRADA" | "ENTREGA";

export type EnderecoSnapshot = {
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  cep: string;
  referencia: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gerarNumeroPedido(): string {
  const data = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PED-${data}-${rand}`;
}

function validarTipoEntrega(value: unknown): TipoEntrega {
  const tipo = v.text(value, "tipoEntrega", { required: true }) as string;
  if (tipo !== "RETIRADA" && tipo !== "ENTREGA") {
    throw new HttpError(400, 'tipoEntrega deve ser "RETIRADA" ou "ENTREGA".');
  }
  return tipo;
}

function validarEndereco(value: unknown): EnderecoSnapshot | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, 'Campo "endereco" deve ser um objeto.');
  }
  const e = value as Record<string, unknown>;

  const logradouro = v.text(e.logradouro, "endereco.logradouro", {
    required: true,
  }) as string;
  const numero = v.text(e.numero, "endereco.numero", { required: true }) as string;
  const bairro = v.text(e.bairro, "endereco.bairro", {
    required: true,
  }) as string;
  const cidade = v.text(e.cidade, "endereco.cidade", {
    required: true,
  }) as string;
  const cepRaw = v.text(e.cep, "endereco.cep", { required: true }) as string;

  const cep = cepRaw.replace(/\D/g, "");
  if (cep.length !== 8) {
    throw new HttpError(400, "CEP deve ter 8 dígitos.");
  }

  const complemento = v.nullString(e.complemento, "endereco.complemento");
  const referencia = v.nullString(e.referencia, "endereco.referencia");

  return {
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    cep,
    referencia,
  };
}

/** Carrega o carrinho e valida se está pronto para checkout (não cria nada). */
async function validarCarrinhoParaCheckout(cartKey: string) {
  const cart = await prisma.cart.findUnique({ where: { cartKey } });
  if (!cart) throw new HttpError(404, "Carrinho não encontrado.");
  if (cart.status !== "ATIVO") {
    throw new HttpError(409, "Carrinho não está mais ativo.");
  }

  const carrinho = await getCarrinho(cartKey);
  if (carrinho.itens.length === 0) {
    throw new HttpError(422, "Carrinho vazio. Adicione itens antes de finalizar.");
  }
  if (carrinho.itensPendentes) {
    throw new HttpError(
      422,
      "Existem itens indisponíveis no carrinho. Revise os itens antes de finalizar.",
    );
  }

  return { cart, carrinho };
}

function taxaEntregaPara(tipoEntrega: TipoEntrega): Prisma.Decimal {
  return tipoEntrega === "RETIRADA"
    ? new Prisma.Decimal(0)
    : TAXA_ENTREGA;
}

// ─── Etapa 1: identificação ───────────────────────────────────────────────────

/**
 * Valida os dados do cliente e persiste (find-or-create pelo telefone).
 */
export async function identificarCliente(input: {
  cartKey: string;
  nome: string;
  telefone: string;
}) {
  await validarCarrinhoParaCheckout(input.cartKey);

  const nome = v.text(input.nome, "nome", { required: true }) as string;
  const telefone = v.text(input.telefone, "telefone", {
    required: true,
  }) as string;

  const cliente = await findOrCreateClient(nome, telefone);

  return { cliente };
}

// ─── Etapa 2: entrega ─────────────────────────────────────────────────────────

/**
 * Valida a opção de entrega e devolve a taxa aplicável. Retirada é grátis;
 * entrega usa a taxa fixa configurada (FRETE_FIXO_CENTAVOS).
 */
export async function definirEntrega(input: {
  cartKey: string;
  tipoEntrega: string;
  endereco?: unknown;
}) {
  const { carrinho } = await validarCarrinhoParaCheckout(input.cartKey);

  const tipoEntrega = validarTipoEntrega(input.tipoEntrega);
  const endereco = validarEndereco(input.endereco);

  if (tipoEntrega === "ENTREGA" && !endereco) {
    throw new HttpError(
      400,
      "Endereço é obrigatório para entrega (logradouro, numero, bairro, cidade, cep).",
    );
  }
  if (tipoEntrega === "RETIRADA" && endereco) {
    throw new HttpError(400, "Endereço não deve ser informado para retirada.");
  }

  return {
    cartKey: carrinho.cartKey,
    tipoEntrega,
    endereco: endereco ?? null,
    taxaEntrega: taxaEntregaPara(tipoEntrega),
  };
}

// ─── Etapa 3: resumo ──────────────────────────────────────────────────────────

/**
 * Recalcula o total do pedido a partir do carrinho (preços sempre do banco),
 * aplicando a taxa de entrega conforme o tipo de entrega escolhido.
 */
export async function resumoPedido(input: {
  cartKey: string;
  tipoEntrega: string;
}) {
  const { carrinho } = await validarCarrinhoParaCheckout(input.cartKey);

  const tipoEntrega = validarTipoEntrega(input.tipoEntrega);
  const taxaEntrega = taxaEntregaPara(tipoEntrega);

  const total = Prisma.Decimal.max(
    new Prisma.Decimal(0),
    carrinho.subtotalProdutos.minus(carrinho.desconto).plus(taxaEntrega),
  );

  return {
    cartKey: carrinho.cartKey,
    itens: carrinho.itens,
    subtotalProdutos: carrinho.subtotalProdutos,
    taxaEntrega,
    desconto: carrinho.desconto,
    total,
    cupom: carrinho.cupom,
    itensPendentes: carrinho.itensPendentes,
  };
}

// ─── Etapa 4: confirmação (cria pedido + itens + pagamento) ───────────────────

/**
 * Confirma o pedido: cria Cliente (find-or-create), Pedido com estado
 * AGUARDANDO_PAGAMENTO, ItemPedido para cada item do carrinho e Pagamento
 * INICIADO (gateway mercadopago). Marca o carrinho como CONVERTIDO.
 *
 * Idempotência: se o mesmo idempotencyKey já gerou um pagamento, devolve
 * o pedido existente em vez de criar outro. Reenvio do mesmo cartKey após
 * conversão também é bloqueado (409).
 */
export async function confirmarPedido(input: {
  cartKey: string;
  idempotencyKey: string;
  nome: string;
  telefone: string;
  tipoEntrega: string;
  endereco?: unknown;
  observacoes?: string | null;
  formaPagamento?: string;
}) {
  // 1. Idempotência: reenvio com a mesma chave devolve o pedido criado
  const pagamentoExistente = await findPagamentoByIdempotencyKey(
    input.idempotencyKey,
  );
  if (pagamentoExistente) {
    return { pedido: pagamentoExistente.pedido, jaExistia: true };
  }

  const { cart, carrinho } = await validarCarrinhoParaCheckout(input.cartKey);

  const nome = v.text(input.nome, "nome", { required: true }) as string;
  const telefone = v.text(input.telefone, "telefone", {
    required: true,
  }) as string;
  const tipoEntrega = validarTipoEntrega(input.tipoEntrega);
  const endereco = validarEndereco(input.endereco);
  const observacoes = v.nullString(input.observacoes, "observacoes");

  const FORMAS_VALIDAS = [
    "PIX",
    "DINHEIRO",
    "CARTAO_CREDITO",
    "CARTAO_DEBITO",
  ] as const;
  const formaPagamento = (input.formaPagamento ?? "PIX") as
    | (typeof FORMAS_VALIDAS)[number]
    | string;
  if (!FORMAS_VALIDAS.includes(formaPagamento as (typeof FORMAS_VALIDAS)[number])) {
    throw new HttpError(
      400,
      `Campo \"formaPagamento\" deve ser uma das opções: ${FORMAS_VALIDAS.join(", ")}.`,
    );
  }
  const ehDinheiro = formaPagamento === "DINHEIRO";

  if (tipoEntrega === "ENTREGA" && !endereco) {
    throw new HttpError(
      400,
      "Endereço é obrigatório para entrega (logradouro, numero, bairro, cidade, cep).",
    );
  }
  if (tipoEntrega === "RETIRADA" && endereco) {
    throw new HttpError(400, "Endereço não deve ser informado para retirada.");
  }

  const cliente = await findOrCreateClient(nome, telefone);

  const taxaEntrega = taxaEntregaPara(tipoEntrega);
  const total = Prisma.Decimal.max(
    new Prisma.Decimal(0),
    carrinho.subtotalProdutos.minus(carrinho.desconto).plus(taxaEntrega),
  );

  const numeroPedido = gerarNumeroPedido();

  const pedido = await prisma.$transaction(async (tx) => {
    const criado = await tx.pedido.create({
      data: {
        numeroPedido,
        clienteId: cliente.id,
        statusPedido: ehDinheiro ? "RECEBIDO" : "AGUARDANDO_PAGAMENTO",
        statusPagamento: ehDinheiro ? "PENDENTE" : "INICIADO",
        formaPagamento,
        tipoEntrega,
        enderecoSnapshot: endereco ?? undefined,
        taxasEntrega: taxaEntrega,
        desconto: carrinho.desconto,
        totalProdutos: carrinho.subtotalProdutos,
        total,
        observacoes,
      },
    });

    for (const item of carrinho.itens) {
      await tx.itemPedido.create({
        data: {
          pedidoId: criado.id,
          produtoId: item.produtoId,
          produtoNome: item.produtoNome,
          variacaoNome: item.variacaoNome,
          quantidade: item.quantidade,
          precoUnitario: item.precoBase.plus(item.precoVariacao),
          adicionais: item.adicionais.length
            ? item.adicionais.map((a) => ({
                nome: a.nome,
                preco: a.precoUnitario.toNumber(),
                quantidade: a.quantidade,
              }))
            : undefined,
          observacoes: item.observacoes,
          total: item.subtotal,
        },
      });
    }

    if (ehDinheiro) {
      // Dinheiro: sem gateway. Registra um Pagamento local "PENDENTE" (pago na
      // entrega/retirada), preservando idempotência e o painel do admin.
      await tx.pagamento.create({
        data: {
          pedidoId: criado.id,
          gateway: "dinheiro",
          meioPagamento: "dinheiro",
          estadoPagamento: "PENDENTE",
          valor: total,
          idempotencyKey: input.idempotencyKey,
        },
      });
    } else {
      await criarPagamento(criado.id, total, input.idempotencyKey, tx);
    }

    await tx.cart.update({
      where: { id: cart.id },
      data: { status: "CONVERTIDO" },
    });

    if (cart.cupomId) {
      await tx.cupom.update({
        where: { id: cart.cupomId },
        data: { usoAtual: { increment: 1 } },
      });
    }

    return tx.pedido.findUniqueOrThrow({
      where: { id: criado.id },
      include: {
        cliente: true,
        itens: true,
        pagamentos: true,
      },
    });
  });

  return { pedido, jaExistia: false };
}

export { TAXA_ENTREGA };
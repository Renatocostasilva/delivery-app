/**
 * payments/service.ts — REN-12
 *
 * Registro de pagamentos. A integração real com o gateway (ex.: Stone,
 * Mercado Pago) é responsabilidade da REN-13 — aqui apenas criamos o
 * registro Pagamento associado ao pedido com estado INICIADO.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const GATEWAY_DEFAULT = "mercadopago";

type DbLike = Prisma.TransactionClient | typeof prisma;

/**
 * Cria o registro de pagamento para um pedido.
 * `idempotencyKey` é única por cobrança para evitar duplicidade.
 * Aceita um client de transação (`tx`) para participar de `$transaction`.
 */
export async function criarPagamento(
  pedidoId: number,
  valor: Prisma.Decimal,
  idempotencyKey: string,
  db: DbLike = prisma,
) {
  return db.pagamento.create({
    data: {
      pedidoId,
      valor,
      idempotencyKey,
      gateway: GATEWAY_DEFAULT,
      estadoPagamento: "INICIADO",
    },
  });
}

/**
 * Busca pagamento pela idempotencyKey (inclusive o pedido associado).
 * Usado para retornar o pedido já criado em reenvios idempotentes.
 */
export async function findPagamentoByIdempotencyKey(idempotencyKey: string) {
  return prisma.pagamento.findUnique({
    where: { idempotencyKey },
    include: { pedido: true },
  });
}
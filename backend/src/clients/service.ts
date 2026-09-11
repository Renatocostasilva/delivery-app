/**
 * clients/service.ts — REN-12
 *
 * Persistência de clientes. Base única do cliente é o telefone,
 * normalizado em E.164: +55DDDNÚMERO (ex.: +5511999998888).
 */

import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";

/**
 * Normaliza telefone brasileiro para E.164 (+55DDDNÚMERO).
 * Aceita "+5511999998888", "(11) 99999-8888", "11999998888", etc.
 */
export function normalizarTelefone(raw: string): string {
  const digitos = raw.replace(/\D/g, "");
  const semCodigoPais = digitos.startsWith("55") ? digitos.slice(2) : digitos;

  if (semCodigoPais.length < 10 || semCodigoPais.length > 11) {
    throw new HttpError(
      400,
      "Telefone inválido. Informe DDD + número (10 ou 11 dígitos).",
    );
  }

  if (semCodigoPais.length === 11 && semCodigoPais[2] !== "9") {
    throw new HttpError(
      400,
      "Telefone inválido. Para celular com 11 dígitos, o número deve começar com 9.",
    );
  }

  return `+55${semCodigoPais}`;
}

/**
 * Busca cliente pelo telefone normalizado ou cria se não existir.
 * Atualiza o nome caso o cliente já exista com nome diferente.
 */
export async function findOrCreateClient(nome: string, telefone: string) {
  const telefoneNormalizado = normalizarTelefone(telefone);

  const existente = await prisma.cliente.findUnique({
    where: { telefone: telefoneNormalizado },
  });

  if (existente) {
    if (existente.nome !== nome) {
      return prisma.cliente.update({
        where: { id: existente.id },
        data: { nome },
      });
    }
    return existente;
  }

  return prisma.cliente.create({
    data: { nome, telefone: telefoneNormalizado },
  });
}
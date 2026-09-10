import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/http.js";
import {
  booleanField,
  dateField,
  decimalField,
  intField,
  nullString,
  text,
} from "../lib/validate.js";

export type ProdutoScalarInput = {
  nome?: string;
  sku?: string;
  categoriaId?: number;
  subcategoria?: string | null;
  descricaoCurta?: string | null;
  descricaoCompleta?: string | null;
  ativo?: boolean;
  emDestaque?: boolean;
  maisVendido?: boolean;
  ordemExibicao?: number;
  disponivel?: boolean;
  controlarEstoque?: boolean;
  vendaSemEstoque?: boolean;
  pesoVolume?: Prisma.Decimal;
  ingredientes?: string | null;
  observacoesInfo?: string | null;
  precoVenda?: Prisma.Decimal;
  precoPromocional?: Prisma.Decimal;
  custo?: Prisma.Decimal;
  margem?: Prisma.Decimal;
  dataInicioPromocao?: Date;
  dataFimPromocao?: Date;
  estoqueAtual?: number;
  estoqueMinimo?: number;
  avisoEstoqueBaixo?: boolean;
};

export type VariacaoInput = {
  nome: string;
  precoAdicional?: number;
  ativo?: boolean;
  ordem?: number;
};

export type VariacaoPatch = Partial<VariacaoInput>;

export type AdicionalInput = {
  nome: string;
  precoAdicional?: number;
  obrigatorio?: boolean;
  quantidadeMinima?: number;
  quantidadeMaxima?: number;
  ativo?: boolean;
  ordem?: number;
};

export type AdicionalPatch = Partial<AdicionalInput>;

export function parseProdutoInput(
  body: Record<string, unknown>,
  mode: "create" | "update",
): ProdutoScalarInput {
  const required = mode === "create";
  const out: ProdutoScalarInput = {};

  const nome = text(body.nome, "nome", { required });
  if (nome !== undefined) out.nome = nome;

  const sku = text(body.sku, "sku", { required });
  if (sku !== undefined) out.sku = sku;

  const categoriaId = intField(body.categoriaId, "categoriaId", {
    required,
    min: 1,
  });
  if (categoriaId !== undefined) out.categoriaId = categoriaId;

  const precoVenda = decimalField(body.precoVenda, "precoVenda", {
    required,
    min: 0,
  });
  if (precoVenda !== undefined) out.precoVenda = precoVenda;

  for (const campo of [
    "subcategoria",
    "descricaoCurta",
    "descricaoCompleta",
    "ingredientes",
    "observacoesInfo",
  ] as const) {
    if (campo in body) {
      out[campo] = nullString(body[campo], campo);
    }
  }

  for (const campo of [
    "ativo",
    "emDestaque",
    "maisVendido",
    "disponivel",
    "controlarEstoque",
    "vendaSemEstoque",
    "avisoEstoqueBaixo",
  ] as const) {
    const value = booleanField(body[campo], campo);
    if (value !== undefined) out[campo] = value;
  }

  for (const campo of ["ordemExibicao", "estoqueAtual", "estoqueMinimo"] as const) {
    const value = intField(body[campo], campo, { min: 0 });
    if (value !== undefined) out[campo] = value;
  }

  for (const campo of [
    "precoPromocional",
    "custo",
    "margem",
    "pesoVolume",
  ] as const) {
    const value = decimalField(body[campo], campo, { min: 0 });
    if (value !== undefined) out[campo] = value;
  }

  for (const campo of ["dataInicioPromocao", "dataFimPromocao"] as const) {
    const value = dateField(body[campo], campo);
    if (value !== undefined) out[campo] = value;
  }

  return out;
}

export function parseVariacaoInput(
  body: Record<string, unknown>,
  mode: "create" | "update",
): VariacaoPatch {
  const out: VariacaoPatch = {};
  const nome = text(body.nome, "nome", {
    required: mode === "create",
  });
  if (nome !== undefined) out.nome = nome;

  if (body.precoAdicional !== undefined) {
    const preco = decimalField(body.precoAdicional, "precoAdicional", {
      min: 0,
    });
    if (preco !== undefined) out.precoAdicional = preco.toNumber();
  }
  const ativo = booleanField(body.ativo, "ativo");
  if (ativo !== undefined) out.ativo = ativo;
  const ordem = intField(body.ordem, "ordem", { min: 0 });
  if (ordem !== undefined) out.ordem = ordem;
  return out;
}

export function parseAdicionalInput(
  body: Record<string, unknown>,
  mode: "create" | "update",
): AdicionalPatch {
  const out: AdicionalPatch = {};
  const nome = text(body.nome, "nome", {
    required: mode === "create",
  });
  if (nome !== undefined) out.nome = nome;

  if (body.precoAdicional !== undefined) {
    const preco = decimalField(body.precoAdicional, "precoAdicional", {
      min: 0,
    });
    if (preco !== undefined) out.precoAdicional = preco.toNumber();
  }
  const obrigatorio = booleanField(body.obrigatorio, "obrigatorio");
  if (obrigatorio !== undefined) out.obrigatorio = obrigatorio;
  const quantidadeMinima = intField(body.quantidadeMinima, "quantidadeMinima", {
    min: 0,
  });
  if (quantidadeMinima !== undefined) out.quantidadeMinima = quantidadeMinima;
  const quantidadeMaxima = intField(body.quantidadeMaxima, "quantidadeMaxima", {
    min: 0,
  });
  if (quantidadeMaxima !== undefined) out.quantidadeMaxima = quantidadeMaxima;
  const ativo = booleanField(body.ativo, "ativo");
  if (ativo !== undefined) out.ativo = ativo;
  const ordem = intField(body.ordem, "ordem", { min: 0 });
  if (ordem !== undefined) out.ordem = ordem;

  if (
    out.quantidadeMinima !== undefined &&
    out.quantidadeMaxima !== undefined &&
    out.quantidadeMaxima < out.quantidadeMinima
  ) {
    throw new HttpError(
      400,
      "Campo \"quantidadeMaxima\" deve ser maior ou igual a \"quantidadeMinima\".",
    );
  }
  return out;
}
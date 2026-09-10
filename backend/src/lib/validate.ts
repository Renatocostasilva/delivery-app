import { Prisma } from "@prisma/client";
import { HttpError } from "./http.js";

type FieldOpts = { required?: boolean; min?: number; max?: number };

export function text(
  value: unknown,
  field: string,
  opts: FieldOpts = {},
): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.required) {
      throw new HttpError(400, `Campo "${field}" é obrigatório.`);
    }
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `Campo "${field}" deve ser texto.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new HttpError(400, `Campo "${field}" é obrigatório.`);
  }
  if (opts.max !== undefined && trimmed.length > opts.max) {
    throw new HttpError(
      400,
      `Campo "${field}" deve ter no máximo ${opts.max} caracteres.`,
    );
  }
  return trimmed;
}

export function nullString(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new HttpError(400, `Campo "${field}" deve ser texto.`);
  }
  return value.trim();
}

export function booleanField(
  value: unknown,
  field: string,
  opts: { required?: boolean } = {},
): boolean | undefined {
  if (value === undefined || value === null) {
    if (opts.required) {
      throw new HttpError(400, `Campo "${field}" é obrigatório.`);
    }
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new HttpError(400, `Campo "${field}" deve ser booleano.`);
  }
  return value;
}

export function intField(
  value: unknown,
  field: string,
  opts: FieldOpts = {},
): number | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.required) {
      throw new HttpError(400, `Campo "${field}" é obrigatório.`);
    }
    return undefined;
  }
  if (typeof value === "boolean") {
    throw new HttpError(400, `Campo "${field}" deve ser um número inteiro.`);
  }
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || (opts.min !== undefined && n < opts.min)) {
    throw new HttpError(
      400,
      `Campo "${field}" deve ser um número inteiro${opts.min !== undefined ? ` maior ou igual a ${opts.min}` : ""}.`,
    );
  }
  return n;
}

export function decimalField(
  value: unknown,
  field: string,
  opts: FieldOpts = {},
): Prisma.Decimal | undefined {
  if (value === undefined || value === null || value === "") {
    if (opts.required) {
      throw new HttpError(400, `Campo "${field}" é obrigatório.`);
    }
    return undefined;
  }
  if (typeof value === "boolean") {
    throw new HttpError(400, `Campo "${field}" deve ser um número válido.`);
  }
  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(String(value));
  } catch {
    throw new HttpError(400, `Campo "${field}" deve ser um número válido.`);
  }
  if (!decimal.isFinite()) {
    throw new HttpError(400, `Campo "${field}" deve ser um número válido.`);
  }
  if (opts.min !== undefined && decimal.lt(opts.min)) {
    throw new HttpError(
      400,
      `Campo "${field}" deve ser maior ou igual a ${opts.min}.`,
    );
  }
  return decimal;
}

export function dateField(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new HttpError(400, `Campo "${field}" deve ser uma data válida.`);
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Campo "${field}" deve ser uma data válida.`);
  }
  return date;
}
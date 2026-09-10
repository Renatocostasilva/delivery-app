import { HttpError } from "./http.js";

export function optionalQueryText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

export function optionalQueryInt(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new HttpError(400, `Parâmetro "${field}" deve ser um inteiro.`);
  }
  return n;
}

export function optionalQueryBool(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new HttpError(400, `Parâmetro "${field}" deve ser true ou false.`);
}

export function pagination(params: {
  page?: unknown;
  pageSize?: unknown;
}): { page: number; pageSize: number } {
  const page = optionalQueryInt(params.page, "page") ?? 1;
  const rawSize = optionalQueryInt(params.pageSize, "pageSize") ?? 20;
  const pageSize = Math.min(rawSize, 100);
  if (page < 1 || pageSize < 1) {
    throw new HttpError(400, "Parâmetros page/pageSize devem ser >= 1.");
  }
  return { page, pageSize };
}
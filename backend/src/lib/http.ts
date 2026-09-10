import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function parseIdParam(value: string, field = "id"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `${field} inválido.`);
  }
  return id;
}

export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res
        .status(409)
        .json({ error: "Já existe um registro com esse valor único." });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Registro não encontrado." });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
};
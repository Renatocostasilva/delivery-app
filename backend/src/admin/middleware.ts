import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import { verifyToken } from "./tokens.js";

export type AdminAuth = {
  id: number;
  email: string;
  nome: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminAuth;
    }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      throw new HttpError(401, "Token de autenticação ausente.");
    }
    const payload = await verifyToken(token);
    if (!payload) {
      throw new HttpError(401, "Token inválido ou expirado.");
    }
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.id },
    });
    if (!admin || !admin.ativo) {
      throw new HttpError(401, "Acesso negado.");
    }
    req.admin = { id: admin.id, email: admin.email, nome: admin.nome };
    next();
  } catch (err) {
    next(err);
  }
};
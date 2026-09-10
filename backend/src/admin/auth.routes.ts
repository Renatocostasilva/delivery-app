import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";
import { text } from "../lib/validate.js";
import { comparePassword } from "./password.js";
import { signToken } from "./tokens.js";
import { requireAuth } from "./middleware.js";

export const authRouter: Router = Router();

authRouter.post("/login", async (req, res) => {
  const body = req.body ?? {};
  const email = text(body.email, "email", { required: true });
  const senha = text(body.senha, "senha", { required: true });

  const admin = await prisma.adminUser.findUnique({
    where: { email: email!.toLowerCase() },
  });
  if (!admin || !admin.ativo || !(await comparePassword(senha!, admin.senhaHash))) {
    throw new HttpError(401, "E-mail ou senha inválidos.");
  }

  const token = await signToken({
    id: admin.id,
    email: admin.email,
    nome: admin.nome,
  });
  res.json({
    token,
    admin: { id: admin.id, email: admin.email, nome: admin.nome },
  });
});

authRouter.post("/logout", requireAuth, (_req, res) => {
  res.status(204).end();
});
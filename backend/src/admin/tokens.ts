import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret, JWT_EXPIRES_IN } from "../lib/env.js";

export type AdminTokenPayload = {
  id: number;
  email: string;
  nome: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

export async function signToken(admin: AdminTokenPayload): Promise<string> {
  return new SignJWT({ email: admin.email, nome: admin.nome })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(admin.id))
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secretKey());
}

export async function verifyToken(
  token: string,
): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || typeof payload.email !== "string") {
      return null;
    }
    return {
      id,
      email: payload.email,
      nome: typeof payload.nome === "string" ? payload.nome : "",
    };
  } catch {
    return null;
  }
}
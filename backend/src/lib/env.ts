export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET é obrigatório em produção.");
  }
  return "dev-only-secret-nao-usar-em-producao";
}

export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "8h";
import { hash, compare } from "bcryptjs";

const SALT_ROUNDS = 10;

export function hashPassword(senha: string): Promise<string> {
  return hash(senha, SALT_ROUNDS);
}

export function comparePassword(
  senha: string,
  senhaHash: string,
): Promise<boolean> {
  return compare(senha, senhaHash);
}
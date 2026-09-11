import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

export default function setup() {
  const backendRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );

  // Cada execução parte de um banco limpo: dados residuais de runs anteriores
  // em test.db tornavam os testes não-determinísticos (flakiness intermitente:
  // colunas/estado antigos, 401 que virava 200, etc.). `prisma migrate deploy`
  // só aplica migrações pendentes e NÃO apaga registros preexistentes.
  for (const f of ["test.db", "test.db-journal"]) {
    rmSync(path.join(backendRoot, "prisma", f), { force: true });
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}
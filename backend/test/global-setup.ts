import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export default function setup() {
  const backendRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
}
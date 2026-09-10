import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { app } from "./app.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://localhost:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

describe("GET /health", () => {
  it("returns status ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
  });
});

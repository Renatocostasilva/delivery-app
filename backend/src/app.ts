import express from "express";
import type { Express } from "express";

export const app: Express = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

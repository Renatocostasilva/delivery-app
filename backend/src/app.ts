import express from "express";
import cors from "cors";
import type { Express } from "express";
import { authRouter } from "./admin/auth.routes.js";
import { ordersAdminRouter } from "./admin/orders.routes.js";
import { dashboardAdminRouter } from "./admin/dashboard.routes.js";
import { catalogRouter } from "./catalog/routes.js";
import { categoriesAdminRouter } from "./categories/index.js";
import { productsAdminRouter } from "./products/index.js";
import { cartRouter } from "./cart/routes.js";
import { checkoutRouter } from "./orders/routes.js";
import { paymentsRouter } from "./payments/routes.js";
import { apiNotFound, errorHandler } from "./lib/http.js";

export const app: Express = express();

app.use(express.json());
app.use(cors({ origin: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/catalog", catalogRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/payments", paymentsRouter);

app.use("/api/admin/auth", authRouter);
app.use("/api/admin/orders", ordersAdminRouter);
app.use("/api/admin/dashboard", dashboardAdminRouter);
app.use("/api/admin/categories", categoriesAdminRouter);
app.use("/api/admin/products", productsAdminRouter);

app.use(apiNotFound);
app.use(errorHandler);
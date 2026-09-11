import { Router } from "express";
import { requireAuth } from "./middleware.js";
import * as dashboardService from "./dashboard.service.js";

export const dashboardAdminRouter: Router = Router();

dashboardAdminRouter.use(requireAuth);

dashboardAdminRouter.get("/", async (req, res) => {
  const dataInicio = req.query.dataInicio ? new Date(String(req.query.dataInicio)) : undefined;
  const dataFim = req.query.dataFim ? new Date(String(req.query.dataFim)) : undefined;

  const result = await dashboardService.getDashboard({ dataInicio, dataFim });
  res.json(result);
});

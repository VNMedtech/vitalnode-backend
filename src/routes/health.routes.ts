/**
 * Health and readiness probes for load balancers and orchestrators.
 */
import { Router } from "express";
import { prisma } from "../infrastructure/prisma/client.js";
import { logger } from "../infrastructure/logger/logger.js";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

healthRouter.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (error) {
    logger.error({ err: error }, "Readiness check failed");
    res.status(503).json({ status: "not_ready" });
  }
});

/**
 * @openapi
 * tags:
 *   - name: Health
 *     description: Liveness and readiness probes
 */
import { Router } from "express";
import { prisma } from "../infrastructure/prisma/client.js";
import { logger } from "../infrastructure/logger/logger.js";

export const healthRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Returns ok when the process is running.
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 */
healthRouter.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/**
 * @openapi
 * /ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     description: Checks database connectivity before marking the service ready.
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ready }
 *       503:
 *         description: Service is not ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: not_ready }
 */
healthRouter.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ready" });
  } catch (error) {
    logger.error({ err: error }, "Readiness check failed");
    res.status(503).json({ status: "not_ready" });
  }
});

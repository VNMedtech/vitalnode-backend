import express, { type Express } from "express";
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  errorHandler,
} from "../../src/middlewares/index.js";
import { permissions } from "../../src/shared/permissions/rbac.permissions.js";
import { successResponse } from "../../src/shared/responses/api.response.js";

let cachedTestApp: Express | undefined;

/**
 * Wraps the production Express app with test-only routes used to assert
 * seller approval restrictions without modifying production routers.
 */
export async function getTestApp(): Promise<Express> {
  if (cachedTestApp) {
    return cachedTestApp;
  }

  const { app: baseApp } = await import("../../src/app.js");

  const sellerProbeRouter = Router();
  sellerProbeRouter.post(
    "/test/seller-operational",
    authenticate,
    authorizePermission(permissions.products.create),
    (_req, res) => {
      res
        .status(200)
        .json(successResponse({ ok: true }, "Seller operational access granted"));
    },
  );

  const testApp = express();
  testApp.use("/api/v1", sellerProbeRouter);
  testApp.use(baseApp);
  testApp.use(errorHandler);

  cachedTestApp = testApp;
  return testApp;
}

/**
 * @openapi
 * tags:
 *   - name: Sales Reports
 *     description: Seller and admin sales reporting
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  requireApprovedSeller,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import { salesReportsController } from "../controllers/sales-reports.controller.js";
import {
  platformSalesReportQuerySchema,
  sellerOrdersSummaryQuerySchema,
  sellerRevenueSummaryQuerySchema,
  sellerSalesReportQuerySchema,
  sellerSalesSummaryQuerySchema,
} from "../validators/query.schema.js";

export const salesReportsRouter = Router();

/**
 * @openapi
 * /api/v1/sales-reports/summary:
 *   get:
 *     tags: [Sales Reports]
 *     summary: Seller sales summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sales summary fetched successfully
 */
salesReportsRouter.get(
  "/summary",
  authenticate,
  authorizePermission(permissions.salesReports.read),
  requireApprovedSeller,
  validate({ query: sellerSalesSummaryQuerySchema }),
  salesReportsController.getSellerSalesSummary,
);

/**
 * @openapi
 * /api/v1/sales-reports/orders:
 *   get:
 *     tags: [Sales Reports]
 *     summary: Seller orders summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders summary fetched successfully
 */
salesReportsRouter.get(
  "/orders",
  authenticate,
  authorizePermission(permissions.salesReports.read),
  requireApprovedSeller,
  validate({ query: sellerOrdersSummaryQuerySchema }),
  salesReportsController.getSellerOrdersSummary,
);

/**
 * @openapi
 * /api/v1/sales-reports/revenue:
 *   get:
 *     tags: [Sales Reports]
 *     summary: Seller revenue summary
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue summary fetched successfully
 */
salesReportsRouter.get(
  "/revenue",
  authenticate,
  authorizePermission(permissions.salesReports.read),
  requireApprovedSeller,
  validate({ query: sellerRevenueSummaryQuerySchema }),
  salesReportsController.getSellerRevenueSummary,
);

export const adminSalesReportsRouter = Router();

/**
 * @openapi
 * /api/v1/analytics/sales:
 *   get:
 *     tags: [Analytics]
 *     summary: Platform sales report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform sales report fetched successfully
 */
adminSalesReportsRouter.get(
  "/sales",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: platformSalesReportQuerySchema }),
  salesReportsController.getPlatformSalesReport,
);

/**
 * @openapi
 * /api/v1/analytics/sales/sellers:
 *   get:
 *     tags: [Analytics]
 *     summary: Seller sales report
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seller sales report fetched successfully
 */
adminSalesReportsRouter.get(
  "/sales/sellers",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: sellerSalesReportQuerySchema }),
  salesReportsController.listSellerSalesReport,
);

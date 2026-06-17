/**
 * @openapi
 * tags:
 *   - name: Analytics
 *     description: Admin analytics and reporting
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import { analyticsController } from "../controllers/analytics.controller.js";
import {
  dashboardQuerySchema,
  inventoryAlertsQuerySchema,
  orderStatisticsQuerySchema,
  productStatisticsQuerySchema,
  revenueStatisticsQuerySchema,
  sellerStatisticsQuerySchema,
  userStatisticsQuerySchema,
} from "../validators/query.schema.js";

export const analyticsRouter = Router();

/**
 * @openapi
 * /api/v1/analytics/dashboard:
 *   get:
 *     tags: [Analytics]
 *     summary: Dashboard summary
 *     description: Admin-only KPI snapshot across users, products, orders, revenue, and inventory.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin only
 */
analyticsRouter.get(
  "/dashboard",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: dashboardQuerySchema }),
  analyticsController.getDashboardSummary,
);

/**
 * @openapi
 * /api/v1/analytics/users:
 *   get:
 *     tags: [Analytics]
 *     summary: User statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: User statistics fetched successfully
 */
analyticsRouter.get(
  "/users",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: userStatisticsQuerySchema }),
  analyticsController.getUserStatistics,
);

/**
 * @openapi
 * /api/v1/analytics/sellers:
 *   get:
 *     tags: [Analytics]
 *     summary: Seller statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Seller statistics fetched successfully
 */
analyticsRouter.get(
  "/sellers",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: sellerStatisticsQuerySchema }),
  analyticsController.getSellerStatistics,
);

/**
 * @openapi
 * /api/v1/analytics/products:
 *   get:
 *     tags: [Analytics]
 *     summary: Product statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Product statistics fetched successfully
 */
analyticsRouter.get(
  "/products",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: productStatisticsQuerySchema }),
  analyticsController.getProductStatistics,
);

/**
 * @openapi
 * /api/v1/analytics/orders:
 *   get:
 *     tags: [Analytics]
 *     summary: Order statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Order statistics fetched successfully
 */
analyticsRouter.get(
  "/orders",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: orderStatisticsQuerySchema }),
  analyticsController.getOrderStatistics,
);

/**
 * @openapi
 * /api/v1/analytics/revenue:
 *   get:
 *     tags: [Analytics]
 *     summary: Revenue statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Revenue statistics fetched successfully
 */
analyticsRouter.get(
  "/revenue",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: revenueStatisticsQuerySchema }),
  analyticsController.getRevenueStatistics,
);

/**
 * @openapi
 * /api/v1/analytics/inventory-alerts:
 *   get:
 *     tags: [Analytics]
 *     summary: Inventory alerts
 *     description: Paginated low-stock and out-of-stock products across the marketplace.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: alertStatus
 *         schema:
 *           type: string
 *           enum: [ALL, LOW_STOCK, OUT_OF_STOCK]
 *           default: ALL
 *     responses:
 *       200:
 *         description: Inventory alerts fetched successfully
 */
analyticsRouter.get(
  "/inventory-alerts",
  authenticate,
  authorizePermission(permissions.analytics.read),
  validate({ query: inventoryAlertsQuerySchema }),
  analyticsController.listInventoryAlerts,
);

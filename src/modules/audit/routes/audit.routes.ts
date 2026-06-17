/**
 * @openapi
 * tags:
 *   - name: Audit
 *     description: Admin audit log read APIs
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import { auditController } from "../controllers/audit.controller.js";
import { auditLogParamsSchema } from "../validators/params.schema.js";
import { listAuditLogsQuerySchema } from "../validators/query.schema.js";

export const auditRouter = Router();

/**
 * @openapi
 * /api/v1/audit-logs:
 *   get:
 *     tags: [Audit]
 *     summary: List audit logs
 *     description: Admin-only list endpoint with pagination, date range, actor filtering, and entity filtering.
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
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: actorUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityType
 *         schema: { type: string }
 *       - in: query
 *         name: entityId
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audit logs fetched successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
auditRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.auditLogs.read),
  validate({ query: listAuditLogsQuerySchema }),
  auditController.listAuditLogs,
);

/**
 * @openapi
 * /api/v1/audit-logs/{id}:
 *   get:
 *     tags: [Audit]
 *     summary: Audit log details
 *     description: Admin-only audit log details by id.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Audit log fetched successfully
 *       404:
 *         description: Audit log not found
 */
auditRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.auditLogs.read),
  validate({ params: auditLogParamsSchema }),
  auditController.getAuditLogDetails,
);


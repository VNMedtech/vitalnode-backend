/**
 * auditLogs — auditLogger.util
 * Convenience wrapper for creating audit log entries from any service.
 *
 * Audit logging must not leak sensitive values (passwords, tokens).
 */
import { prisma } from "../../../infrastructure/prisma/client.js";
import { logger } from "../../../infrastructure/logger/logger.js";

export interface AuditLogEntryInput {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}

export const auditLogger = {
  log(entry: AuditLogEntryInput): void {
    void prisma.auditLog
      .create({
        data: {
          actorUserId: entry.actorUserId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: entry.metadata as never,
        },
        select: { id: true },
      })
      .catch((err) => {
        logger.error(
          {
            message: err instanceof Error ? err.message : "Unknown error",
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            actorUserId: entry.actorUserId,
          },
          "Failed to write audit log",
        );
      });
  },
};

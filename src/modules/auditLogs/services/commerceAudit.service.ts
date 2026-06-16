import type { TxClient } from "../../../shared/transactions/transaction.types.js";

export interface CommerceAuditEntryInput {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export async function recordCommerceAudit(
  tx: TxClient,
  entry: CommerceAuditEntryInput,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: entry.actorUserId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata as never,
    },
  });
}

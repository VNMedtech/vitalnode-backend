import type { AuditLog } from "../../../../generated/prisma/client.js";
import type { AuditActorDto, AuditLogDetailsDto, AuditLogListItemDto } from "../types/audit.types.js";

export type AuditLogWithActor = AuditLog & {
  actor: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
};

function toActorDto(actor: AuditLogWithActor["actor"]): AuditActorDto {
  return {
    id: actor.id,
    email: actor.email,
    firstName: actor.firstName,
    lastName: actor.lastName,
  };
}

export function toAuditLogListItemDto(record: AuditLogWithActor): AuditLogListItemDto {
  return {
    id: record.id,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    createdAt: record.createdAt.toISOString(),
    actor: toActorDto(record.actor),
  };
}

export function toAuditLogDetailsDto(record: AuditLogWithActor): AuditLogDetailsDto {
  return {
    ...toAuditLogListItemDto(record),
    metadata: record.metadata ?? null,
  };
}


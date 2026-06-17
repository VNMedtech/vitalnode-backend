import { prisma } from "../../../infrastructure/prisma/client.js";
import { NotFoundError } from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import {
  toAuditLogDetailsDto,
  toAuditLogListItemDto,
} from "../dto/audit.dto.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import type {
  AuditLogDetailsDto,
  AuditLogListItemDto,
} from "../types/audit.types.js";
import type { ListAuditLogsQueryInput } from "../validators/query.schema.js";

export class AuditService {
  private readonly auditRepo = new AuditRepository(prisma);

  async listAuditLogs(query: ListAuditLogsQueryInput): Promise<{
    items: AuditLogListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const [records, total] = await Promise.all([
      this.auditRepo.findAuditLogs({
        page: query.page,
        limit: query.limit,
        from: query.from,
        to: query.to,
        actorUserId: query.actorUserId,
        entityType: query.entityType,
        entityId: query.entityId,
        action: query.action,
      }),
      this.auditRepo.countAuditLogs({
        from: query.from,
        to: query.to,
        actorUserId: query.actorUserId,
        entityType: query.entityType,
        entityId: query.entityId,
        action: query.action,
      }),
    ]);

    return {
      items: records.map(toAuditLogListItemDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getAuditLogDetails(id: string): Promise<AuditLogDetailsDto> {
    const record = await this.auditRepo.findAuditLogById(id);
    if (!record) {
      throw new NotFoundError("Audit log not found");
    }
    return toAuditLogDetailsDto(record);
  }
}


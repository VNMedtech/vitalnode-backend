import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { AuditLogWithActor } from "../dto/audit.dto.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface AuditLogListFilter {
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
}

function buildCreatedAtFilter(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  if (!from && !to) {
    return undefined;
  }

  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    filter.gte = from;
  }
  if (to) {
    filter.lte = to;
  }
  return filter;
}

export class AuditRepository {
  constructor(private readonly db: DbClient) {}

  private selectWithActor = {
    id: true,
    actorUserId: true,
    action: true,
    entityType: true,
    entityId: true,
    metadata: true,
    createdAt: true,
    actor: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    },
  } as const;

  async findAuditLogs(filter: AuditLogListFilter): Promise<AuditLogWithActor[]> {
    const skip = (filter.page - 1) * filter.limit;
    const createdAt = buildCreatedAtFilter(filter.from, filter.to);

    return this.db.auditLog.findMany({
      where: {
        ...(createdAt ? { createdAt } : {}),
        ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.entityId ? { entityId: filter.entityId } : {}),
        ...(filter.action ? { action: filter.action } : {}),
      },
      select: this.selectWithActor,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: filter.limit,
    }) as unknown as AuditLogWithActor[];
  }

  async countAuditLogs(filter: Omit<AuditLogListFilter, "page" | "limit">): Promise<number> {
    const createdAt = buildCreatedAtFilter(filter.from, filter.to);

    return this.db.auditLog.count({
      where: {
        ...(createdAt ? { createdAt } : {}),
        ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
        ...(filter.entityType ? { entityType: filter.entityType } : {}),
        ...(filter.entityId ? { entityId: filter.entityId } : {}),
        ...(filter.action ? { action: filter.action } : {}),
      },
    });
  }

  async findAuditLogById(id: string): Promise<AuditLogWithActor | null> {
    return this.db.auditLog.findUnique({
      where: { id },
      select: this.selectWithActor,
    }) as unknown as AuditLogWithActor | null;
  }
}


import {
  IdempotencyKeyStatus,
  type Prisma,
  type PrismaClient,
} from "../../../generated/prisma/client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface IdempotencyKeyRecord {
  id: string;
  key: string;
  actorUserId: string;
  route: string;
  requestHash: string | null;
  responseBody: Prisma.JsonValue | null;
  status: IdempotencyKeyStatus;
  expiresAt: Date;
}

export class IdempotencyRepository {
  constructor(private readonly db: DbClient) {}

  findByActorKeyRoute(
    actorUserId: string,
    key: string,
    route: string,
  ): Promise<IdempotencyKeyRecord | null> {
    return this.db.idempotencyKey.findUnique({
      where: {
        actorUserId_key_route: {
          actorUserId,
          key,
          route,
        },
      },
    });
  }

  createProcessing(input: {
    actorUserId: string;
    key: string;
    route: string;
    requestHash?: string;
    expiresAt: Date;
  }) {
    return this.db.idempotencyKey.create({
      data: {
        actorUserId: input.actorUserId,
        key: input.key,
        route: input.route,
        requestHash: input.requestHash ?? null,
        status: IdempotencyKeyStatus.PROCESSING,
        expiresAt: input.expiresAt,
      },
    });
  }

  markCompleted(id: string, responseBody: unknown) {
    return this.db.idempotencyKey.update({
      where: { id },
      data: {
        status: IdempotencyKeyStatus.COMPLETED,
        responseBody: responseBody as Prisma.InputJsonValue,
      },
    });
  }

  markFailed(id: string) {
    return this.db.idempotencyKey.update({
      where: { id },
      data: {
        status: IdempotencyKeyStatus.FAILED,
      },
    });
  }
}

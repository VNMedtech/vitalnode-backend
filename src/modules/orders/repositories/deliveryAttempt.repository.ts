import {
  DeliveryAttemptStatus,
  FulfillmentMethod,
  type Prisma,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const deliveryAttemptSelect = {
  id: true,
  orderId: true,
  attemptNumber: true,
  method: true,
  deliveryPartnerId: true,
  carrier: true,
  awb: true,
  trackingUrl: true,
  status: true,
  failureReason: true,
  failedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeliveryAttemptSelect;

export type DeliveryAttemptRecord = Prisma.DeliveryAttemptGetPayload<{
  select: typeof deliveryAttemptSelect;
}>;

export type DeliveryAttemptSnapshotInput = {
  orderId: string;
  method: FulfillmentMethod;
  deliveryPartnerId?: string | null;
  carrier?: string | null;
  awb?: string | null;
  trackingUrl?: string | null;
};

export class DeliveryAttemptRepository {
  constructor(private readonly db: DbClient) {}

  findCurrentInProgress(orderId: string) {
    return this.db.deliveryAttempt.findFirst({
      where: {
        orderId,
        status: DeliveryAttemptStatus.IN_PROGRESS,
      },
      orderBy: { attemptNumber: "desc" },
      select: deliveryAttemptSelect,
    });
  }

  async nextAttemptNumber(orderId: string): Promise<number> {
    const latest = await this.db.deliveryAttempt.findFirst({
      where: { orderId },
      orderBy: { attemptNumber: "desc" },
      select: { attemptNumber: true },
    });
    return (latest?.attemptNumber ?? 0) + 1;
  }

  createInProgress(input: DeliveryAttemptSnapshotInput & { attemptNumber: number }) {
    return this.db.deliveryAttempt.create({
      data: {
        orderId: input.orderId,
        attemptNumber: input.attemptNumber,
        method: input.method,
        deliveryPartnerId: input.deliveryPartnerId ?? null,
        carrier: input.carrier ?? null,
        awb: input.awb ?? null,
        trackingUrl: input.trackingUrl ?? null,
        status: DeliveryAttemptStatus.IN_PROGRESS,
      },
      select: deliveryAttemptSelect,
    });
  }

  async markFailed(input: {
    orderId: string;
    failureReason: string | null;
  }) {
    const current = await this.findCurrentInProgress(input.orderId);
    if (!current) {
      return null;
    }

    return this.db.deliveryAttempt.update({
      where: { id: current.id },
      data: {
        status: DeliveryAttemptStatus.FAILED,
        failureReason: input.failureReason,
        failedAt: new Date(),
      },
      select: deliveryAttemptSelect,
    });
  }

  async markDelivered(orderId: string) {
    const current = await this.findCurrentInProgress(orderId);
    if (!current) {
      return null;
    }

    return this.db.deliveryAttempt.update({
      where: { id: current.id },
      data: {
        status: DeliveryAttemptStatus.DELIVERED,
      },
      select: deliveryAttemptSelect,
    });
  }

  supersedeOpen(orderId: string) {
    return this.db.deliveryAttempt.updateMany({
      where: {
        orderId,
        status: DeliveryAttemptStatus.IN_PROGRESS,
      },
      data: {
        status: DeliveryAttemptStatus.SUPERSEDED,
      },
    });
  }

  /**
   * Idempotent ship hook: create attempt #1 when none exist; otherwise refresh
   * the current IN_PROGRESS snapshot from live shipment logistics.
   */
  async ensureAttemptOnShip(input: DeliveryAttemptSnapshotInput) {
    const current = await this.findCurrentInProgress(input.orderId);
    if (current) {
      return this.db.deliveryAttempt.update({
        where: { id: current.id },
        data: {
          method: input.method,
          deliveryPartnerId: input.deliveryPartnerId ?? null,
          carrier: input.carrier ?? null,
          awb: input.awb ?? null,
          trackingUrl: input.trackingUrl ?? null,
        },
        select: deliveryAttemptSelect,
      });
    }

    const attemptNumber = await this.nextAttemptNumber(input.orderId);
    return this.createInProgress({
      ...input,
      attemptNumber,
    });
  }
}

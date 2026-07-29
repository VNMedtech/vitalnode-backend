import { describe, expect, it } from "vitest";
import { OrderStatus, PaymentStatus } from "../../../generated/prisma/client.js";
import { runExpirePendingOrdersSweep } from "../../../src/jobs/cleanup/expirePendingOrders.job.js";
import { env } from "../../../src/config/env.js";
import { ORDER_ACTIONS } from "../../../src/modules/orders/constants/order.constants.js";
import { OrderCancellationService } from "../../../src/modules/orders/services/orderCancellation.service.js";
import {
  ensureSystemActorUser,
  setupPaidPaymentOrder,
  setupPendingPaymentOrder,
  TEST_SYSTEM_ACTOR_USER_ID,
} from "../../factories/payment.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { useOrdersTestLifecycle } from "./setup.js";

const MINUTE_MS = 60 * 1000;

async function backdateOrderCreatedAt(
  orderId: string,
  ageMs: number,
): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.order.update({
    where: { id: orderId },
    data: { createdAt: new Date(Date.now() - ageMs) },
  });
}

describe("expirePendingOrders cleanup", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("job cancels stale PENDING_PAYMENT orders past the TTL", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    const ttlMs = env.pendingPaymentTtlMinutes * MINUTE_MS;
    await backdateOrderCreatedAt(context.orderId, ttlMs + 5 * MINUTE_MS);

    await runExpirePendingOrdersSweep();

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: context.orderId },
      include: { payment: true },
    });

    expect(order.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(order.payment?.paymentStatus).toBe(PaymentStatus.FAILED);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: context.orderId,
        action: ORDER_ACTIONS.CANCELLED,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(TEST_SYSTEM_ACTOR_USER_ID);
    const metadata = audit?.metadata as Record<string, unknown> | null;
    expect(metadata?.expiredUnpaid).toBe(true);
    expect(metadata?.abandonedUnpaid).toBe(true);
    expect(String(metadata?.reason ?? "")).toMatch(/^Expired:/);
  });

  it("job keeps PENDING_PAYMENT orders within the TTL", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPendingPaymentOrder(app, prisma);

    await runExpirePendingOrdersSweep();

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: context.orderId },
      include: { payment: true },
    });

    expect(order.orderStatus).toBe(OrderStatus.PENDING_PAYMENT);
    expect(order.payment?.paymentStatus).toBe(PaymentStatus.PENDING);
  });

  it("job does not cancel PLACED orders even when older than the TTL", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupPaidPaymentOrder(app, prisma);

    const ttlMs = env.pendingPaymentTtlMinutes * MINUTE_MS;
    await backdateOrderCreatedAt(context.orderId, ttlMs + 60 * MINUTE_MS);

    await runExpirePendingOrdersSweep();

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: context.orderId },
    });

    expect(order.orderStatus).toBe(OrderStatus.PLACED);
  });

  it("service cancels only stale orders and reports counts", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await ensureSystemActorUser(prisma);

    const stale = await setupPendingPaymentOrder(app, prisma);
    const fresh = await setupPendingPaymentOrder(app, prisma);

    await backdateOrderCreatedAt(stale.orderId, 45 * MINUTE_MS);

    const service = new OrderCancellationService();
    const result = await service.expireStalePendingPaymentOrders({
      actorUserId: TEST_SYSTEM_ACTOR_USER_ID,
      olderThanMs: 30 * MINUTE_MS,
      limit: 50,
    });

    expect(result).toEqual({ scanned: 1, cancelled: 1, failed: 0 });

    const staleOrder = await prisma.order.findUniqueOrThrow({
      where: { id: stale.orderId },
      include: { payment: true },
    });
    const freshOrder = await prisma.order.findUniqueOrThrow({
      where: { id: fresh.orderId },
      include: { payment: true },
    });

    expect(staleOrder.orderStatus).toBe(OrderStatus.CANCELLED);
    expect(staleOrder.payment?.paymentStatus).toBe(PaymentStatus.FAILED);
    expect(freshOrder.orderStatus).toBe(OrderStatus.PENDING_PAYMENT);
    expect(freshOrder.payment?.paymentStatus).toBe(PaymentStatus.PENDING);
  });

  it("service respects the batch limit", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await ensureSystemActorUser(prisma);

    const first = await setupPendingPaymentOrder(app, prisma);
    const second = await setupPendingPaymentOrder(app, prisma);
    const third = await setupPendingPaymentOrder(app, prisma);

    await Promise.all(
      [first, second, third].map((ctx) =>
        backdateOrderCreatedAt(ctx.orderId, 45 * MINUTE_MS),
      ),
    );

    const service = new OrderCancellationService();
    const result = await service.expireStalePendingPaymentOrders({
      actorUserId: TEST_SYSTEM_ACTOR_USER_ID,
      olderThanMs: 30 * MINUTE_MS,
      limit: 2,
    });

    expect(result.scanned).toBe(2);
    expect(result.cancelled).toBe(2);
    expect(result.failed).toBe(0);

    const remainingPending = await prisma.order.count({
      where: { orderStatus: OrderStatus.PENDING_PAYMENT },
    });
    expect(remainingPending).toBe(1);
  });
});

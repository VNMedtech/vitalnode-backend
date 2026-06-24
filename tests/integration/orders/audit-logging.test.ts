import { describe, expect, it } from "vitest";
import { ORDER_ACTIONS } from "../../../src/modules/orders/constants/order.constants.js";
import {
  setupAssignedOrder,
  setupDeliveredOrder,
  setupOrderTestContext,
} from "../../factories/order.factory.js";
import { cancelOrderPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 10: Audit Logging", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("records ORDER_PLACED audit on payment fulfillment", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "ORDER_PLACED",
        entityId: context.orderId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.entityType).toBe("ORDER");
  });

  it("records DELIVERY_PARTNER_ASSIGNED audit on admin assignment", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: ORDER_ACTIONS.DELIVERY_PARTNER_ASSIGNED,
        entityId: context.orderId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBeTruthy();
  });

  it("records ORDER_STATUS_CHANGED audit through fulfillment", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupDeliveredOrder(app, prisma);

    const statusAudits = await prisma.auditLog.findMany({
      where: {
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityId: context.orderId,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(statusAudits.length).toBeGreaterThanOrEqual(3);

    const newStatuses = statusAudits.map(
      (a) => (a.metadata as Record<string, unknown>)?.newStatus,
    );
    expect(newStatuses).toEqual(
      expect.arrayContaining(["PROCESSING", "OUT_FOR_DELIVERY", "PENDING_SETTLEMENT"]),
    );
  });

  it("records ORDER_CANCELLED audit when buyer cancels", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId, { reason: "Audit cancel test" }),
      newIdempotencyKey("audit-cancel"),
    );

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: ORDER_ACTIONS.CANCELLED,
        entityId: context.orderId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(context.buyerAuth.user.id);
  });

  it("records proof upload audit entries", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupDeliveredOrder(app, prisma);

    const handoverAudit = await prisma.auditLog.findFirst({
      where: {
        action: ORDER_ACTIONS.HANDOVER_PROOF_UPLOADED,
        entityId: context.orderId,
      },
    });
    expect(handoverAudit).not.toBeNull();

    const deliveryAudit = await prisma.auditLog.findFirst({
      where: {
        action: ORDER_ACTIONS.DELIVERY_PROOF_UPLOADED,
        entityId: context.orderId,
      },
    });
    expect(deliveryAudit).not.toBeNull();
  });

  it("records INVENTORY_DEDUCTED and INVENTORY_RESTORED on cancel", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId),
      newIdempotencyKey("audit-inventory"),
    );

    const deducted = await prisma.auditLog.findFirst({
      where: { action: "INVENTORY_DEDUCTED" },
    });
    expect(deducted).not.toBeNull();

    const restored = await prisma.auditLog.findFirst({
      where: { action: "INVENTORY_RESTORED" },
    });
    expect(restored).not.toBeNull();
  });
});

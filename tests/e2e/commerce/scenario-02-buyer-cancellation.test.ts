import { describe, expect, it } from "vitest";
import { ORDER_ACTIONS } from "../../../src/modules/orders/constants/order.constants.js";
import { setupOrderTestContext } from "../../factories/order.factory.js";
import { cancelOrderPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 2: Buyer Cancellation", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("cancels a paid order and restores inventory, initiates refund, and records audit logs", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const inventoryBefore = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(inventoryBefore?.availableQuantity).toBe(48);

    const cancelRes = await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId, { reason: "Buyer changed mind" }),
      newIdempotencyKey("e2e-buyer-cancel"),
    );

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.orderStatus).toBe("CANCELLED");

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("CANCELLED");

    // Inventory restored
    const inventoryAfter = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(inventoryAfter?.availableQuantity).toBe(50);

    const restoreMovement = await prisma.inventoryMovement.findFirst({
      where: {
        referenceId: context.orderId,
        movementType: "ORDER_RESTORE",
      },
    });
    expect(restoreMovement?.quantityChanged).toBe(2);

    // Refund initiated
    const payment = await prisma.payment.findUnique({
      where: { orderId: context.orderId },
    });
    expect(payment?.refundStatus).toBe("PENDING");

    const refundAudit = await prisma.auditLog.findFirst({
      where: {
        action: "REFUND_INITIATED",
        entityId: payment?.id,
      },
    });
    expect(refundAudit).not.toBeNull();

    // Cancellation audit
    const cancelAudit = await prisma.auditLog.findFirst({
      where: {
        action: ORDER_ACTIONS.CANCELLED,
        entityId: context.orderId,
      },
    });
    expect(cancelAudit).not.toBeNull();
    expect(cancelAudit?.actorUserId).toBe(context.buyerAuth.user.id);

    const inventoryRestoredAudit = await prisma.auditLog.findFirst({
      where: { action: "INVENTORY_RESTORED" },
    });
    expect(inventoryRestoredAudit).not.toBeNull();
  });
});

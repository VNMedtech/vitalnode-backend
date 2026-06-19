import { describe, expect, it } from "vitest";
import { ORDER_ACTIONS } from "../../../src/modules/orders/constants/order.constants.js";
import { setupOrderTestContext } from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 3: Admin Cancellation", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("allows admin to cancel order with refund initiation and inventory restoration", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const inventoryBefore = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(inventoryBefore?.availableQuantity).toBe(48);

    const cancelRes = await orderRequest(app, context.adminToken).cancelById(
      context.orderId,
      { reason: "Admin policy cancellation" },
      newIdempotencyKey("e2e-admin-cancel"),
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
    expect(restoreMovement).not.toBeNull();

    // Refund initiated for paid order
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

    const cancelAudit = await prisma.auditLog.findFirst({
      where: {
        action: ORDER_ACTIONS.CANCELLED,
        entityId: context.orderId,
      },
    });
    expect(cancelAudit).not.toBeNull();
  });
});

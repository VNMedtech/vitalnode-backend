import { describe, expect, it } from "vitest";
import {
  setupOrderTestContext,
} from "../../factories/order.factory.js";
import { cancelOrderPayload } from "../../fixtures/order.payloads.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { useOrdersTestLifecycle } from "./setup.js";

describe("Orders — Section 6: Inventory", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("deducts inventory on order placement (payment fulfillment)", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const inventory = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(inventory?.availableQuantity).toBe(48);

    const movements = await prisma.inventoryMovement.findMany({
      where: {
        referenceId: context.orderId,
        movementType: "ORDER_DEDUCTION",
      },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantityChanged).toBe(-2);
  });

  it("restores inventory when a placed order is cancelled", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const beforeCancel = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(beforeCancel?.availableQuantity).toBe(48);

    const cancelRes = await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId),
      newIdempotencyKey("cancel-restore"),
    );
    expect(cancelRes.status).toBe(200);

    const afterCancel = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(afterCancel?.availableQuantity).toBe(50);

    const restoreMovement = await prisma.inventoryMovement.findFirst({
      where: {
        referenceId: context.orderId,
        movementType: "ORDER_RESTORE",
      },
    });
    expect(restoreMovement).not.toBeNull();
    expect(restoreMovement?.quantityChanged).toBe(2);
  });

  it("maintains stock consistency — deduction + restoration equals original", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const original = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    const originalQty = original!.availableQuantity;

    await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId),
      newIdempotencyKey("cancel-consistency"),
    );

    const final = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(final?.availableQuantity).toBe(originalQty + 2);

    const netMovements = await prisma.inventoryMovement.findMany({
      where: { referenceId: context.orderId },
      orderBy: { createdAt: "asc" },
    });
    const netChange = netMovements.reduce(
      (sum, m) => sum + m.quantityChanged,
      0,
    );
    expect(netChange).toBe(0);
  });

  it("does not double-restore inventory on duplicate cancellation attempts", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOrderTestContext(app, prisma);

    const key = newIdempotencyKey("cancel-dedupe");
    const first = await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId),
      key,
    );
    const second = await orderRequest(app, context.buyerAuth.accessToken).cancel(
      cancelOrderPayload(context.orderId),
      key,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const restoreMovements = await prisma.inventoryMovement.findMany({
      where: {
        referenceId: context.orderId,
        movementType: "ORDER_RESTORE",
      },
    });
    expect(restoreMovements).toHaveLength(1);

    const inventory = await prisma.inventory.findUnique({
      where: { productId: context.productId },
    });
    expect(inventory?.availableQuantity).toBe(50);
  });
});

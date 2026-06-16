import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InventoryMovementType } from "../../../generated/prisma/client.js";
import { InventoryMovementRepository } from "../../../src/modules/inventory/repositories/inventoryMovement.repository.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";

describe("InventoryMovement deduplication", () => {
  let productId: string;
  let actorUserId: string;
  const orderId = "00000000-0000-4000-8000-000000000001";

  beforeAll(async () => {
    await resetDatabase();
    const prisma = getTestPrisma();
    const sellerUser = await prisma.user.create({
      data: {
        email: "dedupe-seller@example.com",
        passwordHash: "hash",
        role: "SELLER",
        status: "ACTIVE",
        firstName: "Dedupe",
        lastName: "Seller",
        sellerProfile: {
          create: {
            businessName: "Dedupe Co",
            contactPerson: "Owner",
            addressLine1: "1 Test St",
            city: "Mumbai",
            state: "MH",
            country: "IN",
            postalCode: "400001",
            approvalStatus: "ACTIVE",
          },
        },
      },
      include: { sellerProfile: true },
    });

    actorUserId = sellerUser.id;

    const category = await prisma.category.create({
      data: { name: `Dedupe Cat ${Date.now()}` },
    });

    const product = await prisma.product.create({
      data: {
        sellerId: sellerUser.sellerProfile!.id,
        categoryId: category.id,
        productName: "Dedupe Product",
        brand: "Brand",
        model: "M1",
        productType: "Type",
        pricing: 100,
        moq: 1,
        description: "Test",
        status: "APPROVED",
        inventory: { create: { availableQuantity: 10 } },
      },
    });

    productId = product.id;
  });

  beforeEach(async () => {
    const prisma = getTestPrisma();
    await prisma.inventoryMovement.deleteMany({ where: { productId } });
  });

  afterAll(async () => {
    await resetDatabase();
    await disconnectTestPrisma();
  });

  it("returns existing row on duplicate ORDER_DEDUCTION create", async () => {
    const prisma = getTestPrisma();
    const repo = new InventoryMovementRepository(prisma);

    const first = await repo.create({
      productId,
      actorUserId,
      quantityBefore: 10,
      quantityAfter: 8,
      quantityChanged: -2,
      quantity: 2,
      movementType: InventoryMovementType.ORDER_DEDUCTION,
      referenceId: orderId,
      reason: "Order deduction",
    });

    const second = await repo.create({
      productId,
      actorUserId,
      quantityBefore: 10,
      quantityAfter: 8,
      quantityChanged: -2,
      quantity: 2,
      movementType: InventoryMovementType.ORDER_DEDUCTION,
      referenceId: orderId,
      reason: "Order deduction",
    });

    expect(second.id).toBe(first.id);

    const count = await prisma.inventoryMovement.count({
      where: {
        productId,
        referenceId: orderId,
        movementType: InventoryMovementType.ORDER_DEDUCTION,
      },
    });
    expect(count).toBe(1);
  });

  it("allows multiple manual movements without referenceId", async () => {
    const prisma = getTestPrisma();
    const repo = new InventoryMovementRepository(prisma);

    await repo.create({
      productId,
      actorUserId,
      quantityBefore: 10,
      quantityAfter: 11,
      quantityChanged: 1,
      quantity: 1,
      movementType: InventoryMovementType.MANUAL_ADJUSTMENT,
      reason: "Restock",
    });
    await repo.create({
      productId,
      actorUserId,
      quantityBefore: 11,
      quantityAfter: 12,
      quantityChanged: 1,
      quantity: 1,
      movementType: InventoryMovementType.MANUAL_ADJUSTMENT,
      reason: "Restock again",
    });

    const count = await prisma.inventoryMovement.count({
      where: {
        productId,
        movementType: InventoryMovementType.MANUAL_ADJUSTMENT,
        referenceId: null,
      },
    });
    expect(count).toBe(2);
  });
});

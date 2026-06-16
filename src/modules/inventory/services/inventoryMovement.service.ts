/**
 * @transaction-participant
 * @idempotent: yes (order restore/deduction via movement existence check)
 * @external-calls: none
 *
 * Commerce inventory movement helpers — called inside orchestrator-owned transactions.
 */
import type { Prisma } from "../../../../generated/prisma/client.js";
import { InventoryMovementType } from "../../../../generated/prisma/client.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { InventoryRepository } from "../repositories/inventory.repository.js";
import { InventoryMovementRepository } from "../repositories/inventoryMovement.repository.js";

type TxClient = Prisma.TransactionClient;

export class InventoryMovementService {
  private inventoryRepo(tx: TxClient) {
    return new InventoryRepository(tx);
  }

  private movementRepo(tx: TxClient) {
    return new InventoryMovementRepository(tx);
  }

  async recordManualMovement(
    tx: TxClient,
    input: {
      productId: string;
      actorUserId: string;
      previousQuantity: number;
      newQuantity: number;
      reason?: string;
      notes?: string;
    },
  ): Promise<void> {
    const delta = input.newQuantity - input.previousQuantity;
    if (delta === 0) {
      return;
    }

    const reason = input.reason ?? input.notes ?? null;

    await this.movementRepo(tx).create({
      productId: input.productId,
      actorUserId: input.actorUserId,
      quantityBefore: input.previousQuantity,
      quantityAfter: input.newQuantity,
      quantityChanged: delta,
      quantity: Math.abs(delta),
      movementType: InventoryMovementType.MANUAL_ADJUSTMENT,
      reason,
      notes: input.notes ?? reason,
    });
  }

  /**
   * Atomic stock deduction for payment fulfillment. Returns false if insufficient stock.
   */
  async deductForOrder(
    tx: TxClient,
    input: {
      productId: string;
      quantity: number;
      orderId: string;
      actorUserId?: string;
      currentProductStatus: ProductStatus;
    },
  ): Promise<{ success: true; availableQuantity: number } | { success: false }> {
    const movementRepo = this.movementRepo(tx);
    const inventoryRepo = this.inventoryRepo(tx);

    const alreadyDeducted = await movementRepo.existsForOrderMovement(
      input.productId,
      input.orderId,
      InventoryMovementType.ORDER_DEDUCTION,
    );
    if (alreadyDeducted) {
      const inventory = await inventoryRepo.findByProductId(input.productId);
      return {
        success: true,
        availableQuantity: inventory?.availableQuantity ?? 0,
      };
    }

    const current = await inventoryRepo.findByProductId(input.productId);
    const quantityBefore = current?.availableQuantity ?? 0;

    const newQuantity = await inventoryRepo.decrementIfAvailable(
      input.productId,
      input.quantity,
    );

    if (newQuantity === null) {
      return { success: false };
    }

    await movementRepo.create({
      productId: input.productId,
      actorUserId: input.actorUserId ?? null,
      quantityBefore,
      quantityAfter: newQuantity,
      quantityChanged: -input.quantity,
      quantity: input.quantity,
      movementType: InventoryMovementType.ORDER_DEDUCTION,
      referenceId: input.orderId,
      reason: "Order payment fulfilled — stock deducted",
    });

    await inventoryRepo.syncProductStatusFromQuantity(
      input.productId,
      input.currentProductStatus,
      newQuantity,
    );

    return { success: true, availableQuantity: newQuantity };
  }

  /**
   * Idempotent stock restoration for order cancellation.
   */
  async restoreForOrder(
    tx: TxClient,
    input: {
      productId: string;
      quantity: number;
      orderId: string;
      actorUserId?: string;
      currentProductStatus: ProductStatus;
      movementType?: InventoryMovementType;
      reason?: string;
    },
  ): Promise<{ restored: boolean; availableQuantity: number }> {
    const movementRepo = this.movementRepo(tx);
    const inventoryRepo = this.inventoryRepo(tx);
    const movementType =
      input.movementType ?? InventoryMovementType.ORDER_RESTORE;

    const alreadyRestored = await movementRepo.existsForOrderMovement(
      input.productId,
      input.orderId,
      movementType,
    );
    if (alreadyRestored) {
      const inventory = await inventoryRepo.findByProductId(input.productId);
      return {
        restored: false,
        availableQuantity: inventory?.availableQuantity ?? 0,
      };
    }

    const wasDeducted = await movementRepo.existsForOrderMovement(
      input.productId,
      input.orderId,
      InventoryMovementType.ORDER_DEDUCTION,
    );
    if (!wasDeducted) {
      const inventory = await inventoryRepo.findByProductId(input.productId);
      return {
        restored: false,
        availableQuantity: inventory?.availableQuantity ?? 0,
      };
    }

    const current = await inventoryRepo.findByProductId(input.productId);
    const quantityBefore = current?.availableQuantity ?? 0;

    const newQuantity = await inventoryRepo.incrementQuantity(
      input.productId,
      input.quantity,
    );

    await movementRepo.create({
      productId: input.productId,
      actorUserId: input.actorUserId ?? null,
      quantityBefore,
      quantityAfter: newQuantity,
      quantityChanged: input.quantity,
      quantity: input.quantity,
      movementType,
      referenceId: input.orderId,
      reason: input.reason ?? "Order cancelled — stock restored",
    });

    await inventoryRepo.syncProductStatusFromQuantity(
      input.productId,
      input.currentProductStatus,
      newQuantity,
    );

    return { restored: true, availableQuantity: newQuantity };
  }
}

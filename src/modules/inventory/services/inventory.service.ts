/**
 * @transaction-owner (manual inventory updates)
 * @idempotent: yes (via Idempotency-Key on PATCH)
 * @external-calls: none
 */
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { withIdempotency } from "../../../shared/idempotency/withIdempotency.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  INVENTORY_ACTIONS,
  INVENTORY_AUDIT_ENTITY_TYPE,
  INVENTORY_IDEMPOTENCY_ROUTES,
} from "../constants/inventory.constants.js";
import {
  toInventoryDetailDto,
  toInventoryMovementDto,
  toLowStockAlertDto,
} from "../dto/inventory.dto.js";
import { InventoryMovementRepository } from "../repositories/inventoryMovement.repository.js";
import {
  InventoryRepository,
  type InventoryDetailRecord,
} from "../repositories/inventory.repository.js";
import { InventoryMovementService } from "./inventoryMovement.service.js";
import type {
  InventoryDetailDto,
  InventoryMovementDto,
  ListInventoryMovementsQuery,
  ListLowStockAlertsQuery,
  LowStockAlertDto,
  UpdateInventoryInput,
} from "../types/inventory.types.js";

const INVENTORY_EDITABLE_PRODUCT_STATUSES: readonly ProductStatus[] = [
  ProductStatus.PENDING_APPROVAL,
  ProductStatus.APPROVED,
  ProductStatus.OUT_OF_STOCK,
  ProductStatus.DISABLED,
];

export class InventoryService {
  private readonly inventoryRepo = new InventoryRepository(prisma);
  private readonly movementRepo = new InventoryMovementRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);
  private readonly movementService = new InventoryMovementService();

  private async requireApprovedSellerId(userId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(userId);
    if (!seller) {
      throw new ForbiddenError("Seller profile not found");
    }

    if (seller.approvalStatus !== SellerApprovalStatus.ACTIVE) {
      throw new ForbiddenError("Only approved sellers can manage inventory");
    }

    return seller.id;
  }

  private async assertInventoryAccess(
    actorUserId: string,
    actorRole: UserRole,
    productId: string,
  ): Promise<InventoryDetailRecord> {
    const inventory = await this.inventoryRepo.findByProductId(productId);
    if (!inventory || inventory.product.deletedAt !== null) {
      throw new NotFoundError("Inventory not found");
    }

    if (actorRole === UserRole.ADMIN) {
      return inventory;
    }

    if (actorRole === UserRole.SELLER) {
      const sellerId = await this.requireApprovedSellerId(actorUserId);
      if (inventory.product.sellerId !== sellerId) {
        throw new ForbiddenError("You do not own this product");
      }
      return inventory;
    }

    throw new ForbiddenError("Insufficient permissions to access inventory");
  }

  async getInventory(
    actorUserId: string,
    actorRole: UserRole,
    productId: string,
  ): Promise<InventoryDetailDto> {
    const inventory = await this.assertInventoryAccess(
      actorUserId,
      actorRole,
      productId,
    );

    const record = this.inventoryRepo.toInventoryRecord(inventory);
    if (!record) {
      throw new NotFoundError("Inventory not found");
    }

    return toInventoryDetailDto(record);
  }

  async updateInventory(
    actorUserId: string,
    actorRole: UserRole,
    productId: string,
    input: UpdateInventoryInput,
    idempotencyKey?: string,
  ): Promise<InventoryDetailDto> {
    const execute = async (): Promise<InventoryDetailDto> => {
      const inventory = await this.assertInventoryAccess(
        actorUserId,
        actorRole,
        productId,
      );

      const productStatus = inventory.product.status as ProductStatus;
      if (!INVENTORY_EDITABLE_PRODUCT_STATUSES.includes(productStatus)) {
        throw new ConflictError(
          `Cannot update inventory while product is ${productStatus}`,
        );
      }

      const previousQuantity = inventory.availableQuantity;
      if (previousQuantity === input.availableQuantity) {
        const record = this.inventoryRepo.toInventoryRecord(inventory);
        if (!record) {
          throw new NotFoundError("Inventory not found");
        }
        return toInventoryDetailDto(record);
      }

      const reason = input.reason ?? input.notes;
      const quantityChanged = input.availableQuantity - previousQuantity;

      const updated = await runInTransaction(async (tx) => {
        const inventoryRepo = new InventoryRepository(tx);

        const result = await inventoryRepo.setAvailableQuantity(
          productId,
          input.availableQuantity,
        );

        await this.movementService.recordManualMovement(tx, {
          productId,
          actorUserId,
          previousQuantity,
          newQuantity: input.availableQuantity,
          reason,
          notes: input.notes ?? reason,
        });

        const syncedProductStatus =
          await inventoryRepo.syncProductStatusFromQuantity(
            productId,
            productStatus,
            input.availableQuantity,
          );

        const auditMetadata = {
          productId,
          previousQuantity,
          newQuantity: input.availableQuantity,
          quantityBefore: previousQuantity,
          quantityAfter: input.availableQuantity,
          quantityChanged,
          movementType: "MANUAL_ADJUSTMENT",
          reason: reason ?? null,
          previousProductStatus: productStatus,
          newProductStatus: syncedProductStatus ?? productStatus,
        };

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: INVENTORY_ACTIONS.ADJUSTED,
            entityType: INVENTORY_AUDIT_ENTITY_TYPE,
            entityId: result.id,
            metadata: auditMetadata,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: INVENTORY_ACTIONS.UPDATED,
            entityType: INVENTORY_AUDIT_ENTITY_TYPE,
            entityId: result.id,
            metadata: auditMetadata,
          },
        });

        return result;
      });

      const record = this.inventoryRepo.toInventoryRecord(updated);
      if (!record) {
        throw new NotFoundError("Inventory not found");
      }

      return toInventoryDetailDto(record);
    };

    if (idempotencyKey) {
      return withIdempotency({
        actorUserId,
        key: idempotencyKey,
        route: INVENTORY_IDEMPOTENCY_ROUTES.UPDATE,
        handler: execute,
      });
    }

    return execute();
  }

  async listMovements(
    actorUserId: string,
    actorRole: UserRole,
    productId: string,
    query: ListInventoryMovementsQuery,
  ): Promise<{ items: InventoryMovementDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    await this.assertInventoryAccess(actorUserId, actorRole, productId);

    const [movements, total] = await Promise.all([
      this.movementRepo.findByProductId({
        productId,
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        movementType: query.movementType,
      }),
      this.movementRepo.countByProductId(productId, query.movementType),
    ]);

    return {
      items: movements.map((movement) =>
        toInventoryMovementDto(this.movementRepo.toMovementRecord(movement)),
      ),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listLowStockAlerts(
    actorUserId: string,
    actorRole: UserRole,
    query: ListLowStockAlertsQuery,
  ): Promise<{ items: LowStockAlertDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    let sellerId: string | undefined;

    if (actorRole === UserRole.SELLER) {
      sellerId = await this.requireApprovedSellerId(actorUserId);
    } else if (actorRole !== UserRole.ADMIN) {
      throw new ForbiddenError("Insufficient permissions to view inventory alerts");
    }

    const [alerts, total] = await Promise.all([
      this.inventoryRepo.findLowStockAlerts({
        sellerId,
        alertStatus: query.alertStatus,
        page: query.page,
        limit: query.limit,
      }),
      this.inventoryRepo.countLowStockAlerts({
        sellerId,
        alertStatus: query.alertStatus,
      }),
    ]);

    return {
      items: alerts.map(toLowStockAlertDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}

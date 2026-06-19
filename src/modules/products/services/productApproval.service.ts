import { prisma } from "../../../infrastructure/prisma/client.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import {
  ConflictError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  PRODUCT_ACTIONS,
  PRODUCT_APPROVAL_TRANSITIONS,
  PRODUCT_AUDIT_ENTITY_TYPE,
} from "../constants/product.constants.js";
import {
  buildAppUrl,
  buildRecipientName,
} from "../../email/services/email.service.js";
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_TYPES,
  notificationDispatcher,
} from "../../notifications/index.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  toProductDetailDto,
  toProductListItemDtoFromRecord,
} from "../dto/product.dto.js";
import { ProductRepository } from "../repositories/product.repository.js";
import type {
  ListProductsQuery,
  ProductDetailDto,
  ProductListItemDto,
  RejectProductInput,
} from "../types/product.types.js";

function assertTransitionAllowed(
  currentStatus: ProductStatus,
  targetStatus: ProductStatus,
): void {
  const allowedTargets = PRODUCT_APPROVAL_TRANSITIONS[currentStatus];
  if (!allowedTargets.includes(targetStatus)) {
    throw new ConflictError(
      `Cannot transition product from ${currentStatus} to ${targetStatus}`,
    );
  }
}

function assertCurrentStatus(
  currentStatus: ProductStatus,
  expectedStatus: ProductStatus,
  action: string,
): void {
  if (currentStatus !== expectedStatus) {
    throw new ConflictError(
      `Cannot ${action} product while status is ${currentStatus}`,
    );
  }
}

type ProductDecision = "approve" | "reject";

export async function emitProductDecisionNotification(
  productId: string,
  sellerId: string,
  productName: string,
  decision: ProductDecision,
  reason: string | undefined,
  sellerRepo: SellerRepository,
): Promise<void> {
  const sellerProfile = await sellerRepo.findById(sellerId);
  if (!sellerProfile) {
    logger.warn(
      { productId, sellerId },
      "Product notification skipped — seller profile not found",
    );
    return;
  }

  const inApp =
    decision === "approve"
      ? {
          userId: sellerProfile.userId,
          type: NOTIFICATION_TYPES.PRODUCT_APPROVED,
          title: "Product approved",
          message: `Your product "${productName}" has been approved and is now visible in the marketplace.`,
        }
      : {
          userId: sellerProfile.userId,
          type: NOTIFICATION_TYPES.PRODUCT_REJECTED,
          title: "Product rejected",
          message: reason
            ? `Your product "${productName}" was rejected. Reason: ${reason}`
            : `Your product "${productName}" was rejected.`,
        };

  const sellerEmail = sellerProfile.user.email;
  if (!sellerEmail) {
    notificationDispatcher.createInApp(inApp);
    logger.warn(
      { productId, sellerId, userId: sellerProfile.userId },
      "Product notification email skipped — seller email unavailable",
    );
    return;
  }

  const recipientName = buildRecipientName(
    sellerProfile.user.firstName,
    sellerProfile.user.lastName,
  );

  if (decision === "approve") {
    notificationDispatcher.emit({
      eventType: NOTIFICATION_EVENTS.PRODUCT_APPROVED,
      correlationId: productId,
      inApp,
      email: {
        to: sellerEmail,
        recipientName,
        productName,
        marketplaceUrl: buildAppUrl("/products"),
      },
    });
    return;
  }

  notificationDispatcher.emit({
    eventType: NOTIFICATION_EVENTS.PRODUCT_REJECTED,
    correlationId: productId,
    inApp,
    email: {
      to: sellerEmail,
      recipientName,
      productName,
      reason,
      supportUrl: buildAppUrl("/support"),
    },
  });
}

export class ProductApprovalService {
  private readonly repo = new ProductRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);

  async listPendingProducts(query: ListProductsQuery): Promise<{
    items: ProductListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const filterOptions = {
      search: query.search,
      categoryId: query.categoryId,
      brand: query.brand,
      status: ProductStatus.PENDING_APPROVAL,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      marketplaceOnly: false,
    };

    const [records, total] = await Promise.all([
      this.repo.findManyPaginated({
        ...query,
        ...filterOptions,
      }),
      this.repo.count(filterOptions),
    ]);

    return {
      items: records.map(toProductListItemDtoFromRecord),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async approveProduct(
    actorUserId: string,
    productId: string,
  ): Promise<ProductDetailDto> {
    const product = await this.repo.findDetailById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const currentStatus = product.status as ProductStatus;
    assertCurrentStatus(
      currentStatus,
      ProductStatus.PENDING_APPROVAL,
      "approve",
    );
    assertTransitionAllowed(currentStatus, ProductStatus.APPROVED);

    const updated = await this.repo.updateStatus(
      productId,
      ProductStatus.APPROVED,
    );

    auditLogger.log({
      actorUserId,
      action: PRODUCT_ACTIONS.APPROVE,
      entityType: PRODUCT_AUDIT_ENTITY_TYPE,
      entityId: productId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: ProductStatus.APPROVED,
        sellerId: product.sellerId,
        productName: product.productName,
      },
    });

    await emitProductDecisionNotification(
      productId,
      product.sellerId,
      product.productName,
      "approve",
      undefined,
      this.sellerRepo,
    );

    return toProductDetailDto(updated);
  }

  async rejectProduct(
    actorUserId: string,
    productId: string,
    input: RejectProductInput = {},
  ): Promise<ProductDetailDto> {
    const product = await this.repo.findDetailById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const currentStatus = product.status as ProductStatus;
    assertCurrentStatus(
      currentStatus,
      ProductStatus.PENDING_APPROVAL,
      "reject",
    );
    assertTransitionAllowed(currentStatus, ProductStatus.REJECTED);

    const updated = await this.repo.updateStatus(
      productId,
      ProductStatus.REJECTED,
    );

    auditLogger.log({
      actorUserId,
      action: PRODUCT_ACTIONS.REJECT,
      entityType: PRODUCT_AUDIT_ENTITY_TYPE,
      entityId: productId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: ProductStatus.REJECTED,
        sellerId: product.sellerId,
        productName: product.productName,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    });

    await emitProductDecisionNotification(
      productId,
      product.sellerId,
      product.productName,
      "reject",
      input.reason,
      this.sellerRepo,
    );

    return toProductDetailDto(updated);
  }
}

import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { CategoryRepository } from "../../categories/repositories/category.repository.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  PRODUCT_ACTIONS,
  PRODUCT_APPROVAL_TRANSITIONS,
  PRODUCT_AUDIT_ENTITY_TYPE,
  PRODUCT_EDITABLE_STATUSES,
} from "../constants/product.constants.js";
import {
  toProductDetailDto,
  toProductListItemDtoFromRecord,
} from "../dto/product.dto.js";
import { ProductDocumentRepository } from "../repositories/productDocument.repository.js";
import { ProductMediaRepository } from "../repositories/productMedia.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import type {
  CreateProductInput,
  ListProductsQuery,
  ProductDetailDto,
  ProductListItemDto,
  UpdateProductInput,
} from "../types/product.types.js";

function toDecimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function optionalDecimal(value?: string | null): Prisma.Decimal | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return toDecimal(value);
}

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

function buildUpdateMetadata(
  before: Record<string, unknown>,
  input: UpdateProductInput,
): Record<string, unknown> {
  const changedFields = Object.keys(input).filter((key) => {
    const value = input[key as keyof UpdateProductInput];
    return value !== undefined;
  });

  return {
    changedFields,
    previousStatus: before.status,
  };
}

function normalizeMediaInput(
  media: CreateProductInput["media"] | UpdateProductInput["media"],
) {
  if (!media) {
    return undefined;
  }

  return media.map((item, index) => ({
    fileUrl: item.fileUrl,
    displayOrder: item.displayOrder ?? index,
  }));
}

export class ProductService {
  private readonly repo = new ProductRepository(prisma);
  private readonly categoryRepo = new CategoryRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);
  private readonly mediaRepo = new ProductMediaRepository(prisma);
  private readonly documentRepo = new ProductDocumentRepository(prisma);

  private async requireApprovedSeller(userId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(userId);
    if (!seller) {
      throw new ForbiddenError("Seller profile not found");
    }

    if (seller.approvalStatus !== SellerApprovalStatus.ACTIVE) {
      throw new ForbiddenError(
        "Only approved sellers can manage products",
      );
    }

    return seller.id;
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categoryRepo.findActiveById(categoryId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }
  }

  private async getOwnedProductOrThrow(
    productId: string,
    sellerId: string,
  ) {
    const product = await this.repo.findByIdForSeller(productId, sellerId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  async createProduct(
    actorUserId: string,
    input: CreateProductInput,
  ): Promise<ProductDetailDto> {
    const sellerId = await this.requireApprovedSeller(actorUserId);
    await this.assertCategoryExists(input.categoryId);

    const media = normalizeMediaInput(input.media) ?? [];
    const documents = input.documents ?? [];

    const created = await this.repo.createWithInventory(
      {
        sellerId,
        categoryId: input.categoryId,
        productName: input.productName,
        brand: input.brand,
        model: input.model,
        productType: input.productType,
        color: input.color ?? null,
        weight: optionalDecimal(input.weight) ?? null,
        length: optionalDecimal(input.length) ?? null,
        warrantyPeriod: input.warrantyPeriod ?? null,
        returnTime: input.returnTime ?? null,
        deliveryTime: input.deliveryTime ?? null,
        pricing: toDecimal(input.pricing),
        moq: input.moq,
        description: input.description,
        details: input.details ?? null,
        specifications: input.specifications as Prisma.InputJsonValue | undefined,
        status: ProductStatus.PENDING_APPROVAL,
      },
      media,
      documents,
    );

    auditLogger.log({
      actorUserId,
      action: PRODUCT_ACTIONS.CREATE,
      entityType: PRODUCT_AUDIT_ENTITY_TYPE,
      entityId: created.id,
      metadata: {
        sellerId,
        categoryId: input.categoryId,
        productName: input.productName,
        status: ProductStatus.PENDING_APPROVAL,
      },
    });

    return toProductDetailDto(created);
  }

  async updateProduct(
    actorUserId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<ProductDetailDto> {
    const sellerId = await this.requireApprovedSeller(actorUserId);
    const existing = await this.getOwnedProductOrThrow(productId, sellerId);
    const currentStatus = existing.status as ProductStatus;

    if (!PRODUCT_EDITABLE_STATUSES.includes(currentStatus)) {
      throw new ConflictError(
        `Cannot update product while status is ${currentStatus}`,
      );
    }

    if (input.categoryId) {
      await this.assertCategoryExists(input.categoryId);
    }

    const updateData: Parameters<ProductRepository["update"]>[1] = {
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.productName !== undefined
        ? { productName: input.productName }
        : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.productType !== undefined
        ? { productType: input.productType }
        : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.weight !== undefined
        ? { weight: optionalDecimal(input.weight) }
        : {}),
      ...(input.length !== undefined
        ? { length: optionalDecimal(input.length) }
        : {}),
      ...(input.warrantyPeriod !== undefined
        ? { warrantyPeriod: input.warrantyPeriod }
        : {}),
      ...(input.returnTime !== undefined
        ? { returnTime: input.returnTime }
        : {}),
      ...(input.deliveryTime !== undefined
        ? { deliveryTime: input.deliveryTime }
        : {}),
      ...(input.pricing !== undefined
        ? { pricing: toDecimal(input.pricing) }
        : {}),
      ...(input.moq !== undefined ? { moq: input.moq } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.details !== undefined ? { details: input.details } : {}),
      ...(input.specifications !== undefined
        ? {
            specifications:
              input.specifications === null
                ? Prisma.JsonNull
                : (input.specifications as Prisma.InputJsonValue),
          }
        : {}),
    };

    await prisma.$transaction(async (tx) => {
      const productRepo = new ProductRepository(tx);
      const mediaRepo = new ProductMediaRepository(tx);
      const documentRepo = new ProductDocumentRepository(tx);

      await productRepo.update(productId, updateData);

      if (input.media !== undefined) {
        await mediaRepo.replaceForProduct(
          productId,
          normalizeMediaInput(input.media) ?? [],
        );
      }

      if (input.documents !== undefined) {
        await documentRepo.replaceForProduct(productId, input.documents);
      }
    });

    const updated = await this.repo.findByIdForSeller(productId, sellerId);
    if (!updated) {
      throw new NotFoundError("Product not found");
    }

    auditLogger.log({
      actorUserId,
      action: PRODUCT_ACTIONS.UPDATE,
      entityType: PRODUCT_AUDIT_ENTITY_TYPE,
      entityId: productId,
      metadata: buildUpdateMetadata(
        { status: currentStatus },
        input,
      ),
    });

    return toProductDetailDto(updated);
  }

  async disableProduct(
    actorUserId: string,
    productId: string,
  ): Promise<ProductDetailDto> {
    const sellerId = await this.requireApprovedSeller(actorUserId);
    const existing = await this.getOwnedProductOrThrow(productId, sellerId);
    const currentStatus = existing.status as ProductStatus;

    assertTransitionAllowed(currentStatus, ProductStatus.DISABLED);

    const updated = await this.repo.updateStatus(
      productId,
      ProductStatus.DISABLED,
    );

    auditLogger.log({
      actorUserId,
      action: PRODUCT_ACTIONS.DISABLE,
      entityType: PRODUCT_AUDIT_ENTITY_TYPE,
      entityId: productId,
      metadata: {
        previousStatus: currentStatus,
        newStatus: ProductStatus.DISABLED,
        sellerId,
        productName: existing.productName,
      },
    });

    return toProductDetailDto(updated);
  }

  async getOwnProductById(
    actorUserId: string,
    productId: string,
  ): Promise<ProductDetailDto> {
    const sellerId = await this.requireApprovedSeller(actorUserId);
    const product = await this.getOwnedProductOrThrow(productId, sellerId);
    return toProductDetailDto(product);
  }

  async listOwnProducts(
    actorUserId: string,
    query: ListProductsQuery,
  ): Promise<{
    items: ProductListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const sellerId = await this.requireApprovedSeller(actorUserId);

    const filterOptions = {
      search: query.search,
      categoryId: query.categoryId,
      brand: query.brand,
      status: query.status,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      sellerId,
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

  async listMarketplaceProducts(query: ListProductsQuery): Promise<{
    items: ProductListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const filterOptions = {
      search: query.search,
      categoryId: query.categoryId,
      brand: query.brand,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      marketplaceOnly: true,
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

  async getMarketplaceProductById(productId: string): Promise<ProductDetailDto> {
    const product = await this.repo.findMarketplaceDetailById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return toProductDetailDto(product);
  }
}

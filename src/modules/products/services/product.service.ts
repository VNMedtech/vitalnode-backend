import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { CategoryRepository } from "../../categories/repositories/category.repository.js";
import { ProductTemplateRepository } from "../../productTemplates/repositories/productTemplate.repository.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import { UPLOAD_TYPES } from "../../uploads/constants/upload.constants.js";
import { UploadAssociationService } from "../../uploads/services/uploadAssociation.service.js";
import {
  PRODUCT_ACTIONS,
  PRODUCT_APPROVAL_TRANSITIONS,
  PRODUCT_AUDIT_ENTITY_TYPE,
  PRODUCT_CORE_REAPPROVAL_FIELDS,
  PRODUCT_EDITABLE_STATUSES,
} from "../constants/product.constants.js";
import {
  toProductCompareDto,
  toProductDetailDto,
  toProductListItemDtoFromRecord,
} from "../dto/product.dto.js";
import { ProductDocumentRepository } from "../repositories/productDocument.repository.js";
import { ProductMediaRepository } from "../repositories/productMedia.repository.js";
import { ProductRepository } from "../repositories/product.repository.js";
import { ReviewRepository } from "../../reviews/repositories/review.repository.js";
import { toProductReviewStats } from "../../reviews/dto/review.dto.js";
import type {
  AttachTemplateInput,
  CreateProductInput,
  ListMarketplaceProductsQuery,
  ListProductsQuery,
  ProductCompareDto,
  ProductDetailDto,
  ProductDocumentInput,
  ProductListItemDto,
  ProductMediaInput,
  UpdateProductInput,
} from "../types/product.types.js";
import type { ProductUploadFiles } from "../utils/productUpload.util.js";
import {
  validateProductDocumentTypes,
  validateProductImageCount,
} from "../utils/productUpload.util.js";
import { usesMarketplaceDefaultSort } from "../utils/productSort.util.js";
import {
  applyDefaultsForMissingKeys,
  asAttributeMap,
  extractTemplateDefaults,
  mergeAttributes,
  validateAttributesAgainstTemplate,
} from "../utils/productAttributes.util.js";

function toDecimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
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

function normalizeMediaInput(media: ProductMediaInput[]) {
  return media.map((item, index) => ({
    fileUploadId: item.fileUploadId,
    fileUrl: item.fileUrl,
    displayOrder: item.displayOrder ?? index,
  }));
}

function requiresReapproval(input: UpdateProductInput): boolean {
  return PRODUCT_CORE_REAPPROVAL_FIELDS.some(
    (field) => input[field as keyof UpdateProductInput] !== undefined,
  );
}

export class ProductService {
  private readonly repo = new ProductRepository(prisma);
  private readonly reviewRepo = new ReviewRepository(prisma);
  private readonly categoryRepo = new CategoryRepository(prisma);
  private readonly templateRepo = new ProductTemplateRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);
  private readonly mediaRepo = new ProductMediaRepository(prisma);
  private readonly documentRepo = new ProductDocumentRepository(prisma);
  private readonly uploadAssociation = new UploadAssociationService();

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

  private async assertCategoriesExist(categoryIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(categoryIds)];
    for (const categoryId of uniqueIds) {
      const category = await this.categoryRepo.findActiveById(categoryId);
      if (!category) {
        throw new NotFoundError(`Category not found: ${categoryId}`);
      }
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

  private async processUploadedMedia(
    actorUserId: string,
    files: ProductUploadFiles,
    documentTypes?: string[],
  ): Promise<{
    media: ProductMediaInput[];
    documents: ProductDocumentInput[];
  }> {
    validateProductImageCount(files.images);
    const resolvedDocumentTypes = validateProductDocumentTypes(
      files.documents,
      documentTypes,
    );

    const media: ProductMediaInput[] = [];
    for (const [index, image] of files.images.entries()) {
      const upload = await this.uploadAssociation.storeFileForAssociation(
        actorUserId,
        UserRole.SELLER,
        UPLOAD_TYPES.PRODUCT_IMAGE,
        image,
      );
      media.push({
        fileUploadId: upload.id,
        fileUrl: upload.fileUrl,
        displayOrder: index,
      });
    }

    const documents: ProductDocumentInput[] = [];
    for (const [index, document] of files.documents.entries()) {
      const upload = await this.uploadAssociation.storeFileForAssociation(
        actorUserId,
        UserRole.SELLER,
        UPLOAD_TYPES.PRODUCT_DOCUMENT,
        document,
      );
      documents.push({
        fileUploadId: upload.id,
        fileUrl: upload.fileUrl,
        documentType: resolvedDocumentTypes[index]!,
      });
    }

    return { media, documents };
  }

  async createProduct(
    actorUserId: string,
    input: CreateProductInput,
    files?: ProductUploadFiles,
  ): Promise<ProductDetailDto> {
    const sellerId = await this.requireApprovedSeller(actorUserId);
    const categoryIds = [...new Set(input.categoryIds)];
    await this.assertCategoriesExist(categoryIds);

    let attributes = asAttributeMap(input.attributes);
    let templateId: string | null = null;

    if (input.templateId) {
      const template = await this.templateRepo.findActiveById(input.templateId);
      if (!template) {
        throw new NotFoundError("Product template not found");
      }
      templateId = template.id;
      const defaults = extractTemplateDefaults(template.fields);
      attributes = mergeAttributes({}, defaults, attributes);
      validateAttributesAgainstTemplate(attributes, template.fields);
    }

    let media = input.media ?? [];
    let documents = input.documents ?? [];

    if (files) {
      const uploaded = await this.processUploadedMedia(
        actorUserId,
        files,
        input.documentTypes,
      );
      media = uploaded.media;
      documents = uploaded.documents;
    }

    const created = await this.repo.createWithInventory(
      {
        sellerId,
        categoryIds,
        primaryCategoryId: categoryIds[0]!,
        templateId,
        productName: input.productName,
        brand: input.brand,
        model: input.model,
        pricing: toDecimal(input.pricing),
        moq: input.moq,
        description: input.description,
        details: input.details ?? null,
        attributes:
          Object.keys(attributes).length > 0
            ? (attributes as Prisma.InputJsonValue)
            : undefined,
        status: ProductStatus.PENDING_APPROVAL,
      },
      media.map((item, index) => ({
        fileUploadId: item.fileUploadId,
        fileUrl: item.fileUrl,
        displayOrder: item.displayOrder ?? index,
      })),
      documents,
    );

    auditLogger.log({
      actorUserId,
      action: PRODUCT_ACTIONS.CREATE,
      entityType: PRODUCT_AUDIT_ENTITY_TYPE,
      entityId: created.id,
      metadata: {
        sellerId,
        categoryIds,
        templateId,
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
    files?: ProductUploadFiles,
  ): Promise<ProductDetailDto> {
    const sellerId = await this.requireApprovedSeller(actorUserId);
    const existing = await this.getOwnedProductOrThrow(productId, sellerId);
    const currentStatus = existing.status as ProductStatus;

    if (!PRODUCT_EDITABLE_STATUSES.includes(currentStatus)) {
      throw new ConflictError(
        `Cannot update product while status is ${currentStatus}`,
      );
    }

    let categoryIds: string[] | undefined;
    if (input.categoryIds) {
      categoryIds = [...new Set(input.categoryIds)];
      await this.assertCategoriesExist(categoryIds);
    }

    let nextTemplateId =
      input.templateId !== undefined ? input.templateId : existing.templateId;
    let attributes = asAttributeMap(existing.attributes);

    if (input.attributes !== undefined) {
      attributes =
        input.attributes === null
          ? {}
          : mergeAttributes(attributes, {}, asAttributeMap(input.attributes));
    }

    if (input.templateId !== undefined && input.templateId !== null) {
      const template = await this.templateRepo.findActiveById(input.templateId);
      if (!template) {
        throw new NotFoundError("Product template not found");
      }
      nextTemplateId = template.id;
      const defaults = extractTemplateDefaults(template.fields);
      attributes = applyDefaultsForMissingKeys(
        attributes,
        defaults,
        input.attributes ? asAttributeMap(input.attributes) : undefined,
      );
      validateAttributesAgainstTemplate(attributes, template.fields);
    } else if (input.templateId === null) {
      nextTemplateId = null;
    } else if (existing.templateId && input.attributes !== undefined) {
      const template = await this.templateRepo.findById(existing.templateId);
      if (template) {
        validateAttributesAgainstTemplate(attributes, template.fields);
      }
    }

    const updateData: Parameters<ProductRepository["update"]>[1] = {
      ...(input.templateId !== undefined
        ? { templateId: nextTemplateId }
        : {}),
      ...(input.productName !== undefined
        ? { productName: input.productName }
        : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.pricing !== undefined
        ? { pricing: toDecimal(input.pricing) }
        : {}),
      ...(input.moq !== undefined ? { moq: input.moq } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.details !== undefined ? { details: input.details } : {}),
      ...(input.attributes !== undefined ||
      (input.templateId !== undefined && input.templateId !== null)
        ? {
            attributes:
              Object.keys(attributes).length > 0
                ? (attributes as Prisma.InputJsonValue)
                : Prisma.JsonNull,
          }
        : {}),
    };

    let mediaToReplace: ProductMediaInput[] | undefined;
    let documentsToReplace: ProductDocumentInput[] | undefined;

    if (files && (files.images.length > 0 || input.replaceMedia)) {
      const uploaded = await this.processUploadedMedia(
        actorUserId,
        { images: files.images, documents: [] },
      );
      mediaToReplace = uploaded.media;
    } else if (input.media !== undefined) {
      mediaToReplace = input.media;
    }

    if (files && (files.documents.length > 0 || input.replaceDocuments)) {
      const uploaded = await this.processUploadedMedia(
        actorUserId,
        { images: [], documents: files.documents },
        input.documentTypes,
      );
      documentsToReplace = uploaded.documents;
    } else if (input.documents !== undefined) {
      documentsToReplace = input.documents;
    }

    const shouldReapprove =
      currentStatus === ProductStatus.APPROVED &&
      (requiresReapproval(input) ||
        mediaToReplace !== undefined ||
        documentsToReplace !== undefined);

    if (shouldReapprove) {
      updateData.status = ProductStatus.PENDING_APPROVAL;
    }

    await prisma.$transaction(async (tx) => {
      const productRepo = new ProductRepository(tx);
      const mediaRepo = new ProductMediaRepository(tx);
      const documentRepo = new ProductDocumentRepository(tx);

      await productRepo.update(productId, updateData);

      if (categoryIds) {
        await productRepo.replaceCategories(
          productId,
          categoryIds,
          categoryIds[0]!,
        );
      }

      if (mediaToReplace !== undefined) {
        await mediaRepo.replaceForProduct(
          productId,
          normalizeMediaInput(mediaToReplace),
        );
      }

      if (documentsToReplace !== undefined) {
        await documentRepo.replaceForProduct(productId, documentsToReplace);
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
      metadata: {
        ...buildUpdateMetadata({ status: currentStatus }, input),
        ...(shouldReapprove
          ? { newStatus: ProductStatus.PENDING_APPROVAL }
          : {}),
      },
    });

    return toProductDetailDto(updated);
  }

  async attachTemplate(
    actorUserId: string,
    productId: string,
    input: AttachTemplateInput,
  ): Promise<ProductDetailDto> {
    const product = await this.repo.findDetailById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const template = await this.templateRepo.findActiveById(input.templateId);
    if (!template) {
      throw new NotFoundError("Product template not found");
    }

    const defaults = extractTemplateDefaults(template.fields);
    const existingAttributes = asAttributeMap(product.attributes);
    const overrides = asAttributeMap(input.attributes);
    const attributes = mergeAttributes(
      existingAttributes,
      defaults,
      overrides,
    );
    validateAttributesAgainstTemplate(attributes, template.fields);

    const updated = await this.repo.update(productId, {
      templateId: template.id,
      attributes: attributes as Prisma.InputJsonValue,
    });

    auditLogger.log({
      actorUserId,
      action: PRODUCT_ACTIONS.ATTACH_TEMPLATE,
      entityType: PRODUCT_AUDIT_ENTITY_TYPE,
      entityId: productId,
      metadata: {
        templateId: template.id,
        templateName: template.name,
        previousTemplateId: product.templateId,
      },
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
      categoryIds: query.categoryIds,
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
      items: records.map((record) => toProductListItemDtoFromRecord(record)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listMarketplaceProducts(query: ListMarketplaceProductsQuery): Promise<{
    items: ProductListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const filterOptions = {
      search: query.search,
      categoryId: query.categoryId,
      categoryIds: query.categoryIds,
      brand: query.brand,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      marketplaceOnly: true,
    };

    const useMarketplaceDefaultSort = usesMarketplaceDefaultSort(
      query.sortBy,
      query.sortOrder,
    );

    const [records, total] = await Promise.all([
      this.repo.findManyPaginated({
        page: query.page,
        limit: query.limit,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        useMarketplaceDefaultSort,
        ...filterOptions,
      }),
      this.repo.count(filterOptions),
    ]);

    const productIds = records.map((record) => record.id);
    const reviewStatsMap =
      await this.reviewRepo.getStatsForProductIds(productIds);

    return {
      items: records.map((record) =>
        toProductListItemDtoFromRecord(
          record,
          toProductReviewStats(
            reviewStatsMap.get(record.id) ?? {
              averageRating: null,
              reviewCount: 0,
            },
          ),
        ),
      ),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getMarketplaceProductById(productId: string): Promise<ProductDetailDto> {
    const product = await this.repo.findMarketplaceDetailById(productId);
    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const reviewStats = toProductReviewStats(
      await this.reviewRepo.getStatsForProduct(productId),
    );

    return toProductDetailDto(product, reviewStats);
  }

  async compareMarketplaceProducts(
    productIds: string[],
  ): Promise<ProductCompareDto> {
    const records = await this.repo.findMarketplaceDetailsByIds(productIds);

    if (records.length !== productIds.length) {
      throw new NotFoundError(
        "One or more products are not available for comparison",
      );
    }

    const categoryIdSets = records.map(
      (record) => new Set(record.categories.map((link) => link.category.id)),
    );
    const sharedCategoryIds = categoryIdSets.reduce<Set<string> | null>(
      (intersection, next) => {
        if (intersection === null) {
          return new Set(next);
        }
        return new Set([...intersection].filter((id) => next.has(id)));
      },
      null,
    );

    if (!sharedCategoryIds || sharedCategoryIds.size === 0) {
      throw new ValidationError(
        "Products must share at least one category to be compared",
      );
    }

    return toProductCompareDto(productIds, records);
  }
}

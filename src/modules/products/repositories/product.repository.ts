import type {
  Prisma,
  PrismaClient,
  ProductStatus as PrismaProductStatus,
} from "../../../../generated/prisma/client.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import {
  PRODUCT_PUBLIC_STATUSES,
  type ProductSortField,
} from "../constants/product.constants.js";
import { buildProductOrderBy } from "../utils/productSort.util.js";

const marketplacePublicStatusFilter = {
  in: [...PRODUCT_PUBLIC_STATUSES] as PrismaProductStatus[],
};

const categorySummarySelect = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

const sellerSummarySelect = {
  id: true,
  businessName: true,
} satisfies Prisma.SellerProfileSelect;

const templateSummarySelect = {
  id: true,
  name: true,
} satisfies Prisma.ProductTemplateSelect;

const templateFieldSelect = {
  id: true,
  key: true,
  label: true,
  fieldType: true,
  options: true,
  defaultValue: true,
  unit: true,
  sortOrder: true,
  isActive: true,
} satisfies Prisma.ProductTemplateFieldSelect;

const mediaSelect = {
  id: true,
  fileUploadId: true,
  fileUrl: true,
  displayOrder: true,
  createdAt: true,
} satisfies Prisma.ProductMediaSelect;

const documentSelect = {
  id: true,
  fileUploadId: true,
  fileUrl: true,
  documentType: true,
  createdAt: true,
} satisfies Prisma.ProductDocumentSelect;

const productCategorySelect = {
  isPrimary: true,
  category: {
    select: categorySummarySelect,
  },
} satisfies Prisma.ProductCategorySelect;

const productListSelect = {
  id: true,
  sellerId: true,
  templateId: true,
  productName: true,
  brand: true,
  model: true,
  pricing: true,
  moq: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  inventory: {
    select: {
      availableQuantity: true,
    },
  },
  categories: {
    select: productCategorySelect,
  },
  template: {
    select: templateSummarySelect,
  },
  seller: {
    select: sellerSummarySelect,
  },
  media: {
    select: {
      fileUrl: true,
      displayOrder: true,
    },
    orderBy: {
      displayOrder: "asc" as const,
    },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const productDetailSelect = {
  ...productListSelect,
  description: true,
  details: true,
  attributes: true,
  media: {
    select: mediaSelect,
    orderBy: {
      displayOrder: "asc" as const,
    },
  },
  documents: {
    select: documentSelect,
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  inventory: {
    select: {
      availableQuantity: true,
    },
  },
  template: {
    select: {
      ...templateSummarySelect,
      fields: {
        select: templateFieldSelect,
        orderBy: [{ sortOrder: "asc" as const }, { key: "asc" as const }],
      },
    },
  },
} satisfies Prisma.ProductSelect;

export type ProductListRecord = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}>;

export type ProductDetailRecord = Prisma.ProductGetPayload<{
  select: typeof productDetailSelect;
}>;

export interface FindProductsOptions {
  page: number;
  limit: number;
  sortBy?: ProductSortField;
  sortOrder?: "asc" | "desc";
  useMarketplaceDefaultSort?: boolean;
  search?: string;
  categoryId?: string;
  categoryIds?: string[];
  brand?: string;
  status?: ProductStatus;
  minPrice?: string;
  maxPrice?: string;
  sellerId?: string;
  marketplaceOnly: boolean;
}

function buildSearchWhere(search?: string): Prisma.ProductWhereInput | undefined {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      { productName: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
    ],
  };
}

function buildProductWhere(
  options: Omit<FindProductsOptions, "page" | "limit" | "sortBy" | "sortOrder">,
): Prisma.ProductWhereInput {
  const {
    search,
    categoryId,
    categoryIds,
    brand,
    status,
    minPrice,
    maxPrice,
    sellerId,
    marketplaceOnly,
  } = options;

  const priceFilter: Prisma.DecimalFilter<"Product"> = {};
  if (minPrice !== undefined) {
    priceFilter.gte = minPrice;
  }
  if (maxPrice !== undefined) {
    priceFilter.lte = maxPrice;
  }

  const resolvedCategoryIds =
    categoryIds && categoryIds.length > 0
      ? [...new Set(categoryIds)]
      : categoryId
        ? [categoryId]
        : undefined;

  const categoryFilter: Prisma.ProductWhereInput | undefined =
    resolvedCategoryIds || marketplaceOnly
      ? {
          categories: {
            some: {
              ...(resolvedCategoryIds
                ? { categoryId: { in: resolvedCategoryIds } }
                : {}),
              ...(marketplaceOnly
                ? {
                    category: {
                      deletedAt: null,
                      isActive: true,
                    },
                  }
                : {}),
            },
          },
        }
      : undefined;

  const baseWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(sellerId ? { sellerId } : {}),
    ...(categoryFilter ?? {}),
    ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
    ...(status ? { status: status as PrismaProductStatus } : {}),
    ...(Object.keys(priceFilter).length > 0 ? { pricing: priceFilter } : {}),
    ...(marketplaceOnly
      ? {
          status: marketplacePublicStatusFilter,
          seller: {
            approvalStatus: SellerApprovalStatus.ACTIVE,
            user: {
              deletedAt: null,
              status: "ACTIVE",
            },
          },
        }
      : {}),
  };

  const searchWhere = buildSearchWhere(search);
  if (!searchWhere) {
    return baseWhere;
  }

  return {
    AND: [baseWhere, searchWhere],
  };
}

export interface CreateProductData {
  sellerId: string;
  categoryIds: string[];
  primaryCategoryId: string;
  templateId?: string | null;
  productName: string;
  brand: string;
  model: string;
  pricing: Prisma.Decimal;
  moq: number;
  description: string;
  details?: string | null;
  attributes?: Prisma.InputJsonValue;
  status: ProductStatus;
}

export interface UpdateProductData {
  templateId?: string | null;
  productName?: string;
  brand?: string;
  model?: string;
  pricing?: Prisma.Decimal;
  moq?: number;
  description?: string;
  details?: string | null;
  attributes?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  status?: ProductStatus;
}

export class ProductRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  createWithInventory(
    data: CreateProductData,
    media: { fileUploadId: string; fileUrl: string; displayOrder: number }[],
    documents: {
      fileUploadId: string;
      fileUrl: string;
      documentType: string;
    }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId: data.sellerId,
          templateId: data.templateId ?? null,
          productName: data.productName,
          brand: data.brand,
          model: data.model,
          pricing: data.pricing,
          moq: data.moq,
          description: data.description,
          details: data.details ?? null,
          attributes: data.attributes ?? undefined,
          status: data.status as PrismaProductStatus,
          categories: {
            create: data.categoryIds.map((categoryId) => ({
              categoryId,
              isPrimary: categoryId === data.primaryCategoryId,
            })),
          },
          inventory: {
            create: {
              availableQuantity: 0,
            },
          },
          ...(media.length > 0
            ? {
                media: {
                  create: media,
                },
              }
            : {}),
          ...(documents.length > 0
            ? {
                documents: {
                  create: documents,
                },
              }
            : {}),
        },
        select: productDetailSelect,
      });

      return product;
    });
  }

  findDetailById(id: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: productDetailSelect,
    });
  }

  findMarketplaceDetailById(id: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
        status: marketplacePublicStatusFilter,
        seller: {
          approvalStatus: SellerApprovalStatus.ACTIVE,
          user: {
            deletedAt: null,
            status: "ACTIVE",
          },
        },
        categories: {
          some: {
            category: {
              deletedAt: null,
              isActive: true,
            },
          },
        },
      },
      select: productDetailSelect,
    });
  }

  findMarketplaceDetailsByIds(ids: string[]) {
    return this.prisma.product.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        status: marketplacePublicStatusFilter,
        seller: {
          approvalStatus: SellerApprovalStatus.ACTIVE,
          user: {
            deletedAt: null,
            status: "ACTIVE",
          },
        },
        categories: {
          some: {
            category: {
              deletedAt: null,
              isActive: true,
            },
          },
        },
      },
      select: productDetailSelect,
    });
  }

  findByIdForSeller(id: string, sellerId: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        sellerId,
        deletedAt: null,
      },
      select: productDetailSelect,
    });
  }

  findManyPaginated(options: FindProductsOptions) {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      useMarketplaceDefaultSort,
      marketplaceOnly,
    } = options;
    const skip = (page - 1) * limit;
    const where = buildProductWhere(options);
    const orderBy = buildProductOrderBy({
      sortBy,
      sortOrder,
      useMarketplaceDefaultSort,
      preferInStockFirst: marketplaceOnly,
    });

    return this.prisma.product.findMany({
      where,
      select: productListSelect,
      orderBy,
      skip,
      take: limit,
    });
  }

  count(
    options: Omit<
      FindProductsOptions,
      "page" | "limit" | "sortBy" | "sortOrder"
    >,
  ) {
    return this.prisma.product.count({
      where: buildProductWhere(options),
    });
  }

  update(id: string, data: UpdateProductData) {
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(data.templateId !== undefined ? { templateId: data.templateId } : {}),
        ...(data.productName !== undefined
          ? { productName: data.productName }
          : {}),
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.pricing !== undefined ? { pricing: data.pricing } : {}),
        ...(data.moq !== undefined ? { moq: data.moq } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.details !== undefined ? { details: data.details } : {}),
        ...(data.attributes !== undefined
          ? { attributes: data.attributes }
          : {}),
        ...(data.status !== undefined
          ? { status: data.status as PrismaProductStatus }
          : {}),
      },
      select: productDetailSelect,
    });
  }

  async replaceCategories(
    productId: string,
    categoryIds: string[],
    primaryCategoryId: string,
  ) {
    await this.prisma.productCategory.deleteMany({ where: { productId } });
    await this.prisma.productCategory.createMany({
      data: categoryIds.map((categoryId) => ({
        productId,
        categoryId,
        isPrimary: categoryId === primaryCategoryId,
      })),
    });
  }

  updateStatus(id: string, status: ProductStatus) {
    return this.prisma.product.update({
      where: { id },
      data: {
        status: status as PrismaProductStatus,
      },
      select: productDetailSelect,
    });
  }

  findSellerUserIdByProductId(productId: string) {
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        deletedAt: null,
      },
      select: {
        id: true,
        seller: {
          select: {
            userId: true,
            businessName: true,
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
  }) {
    return this.prisma.notification.create({
      data,
      select: { id: true },
    });
  }
}

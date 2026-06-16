import type {
  Prisma,
  PrismaClient,
  ProductStatus as PrismaProductStatus,
} from "../../../../generated/prisma/client.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import type { ProductSortField } from "../constants/product.constants.js";

const categorySummarySelect = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

const sellerSummarySelect = {
  id: true,
  businessName: true,
} satisfies Prisma.SellerProfileSelect;

const mediaSelect = {
  id: true,
  fileUrl: true,
  displayOrder: true,
  createdAt: true,
} satisfies Prisma.ProductMediaSelect;

const documentSelect = {
  id: true,
  fileUrl: true,
  documentType: true,
  createdAt: true,
} satisfies Prisma.ProductDocumentSelect;

const productListSelect = {
  id: true,
  sellerId: true,
  categoryId: true,
  productName: true,
  brand: true,
  model: true,
  productType: true,
  pricing: true,
  moq: true,
  deliveryTime: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: categorySummarySelect,
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
  color: true,
  weight: true,
  length: true,
  warrantyPeriod: true,
  returnTime: true,
  description: true,
  details: true,
  specifications: true,
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
  sortBy: ProductSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  categoryId?: string;
  brand?: string;
  status?: ProductStatus;
  minPrice?: string;
  maxPrice?: string;
  sellerId?: string;
  marketplaceOnly: boolean;
}

function mapSortField(
  sortBy: ProductSortField,
): keyof Prisma.ProductOrderByWithRelationInput {
  switch (sortBy) {
    case "price":
      return "pricing";
    case "deliveryTime":
      return "deliveryTime";
    case "newest":
    default:
      return "createdAt";
  }
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

  const baseWhere: Prisma.ProductWhereInput = {
    deletedAt: null,
    ...(sellerId ? { sellerId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
    ...(status ? { status: status as PrismaProductStatus } : {}),
    ...(Object.keys(priceFilter).length > 0 ? { pricing: priceFilter } : {}),
    ...(marketplaceOnly
      ? {
          status: ProductStatus.APPROVED,
          seller: {
            approvalStatus: SellerApprovalStatus.ACTIVE,
            user: {
              deletedAt: null,
              status: "ACTIVE",
            },
          },
          category: {
            deletedAt: null,
            isActive: true,
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
  categoryId: string;
  productName: string;
  brand: string;
  model: string;
  productType: string;
  color?: string | null;
  weight?: Prisma.Decimal | null;
  length?: Prisma.Decimal | null;
  warrantyPeriod?: number | null;
  returnTime?: number | null;
  deliveryTime?: number | null;
  pricing: Prisma.Decimal;
  moq: number;
  description: string;
  details?: string | null;
  specifications?: Prisma.InputJsonValue;
  status: ProductStatus;
}

export interface UpdateProductData {
  categoryId?: string;
  productName?: string;
  brand?: string;
  model?: string;
  productType?: string;
  color?: string | null;
  weight?: Prisma.Decimal | null;
  length?: Prisma.Decimal | null;
  warrantyPeriod?: number | null;
  returnTime?: number | null;
  deliveryTime?: number | null;
  pricing?: Prisma.Decimal;
  moq?: number;
  description?: string;
  details?: string | null;
  specifications?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
}

export class ProductRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  createWithInventory(
    data: CreateProductData,
    media: { fileUrl: string; displayOrder: number }[],
    documents: { fileUrl: string; documentType: string }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId: data.sellerId,
          categoryId: data.categoryId,
          productName: data.productName,
          brand: data.brand,
          model: data.model,
          productType: data.productType,
          color: data.color ?? null,
          weight: data.weight ?? null,
          length: data.length ?? null,
          warrantyPeriod: data.warrantyPeriod ?? null,
          returnTime: data.returnTime ?? null,
          deliveryTime: data.deliveryTime ?? null,
          pricing: data.pricing,
          moq: data.moq,
          description: data.description,
          details: data.details ?? null,
          specifications: data.specifications ?? undefined,
          status: data.status as PrismaProductStatus,
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
        status: ProductStatus.APPROVED,
        seller: {
          approvalStatus: SellerApprovalStatus.ACTIVE,
          user: {
            deletedAt: null,
            status: "ACTIVE",
          },
        },
        category: {
          deletedAt: null,
          isActive: true,
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
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;
    const where = buildProductWhere(options);
    const sortField = mapSortField(sortBy);

    return this.prisma.product.findMany({
      where,
      select: productListSelect,
      orderBy: {
        [sortField]: sortOrder,
      },
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
      data,
      select: productDetailSelect,
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

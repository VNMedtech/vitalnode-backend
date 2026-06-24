import type {
  Prisma,
  PrismaClient,
  ReviewStatus as PrismaReviewStatus,
} from "../../../../generated/prisma/client.js";
import { ReviewStatus } from "../../../shared/enums/reviewStatus.enum.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";

const buyerSummarySelect = {
  id: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.BuyerProfileSelect;

const productSummarySelect = {
  id: true,
  productName: true,
  brand: true,
  model: true,
} satisfies Prisma.ProductSelect;

const reviewSelect = {
  id: true,
  productId: true,
  buyerId: true,
  rating: true,
  title: true,
  comment: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  buyer: {
    select: buyerSummarySelect,
  },
} satisfies Prisma.ProductReviewSelect;

const adminReviewSelect = {
  ...reviewSelect,
  product: {
    select: productSummarySelect,
  },
} satisfies Prisma.ProductReviewSelect;

export type ReviewRecord = Prisma.ProductReviewGetPayload<{
  select: typeof reviewSelect;
}>;

export type AdminReviewRecord = Prisma.ProductReviewGetPayload<{
  select: typeof adminReviewSelect;
}>;

export interface FindReviewsOptions {
  page: number;
  limit: number;
  productId?: string;
  buyerId?: string;
  status?: ReviewStatus;
  activeOnly?: boolean;
}

export interface CreateReviewData {
  productId: string;
  buyerId: string;
  rating: number;
  title: string;
  comment: string;
}

export interface UpdateReviewData {
  rating?: number;
  title?: string;
  comment?: string;
}

export interface ProductReviewStatsRecord {
  averageRating: number | null;
  reviewCount: number;
}

export class ReviewRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findById(id: string) {
    return this.prisma.productReview.findUnique({
      where: { id },
      select: reviewSelect,
    });
  }

  findByIdForAdmin(id: string) {
    return this.prisma.productReview.findUnique({
      where: { id },
      select: adminReviewSelect,
    });
  }

  findByProductAndBuyer(productId: string, buyerId: string) {
    return this.prisma.productReview.findUnique({
      where: {
        productId_buyerId: {
          productId,
          buyerId,
        },
      },
      select: { id: true },
    });
  }

  create(data: CreateReviewData) {
    return this.prisma.productReview.create({
      data,
      select: reviewSelect,
    });
  }

  update(id: string, data: UpdateReviewData) {
    return this.prisma.productReview.update({
      where: { id },
      data,
      select: reviewSelect,
    });
  }

  delete(id: string) {
    return this.prisma.productReview.delete({
      where: { id },
      select: { id: true, productId: true },
    });
  }

  disable(id: string) {
    return this.prisma.productReview.update({
      where: { id },
      data: { status: ReviewStatus.DISABLED as PrismaReviewStatus },
      select: adminReviewSelect,
    });
  }

  findManyPaginated(options: FindReviewsOptions) {
    const where = this.buildWhere(options);
    const skip = (options.page - 1) * options.limit;

    return this.prisma.productReview.findMany({
      where,
      select: options.activeOnly === false ? adminReviewSelect : reviewSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: options.limit,
    });
  }

  count(options: Omit<FindReviewsOptions, "page" | "limit">) {
    return this.prisma.productReview.count({
      where: this.buildWhere(options),
    });
  }

  async getStatsForProduct(productId: string): Promise<ProductReviewStatsRecord> {
    const stats = await this.getStatsForProductIds([productId]);
    return stats.get(productId) ?? { averageRating: null, reviewCount: 0 };
  }

  findFeatured(limit: number) {
    return this.prisma.productReview.findMany({
      where: {
        status: ReviewStatus.ACTIVE as PrismaReviewStatus,
        rating: { gte: 4 },
        product: {
          status: ProductStatus.APPROVED,
        },
      },
      select: adminReviewSelect,
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
  }

  async getPlatformStats(): Promise<ProductReviewStatsRecord> {
    const [aggregate, reviewCount] = await Promise.all([
      this.prisma.productReview.aggregate({
        where: {
          status: ReviewStatus.ACTIVE as PrismaReviewStatus,
          product: { status: "APPROVED" },
        },
        _avg: { rating: true },
      }),
      this.prisma.productReview.count({
        where: {
          status: ReviewStatus.ACTIVE as PrismaReviewStatus,
          product: { status: "APPROVED" },
        },
      }),
    ]);

    return {
      averageRating: aggregate._avg.rating,
      reviewCount,
    };
  }

  async getStatsForProductIds(
    productIds: string[],
  ): Promise<Map<string, ProductReviewStatsRecord>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.productReview.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        status: ReviewStatus.ACTIVE as PrismaReviewStatus,
      },
      _avg: { rating: true },
      _count: { id: true },
    });

    const stats = new Map<string, ProductReviewStatsRecord>();
    for (const productId of productIds) {
      stats.set(productId, { averageRating: null, reviewCount: 0 });
    }

    for (const row of rows) {
      stats.set(row.productId, {
        averageRating: row._avg.rating,
        reviewCount: row._count.id,
      });
    }

    return stats;
  }

  private buildWhere(
    options: Omit<FindReviewsOptions, "page" | "limit">,
  ): Prisma.ProductReviewWhereInput {
    const where: Prisma.ProductReviewWhereInput = {};

    if (options.productId) {
      where.productId = options.productId;
    }

    if (options.buyerId) {
      where.buyerId = options.buyerId;
    }

    if (options.status) {
      where.status = options.status as PrismaReviewStatus;
    } else if (options.activeOnly) {
      where.status = ReviewStatus.ACTIVE as PrismaReviewStatus;
    }

    return where;
  }
}

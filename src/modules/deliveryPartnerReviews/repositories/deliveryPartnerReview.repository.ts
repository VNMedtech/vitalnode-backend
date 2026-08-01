import type {
  Prisma,
  PrismaClient,
  DeliveryPartnerCommentStatus as PrismaDeliveryPartnerCommentStatus,
} from "../../../../generated/prisma/client.js";
import type { DeliveryPartnerCommentStatus } from "../../../shared/enums/deliveryPartnerCommentStatus.enum.js";
import { DeliveryPartnerCommentStatus as CommentStatus } from "../../../shared/enums/deliveryPartnerCommentStatus.enum.js";

const buyerSummarySelect = {
  id: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.BuyerProfileSelect;

const deliveryPartnerSummarySelect = {
  id: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.DeliveryPartnerProfileSelect;

const orderSummarySelect = {
  id: true,
  orderNumber: true,
} satisfies Prisma.OrderSelect;

export const deliveryPartnerReviewSelect = {
  id: true,
  orderId: true,
  deliveryPartnerId: true,
  buyerId: true,
  rating: true,
  comment: true,
  commentStatus: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeliveryPartnerReviewSelect;

export const adminDeliveryPartnerReviewSelect = {
  ...deliveryPartnerReviewSelect,
  buyer: {
    select: buyerSummarySelect,
  },
  deliveryPartner: {
    select: deliveryPartnerSummarySelect,
  },
  order: {
    select: orderSummarySelect,
  },
} satisfies Prisma.DeliveryPartnerReviewSelect;

/** Partner `/mine` list: rating + order; buyer identity is not exposed. */
export const deliveryPartnerReviewForPartnerSelect = {
  ...deliveryPartnerReviewSelect,
  order: {
    select: orderSummarySelect,
  },
} satisfies Prisma.DeliveryPartnerReviewSelect;

export type DeliveryPartnerReviewRecord =
  Prisma.DeliveryPartnerReviewGetPayload<{
    select: typeof deliveryPartnerReviewSelect;
  }>;

export type DeliveryPartnerReviewForPartnerRecord =
  Prisma.DeliveryPartnerReviewGetPayload<{
    select: typeof deliveryPartnerReviewForPartnerSelect;
  }>;

export type AdminDeliveryPartnerReviewRecord =
  Prisma.DeliveryPartnerReviewGetPayload<{
    select: typeof adminDeliveryPartnerReviewSelect;
  }>;

export interface CreateDeliveryPartnerReviewData {
  orderId: string;
  deliveryPartnerId: string;
  buyerId: string;
  rating: number;
  comment: string | null;
  commentStatus: DeliveryPartnerCommentStatus | null;
}

export interface UpdateDeliveryPartnerReviewData {
  rating?: number;
  comment?: string | null;
  commentStatus?: DeliveryPartnerCommentStatus | null;
}

export interface FindDeliveryPartnerReviewsOptions {
  page: number;
  limit: number;
  deliveryPartnerId?: string;
  buyerId?: string;
  orderId?: string;
  commentStatus?: DeliveryPartnerCommentStatus;
}

export interface DeliveryPartnerRatingStatsRecord {
  averageRating: number | null;
  ratingCount: number;
}

/** Reviews included in partner rating aggregates (everything except DISABLED). */
function aggregateWhere(
  deliveryPartnerId: string,
): Prisma.DeliveryPartnerReviewWhereInput {
  return {
    deliveryPartnerId,
    OR: [
      { commentStatus: null },
      { commentStatus: { not: CommentStatus.DISABLED } },
    ],
  };
}

export class DeliveryPartnerReviewRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findById(id: string) {
    return this.prisma.deliveryPartnerReview.findUnique({
      where: { id },
      select: deliveryPartnerReviewSelect,
    });
  }

  findByIdForAdmin(id: string) {
    return this.prisma.deliveryPartnerReview.findUnique({
      where: { id },
      select: adminDeliveryPartnerReviewSelect,
    });
  }

  findByOrderId(orderId: string) {
    return this.prisma.deliveryPartnerReview.findUnique({
      where: { orderId },
      select: deliveryPartnerReviewSelect,
    });
  }

  create(data: CreateDeliveryPartnerReviewData) {
    return this.prisma.deliveryPartnerReview.create({
      data,
      select: deliveryPartnerReviewSelect,
    });
  }

  update(id: string, data: UpdateDeliveryPartnerReviewData) {
    return this.prisma.deliveryPartnerReview.update({
      where: { id },
      data,
      select: deliveryPartnerReviewSelect,
    });
  }

  approve(id: string) {
    return this.prisma.deliveryPartnerReview.update({
      where: { id },
      data: {
        commentStatus:
          CommentStatus.APPROVED as PrismaDeliveryPartnerCommentStatus,
      },
      select: adminDeliveryPartnerReviewSelect,
    });
  }

  disable(id: string) {
    return this.prisma.deliveryPartnerReview.update({
      where: { id },
      data: {
        commentStatus:
          CommentStatus.DISABLED as PrismaDeliveryPartnerCommentStatus,
      },
      select: adminDeliveryPartnerReviewSelect,
    });
  }

  findManyPaginated(options: FindDeliveryPartnerReviewsOptions) {
    const where = this.buildAdminWhere(options);
    const skip = (options.page - 1) * options.limit;

    return this.prisma.deliveryPartnerReview.findMany({
      where,
      select: adminDeliveryPartnerReviewSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: options.limit,
    });
  }

  count(options: Omit<FindDeliveryPartnerReviewsOptions, "page" | "limit">) {
    return this.prisma.deliveryPartnerReview.count({
      where: this.buildAdminWhere(options),
    });
  }

  /** Non-DISABLED reviews for the partner Feedback list (ratings always; comments filtered in DTO). */
  findPartnerVisibleReviewsPaginated(options: {
    deliveryPartnerId: string;
    page: number;
    limit: number;
  }) {
    const where = aggregateWhere(options.deliveryPartnerId);
    const skip = (options.page - 1) * options.limit;

    return this.prisma.deliveryPartnerReview.findMany({
      where,
      select: deliveryPartnerReviewForPartnerSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: options.limit,
    });
  }

  countPartnerVisibleReviews(deliveryPartnerId: string) {
    return this.prisma.deliveryPartnerReview.count({
      where: aggregateWhere(deliveryPartnerId),
    });
  }

  async getStatsForPartner(
    deliveryPartnerId: string,
  ): Promise<DeliveryPartnerRatingStatsRecord> {
    const where = aggregateWhere(deliveryPartnerId);

    const [aggregate, ratingCount] = await Promise.all([
      this.prisma.deliveryPartnerReview.aggregate({
        where,
        _avg: { rating: true },
      }),
      this.prisma.deliveryPartnerReview.count({ where }),
    ]);

    return {
      averageRating: aggregate._avg.rating,
      ratingCount,
    };
  }

  private buildAdminWhere(
    options: Omit<FindDeliveryPartnerReviewsOptions, "page" | "limit">,
  ): Prisma.DeliveryPartnerReviewWhereInput {
    const where: Prisma.DeliveryPartnerReviewWhereInput = {};

    if (options.deliveryPartnerId) {
      where.deliveryPartnerId = options.deliveryPartnerId;
    }

    if (options.buyerId) {
      where.buyerId = options.buyerId;
    }

    if (options.orderId) {
      where.orderId = options.orderId;
    }

    if (options.commentStatus) {
      where.commentStatus = options.commentStatus;
    }

    return where;
  }
}

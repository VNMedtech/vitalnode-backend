import type {
  Prisma,
  PrismaClient,
  SellerApprovalStatus,
} from "../../../../generated/prisma/client.js";
import type { SellerSortField } from "../constants/seller.constants.js";

const sellerUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
  status: true,
} satisfies Prisma.UserSelect;

const sellerListSelect = {
  id: true,
  userId: true,
  businessName: true,
  contactPerson: true,
  city: true,
  state: true,
  country: true,
  approvalStatus: true,
  commissionPercentage: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: sellerUserSelect,
  },
} satisfies Prisma.SellerProfileSelect;

const sellerDetailSelect = {
  ...sellerListSelect,
  addressLine1: true,
  addressLine2: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  documents: {
    select: {
      id: true,
      fileUrl: true,
      fileType: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.SellerProfileSelect;

export type SellerListRecord = Prisma.SellerProfileGetPayload<{
  select: typeof sellerListSelect;
}>;

export type SellerDetailRecord = Prisma.SellerProfileGetPayload<{
  select: typeof sellerDetailSelect;
}>;

export interface FindSellersOptions {
  page: number;
  limit: number;
  sortBy: SellerSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  companyName?: string;
  email?: string;
  approvalStatus?: SellerApprovalStatus;
  city?: string;
  state?: string;
  country?: string;
}

function buildSellerWhere(
  options: Pick<
    FindSellersOptions,
    | "search"
    | "companyName"
    | "email"
    | "approvalStatus"
    | "city"
    | "state"
    | "country"
  >,
): Prisma.SellerProfileWhereInput {
  const { search, companyName, email, approvalStatus, city, state, country } =
    options;

  const baseWhere: Prisma.SellerProfileWhereInput = {
    user: {
      deletedAt: null,
      role: "SELLER",
      ...(email ? { email: { contains: email, mode: "insensitive" } } : {}),
    },
    ...(approvalStatus ? { approvalStatus } : {}),
    ...(companyName
      ? { businessName: { contains: companyName, mode: "insensitive" } }
      : {}),
    ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
    ...(state ? { state: { equals: state, mode: "insensitive" } } : {}),
    ...(country ? { country: { equals: country, mode: "insensitive" } } : {}),
  };

  if (!search) {
    return baseWhere;
  }

  return {
    AND: [
      baseWhere,
      {
        OR: [
          { businessName: { contains: search, mode: "insensitive" } },
          { contactPerson: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          {
            user: {
              deletedAt: null,
              role: "SELLER",
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
    ],
  };
}

export class SellerRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findIdByUserId(userId: string) {
    return this.prisma.sellerProfile.findFirst({
      where: {
        userId,
        user: {
          deletedAt: null,
          role: "SELLER",
        },
      },
      select: {
        id: true,
        approvalStatus: true,
      },
    });
  }

  findById(id: string) {
    return this.prisma.sellerProfile.findFirst({
      where: {
        id,
        user: {
          deletedAt: null,
          role: "SELLER",
        },
      },
      select: sellerDetailSelect,
    });
  }

  findManyPaginated(options: FindSellersOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;
    const where = buildSellerWhere(options);

    const orderBy: Prisma.SellerProfileOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    return this.prisma.sellerProfile.findMany({
      where,
      select: sellerListSelect,
      orderBy,
      skip,
      take: limit,
    });
  }

  count(
    options: Pick<
      FindSellersOptions,
      | "search"
      | "companyName"
      | "email"
      | "approvalStatus"
      | "city"
      | "state"
      | "country"
    >,
  ) {
    return this.prisma.sellerProfile.count({
      where: buildSellerWhere(options),
    });
  }

  updateApprovalStatus(id: string, approvalStatus: SellerApprovalStatus) {
    return this.prisma.sellerProfile.update({
      where: { id },
      data: { approvalStatus },
      select: sellerDetailSelect,
    });
  }

  approveWithCommission(
    id: string,
    commissionPercentage: Prisma.Decimal,
  ) {
    return this.prisma.sellerProfile.update({
      where: { id },
      data: {
        approvalStatus: "ACTIVE",
        commissionPercentage,
      },
      select: sellerDetailSelect,
    });
  }

  updateCommissionPercentage(id: string, commissionPercentage: Prisma.Decimal) {
    return this.prisma.sellerProfile.update({
      where: { id },
      data: { commissionPercentage },
      select: sellerDetailSelect,
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

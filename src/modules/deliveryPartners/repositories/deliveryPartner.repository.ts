import type {
  Prisma,
  PrismaClient,
  UserStatus,
} from "../../../../generated/prisma/client.js";
import type { DeliveryPartnerSortField } from "../constants/deliveryPartner.constants.js";

const deliveryPartnerUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
  status: true,
  mustChangePassword: true,
} satisfies Prisma.UserSelect;

const deliveryPartnerListSelect = {
  id: true,
  userId: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: deliveryPartnerUserSelect,
  },
} satisfies Prisma.DeliveryPartnerProfileSelect;

const deliveryPartnerDetailSelect = deliveryPartnerListSelect;

export type DeliveryPartnerListRecord = Prisma.DeliveryPartnerProfileGetPayload<{
  select: typeof deliveryPartnerListSelect;
}>;

export type DeliveryPartnerDetailRecord =
  Prisma.DeliveryPartnerProfileGetPayload<{
    select: typeof deliveryPartnerDetailSelect;
  }>;

export interface FindDeliveryPartnersOptions {
  page: number;
  limit: number;
  sortBy: DeliveryPartnerSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  status?: UserStatus;
  city?: string;
  state?: string;
  country?: string;
}

function buildDeliveryPartnerWhere(
  options: Pick<
    FindDeliveryPartnersOptions,
    "search" | "status" | "city" | "state" | "country"
  >,
): Prisma.DeliveryPartnerProfileWhereInput {
  const { search, status, city, state, country } = options;

  const baseWhere: Prisma.DeliveryPartnerProfileWhereInput = {
    user: {
      deletedAt: null,
      role: "DELIVERY_PARTNER",
      ...(status ? { status } : {}),
    },
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
          { city: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
          { country: { contains: search, mode: "insensitive" } },
          { postalCode: { contains: search, mode: "insensitive" } },
          {
            user: {
              deletedAt: null,
              role: "DELIVERY_PARTNER",
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phoneNumber: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
    ],
  };
}

export class DeliveryPartnerRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findById(id: string) {
    return this.prisma.deliveryPartnerProfile.findFirst({
      where: {
        id,
        user: {
          deletedAt: null,
          role: "DELIVERY_PARTNER",
        },
      },
      select: deliveryPartnerDetailSelect,
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, role: true },
    });
  }

  findUserByPhone(phoneNumber: string) {
    return this.prisma.user.findFirst({
      where: {
        phoneNumber,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  findUserByPhoneExcludingUser(phoneNumber: string, excludeUserId: string) {
    return this.prisma.user.findFirst({
      where: {
        phoneNumber,
        deletedAt: null,
        id: { not: excludeUserId },
      },
      select: { id: true },
    });
  }

  createDeliveryPartner(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  }) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: "DELIVERY_PARTNER",
        status: "ACTIVE",
        mustChangePassword: true,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        deliveryPartnerProfile: {
          create: {
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2,
            city: input.city,
            state: input.state,
            country: input.country,
            postalCode: input.postalCode,
          },
        },
      },
      select: {
        deliveryPartnerProfile: {
          select: deliveryPartnerDetailSelect,
        },
      },
    });
  }

  updateDeliveryPartner(
    id: string,
    userId: string,
    data: {
      user?: {
        firstName?: string;
        lastName?: string;
        phoneNumber?: string | null;
      };
      profile?: {
        addressLine1?: string;
        addressLine2?: string | null;
        city?: string;
        state?: string;
        country?: string;
        postalCode?: string;
      };
    },
  ) {
    return this.prisma.deliveryPartnerProfile.update({
      where: { id },
      data: {
        ...(data.profile ?? {}),
        ...(data.user
          ? {
              user: {
                update: data.user,
              },
            }
          : {}),
      },
      select: deliveryPartnerDetailSelect,
    });
  }

  updateUserStatus(userId: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, status: true },
    });
  }

  findManyPaginated(options: FindDeliveryPartnersOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;
    const where = buildDeliveryPartnerWhere(options);

    const orderBy: Prisma.DeliveryPartnerProfileOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    return this.prisma.deliveryPartnerProfile.findMany({
      where,
      select: deliveryPartnerListSelect,
      orderBy,
      skip,
      take: limit,
    });
  }

  count(
    options: Pick<
      FindDeliveryPartnersOptions,
      "search" | "status" | "city" | "state" | "country"
    >,
  ) {
    return this.prisma.deliveryPartnerProfile.count({
      where: buildDeliveryPartnerWhere(options),
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

import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { AdminModule } from "../../../shared/enums/adminModule.enum.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import type { SubAdminSortField } from "../constants/subAdmin.constants.js";

const subAdminSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
  status: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
  subAdminModules: {
    select: { module: true },
    orderBy: { module: "asc" },
  },
} satisfies Prisma.UserSelect;

export type SubAdminRecord = Prisma.UserGetPayload<{
  select: typeof subAdminSelect;
}>;

export interface FindSubAdminsOptions {
  page: number;
  limit: number;
  sortBy: SubAdminSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  status?: UserStatus;
}

function buildSubAdminWhere(
  options: Omit<FindSubAdminsOptions, "page" | "limit" | "sortBy" | "sortOrder">,
): Prisma.UserWhereInput {
  const { search, status } = options;
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    role: UserRole.SUB_ADMIN,
    ...(status ? { status } : {}),
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { phoneNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  return where;
}

export class SubAdminRepository {
  constructor(private readonly prisma: PrismaClient | Prisma.TransactionClient) {}

  findMany(options: FindSubAdminsOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    return this.prisma.user.findMany({
      where: buildSubAdminWhere(options),
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: subAdminSelect,
    });
  }

  count(options: Omit<FindSubAdminsOptions, "page" | "limit" | "sortBy" | "sortOrder">) {
    return this.prisma.user.count({
      where: buildSubAdminWhere(options),
    });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null, role: UserRole.SUB_ADMIN },
      select: subAdminSelect,
    });
  }

  findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });
  }

  findUserByPhone(phoneNumber: string) {
    return this.prisma.user.findFirst({
      where: { phoneNumber, deletedAt: null },
      select: { id: true },
    });
  }

  createSubAdmin(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    modules: AdminModule[];
  }) {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: UserRole.SUB_ADMIN,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        subAdminModules: {
          create: input.modules.map((module) => ({ module })),
        },
      },
      select: subAdminSelect,
    });
  }

  updateSubAdmin(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string | null;
      modules?: AdminModule[];
    },
  ) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber } : {}),
        ...(data.modules
          ? {
              subAdminModules: {
                deleteMany: {},
                create: data.modules.map((module) => ({ module })),
              },
            }
          : {}),
      },
      select: subAdminSelect,
    });
  }

  updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status },
      select: subAdminSelect,
    });
  }

  softDelete(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.DISABLED },
      select: subAdminSelect,
    });
  }

  revokeAllActiveSessions(userId: string, revokedAt = new Date()) {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }

  findLastLoginAt(userId: string) {
    return this.prisma.authSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
  }

  createNotification(input: {
    userId: string;
    type: string;
    title: string;
    message: string;
  }) {
    return this.prisma.notification.create({
      data: input,
    });
  }
}

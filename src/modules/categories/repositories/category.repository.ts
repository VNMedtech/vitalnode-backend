import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { CategorySortField } from "../constants/category.constants.js";

const categorySelect = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

export type CategoryRecord = Prisma.CategoryGetPayload<{
  select: typeof categorySelect;
}>;

export interface FindCategoriesOptions {
  page: number;
  limit: number;
  sortBy: CategorySortField;
  sortOrder: "asc" | "desc";
  search?: string;
  publicOnly: boolean;
}

export class CategoryRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  create(data: { name: string; description?: string | null }) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        description: data.description ?? null,
      },
      select: categorySelect,
    });
  }

  findActiveById(id: string) {
    return this.prisma.category.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
      },
      select: categorySelect,
    });
  }

  findByIdNotDeleted(id: string) {
    return this.prisma.category.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: categorySelect,
    });
  }

  findByName(name: string, excludeId?: string) {
    return this.prisma.category.findFirst({
      where: {
        name,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  }

  findManyPaginated(options: FindCategoriesOptions) {
    const { page, limit, sortBy, sortOrder, search, publicOnly } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(publicOnly ? { isActive: true } : {}),
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
    };

    const orderBy: Prisma.CategoryOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    return this.prisma.category.findMany({
      where,
      select: categorySelect,
      orderBy,
      skip,
      take: limit,
    });
  }

  count(options: Pick<FindCategoriesOptions, "search" | "publicOnly">) {
    const { search, publicOnly } = options;

    return this.prisma.category.count({
      where: {
        deletedAt: null,
        ...(publicOnly ? { isActive: true } : {}),
        ...(search
          ? {
              name: {
                contains: search,
                mode: "insensitive",
              },
            }
          : {}),
      },
    });
  }

  update(
    id: string,
    data: { name?: string; description?: string | null },
  ) {
    return this.prisma.category.update({
      where: { id },
      data,
      select: categorySelect,
    });
  }

  softDelete(id: string, deletedAt = new Date()) {
    return this.prisma.category.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt,
      },
      select: categorySelect,
    });
  }
}

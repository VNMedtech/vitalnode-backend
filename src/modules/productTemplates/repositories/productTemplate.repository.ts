import {
  Prisma,
  type PrismaClient,
  type ProductTemplateFieldType,
} from "../../../../generated/prisma/client.js";
import type { ProductTemplateSortField } from "../constants/productTemplate.constants.js";

const categorySummarySelect = {
  id: true,
  name: true,
} satisfies Prisma.CategorySelect;

const fieldSelect = {
  id: true,
  key: true,
  label: true,
  fieldType: true,
  options: true,
  defaultValue: true,
  unit: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProductTemplateFieldSelect;

const templateListSelect = {
  id: true,
  name: true,
  description: true,
  baseDefaults: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    select: {
      category: {
        select: categorySummarySelect,
      },
    },
  },
  _count: {
    select: {
      fields: { where: { isActive: true } },
    },
  },
} satisfies Prisma.ProductTemplateSelect;

const templateDetailSelect = {
  id: true,
  name: true,
  description: true,
  baseDefaults: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    select: {
      category: {
        select: categorySummarySelect,
      },
    },
  },
  fields: {
    select: fieldSelect,
    orderBy: [{ sortOrder: "asc" as const }, { key: "asc" as const }],
  },
} satisfies Prisma.ProductTemplateSelect;

export type ProductTemplateListRecord = Prisma.ProductTemplateGetPayload<{
  select: typeof templateListSelect;
}>;

export type ProductTemplateDetailRecord = Prisma.ProductTemplateGetPayload<{
  select: typeof templateDetailSelect;
}>;

export interface FindProductTemplatesOptions {
  page: number;
  limit: number;
  sortBy: ProductTemplateSortField;
  sortOrder: "asc" | "desc";
  q?: string;
  categoryId?: string;
  isActive?: boolean;
  includeInactive?: boolean;
}

export interface ProductTemplateFieldCreateData {
  key: string;
  label: string;
  fieldType: ProductTemplateFieldType;
  options?: Prisma.InputJsonValue;
  defaultValue?: Prisma.InputJsonValue;
  unit?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CreateProductTemplateData {
  name: string;
  description?: string | null;
  baseDefaults?: Prisma.InputJsonValue | null;
  isActive: boolean;
  categoryIds: string[];
  fields: ProductTemplateFieldCreateData[];
}

export interface UpdateProductTemplateData {
  name?: string;
  description?: string | null;
  baseDefaults?: Prisma.InputJsonValue | null;
  isActive?: boolean;
}

function buildTemplateWhere(
  options: Omit<
    FindProductTemplatesOptions,
    "page" | "limit" | "sortBy" | "sortOrder"
  >,
): Prisma.ProductTemplateWhereInput {
  const { q, categoryId, isActive, includeInactive } = options;

  return {
    deletedAt: null,
    ...(includeInactive ? {} : { isActive: true }),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(categoryId
      ? {
          categories: {
            some: { categoryId },
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export class ProductTemplateRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  create(data: CreateProductTemplateData) {
    return this.prisma.productTemplate.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        baseDefaults:
          data.baseDefaults === undefined
            ? undefined
            : data.baseDefaults === null
              ? Prisma.DbNull
              : data.baseDefaults,
        isActive: data.isActive,
        ...(data.categoryIds.length > 0
          ? {
              categories: {
                create: data.categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              },
            }
          : {}),
        ...(data.fields.length > 0
          ? {
              fields: {
                create: data.fields.map((field) => ({
                  key: field.key,
                  label: field.label,
                  fieldType: field.fieldType,
                  options: field.options,
                  defaultValue: field.defaultValue,
                  unit: field.unit ?? null,
                  sortOrder: field.sortOrder,
                  isActive: field.isActive,
                })),
              },
            }
          : {}),
      },
      select: templateDetailSelect,
    });
  }

  findById(id: string) {
    return this.prisma.productTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: templateDetailSelect,
    });
  }

  findActiveById(id: string) {
    return this.prisma.productTemplate.findFirst({
      where: {
        id,
        deletedAt: null,
        isActive: true,
      },
      select: templateDetailSelect,
    });
  }

  findByName(name: string, excludeId?: string) {
    return this.prisma.productTemplate.findFirst({
      where: {
        name,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  }

  findManyPaginated(options: FindProductTemplatesOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;

    return this.prisma.productTemplate.findMany({
      where: buildTemplateWhere(options),
      select: templateListSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });
  }

  count(
    options: Omit<
      FindProductTemplatesOptions,
      "page" | "limit" | "sortBy" | "sortOrder"
    >,
  ) {
    return this.prisma.productTemplate.count({
      where: buildTemplateWhere(options),
    });
  }

  searchActive(options: { categoryIds?: string[]; q?: string }) {
    const { categoryIds, q } = options;
    return this.prisma.productTemplate.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        ...(categoryIds && categoryIds.length > 0
          ? {
              categories: {
                some: {
                  categoryId: { in: categoryIds },
                },
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: templateDetailSelect,
      orderBy: { name: "asc" },
    });
  }

  update(id: string, data: UpdateProductTemplateData) {
    return this.prisma.productTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.baseDefaults !== undefined
          ? {
              baseDefaults:
                data.baseDefaults === null
                  ? Prisma.DbNull
                  : data.baseDefaults,
            }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: templateDetailSelect,
    });
  }

  softDisable(id: string, deletedAt = new Date()) {
    return this.prisma.productTemplate.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt,
      },
      select: templateDetailSelect,
    });
  }

  replaceCategories(templateId: string, categoryIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.productTemplateCategory.deleteMany({
        where: { templateId },
      });

      if (categoryIds.length > 0) {
        await tx.productTemplateCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            templateId,
            categoryId,
          })),
        });
      }

      return tx.productTemplate.findFirstOrThrow({
        where: { id: templateId, deletedAt: null },
        select: templateDetailSelect,
      });
    });
  }

  replaceFields(templateId: string, fields: ProductTemplateFieldCreateData[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.productTemplateField.deleteMany({
        where: { templateId },
      });

      if (fields.length > 0) {
        await tx.productTemplateField.createMany({
          data: fields.map((field) => ({
            templateId,
            key: field.key,
            label: field.label,
            fieldType: field.fieldType,
            options: field.options,
            defaultValue: field.defaultValue,
            unit: field.unit ?? null,
            sortOrder: field.sortOrder,
            isActive: field.isActive,
          })),
        });
      }

      return tx.productTemplate.findFirstOrThrow({
        where: { id: templateId, deletedAt: null },
        select: templateDetailSelect,
      });
    });
  }
}

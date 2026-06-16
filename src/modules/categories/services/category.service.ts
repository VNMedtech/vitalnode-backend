import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  CATEGORY_ACTIONS,
  CATEGORY_AUDIT_ENTITY_TYPE,
} from "../constants/category.constants.js";
import { toCategoryDto } from "../dto/category.dto.js";
import { CategoryRepository } from "../repositories/category.repository.js";
import type {
  CategoryDto,
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "../types/category.types.js";

function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function buildUpdateMetadata(
  before: { name: string; description: string | null },
  input: UpdateCategoryInput,
): Record<string, unknown> {
  const changedFields: string[] = [];

  if (input.name !== undefined && input.name !== before.name) {
    changedFields.push("name");
  }
  if (
    input.description !== undefined &&
    input.description !== before.description
  ) {
    changedFields.push("description");
  }

  return { changedFields };
}

export class CategoryService {
  private readonly repo = new CategoryRepository(prisma);

  async createCategory(
    actorUserId: string,
    input: CreateCategoryInput,
  ): Promise<CategoryDto> {
    const existing = await this.repo.findByName(input.name);
    if (existing) {
      throw new ConflictError("Category name already exists");
    }

    try {
      const created = await this.repo.create({
        name: input.name,
        description: input.description,
      });

      auditLogger.log({
        actorUserId,
        action: CATEGORY_ACTIONS.CREATE,
        entityType: CATEGORY_AUDIT_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          name: created.name,
        },
      });

      return toCategoryDto(created);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Category name already exists");
      }
      throw error;
    }
  }

  async updateCategory(
    actorUserId: string,
    id: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryDto> {
    const existing = await this.repo.findByIdNotDeleted(id);
    if (!existing) {
      throw new NotFoundError("Category not found");
    }

    if (input.name) {
      const nameTaken = await this.repo.findByName(input.name, id);
      if (nameTaken) {
        throw new ConflictError("Category name already exists");
      }
    }

    try {
      const updated = await this.repo.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      });

      auditLogger.log({
        actorUserId,
        action: CATEGORY_ACTIONS.UPDATE,
        entityType: CATEGORY_AUDIT_ENTITY_TYPE,
        entityId: id,
        metadata: buildUpdateMetadata(existing, input),
      });

      return toCategoryDto(updated);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Category name already exists");
      }
      throw error;
    }
  }

  async disableCategory(actorUserId: string, id: string): Promise<CategoryDto> {
    const existing = await this.repo.findByIdNotDeleted(id);
    if (!existing) {
      throw new NotFoundError("Category not found");
    }

    if (!existing.isActive) {
      throw new NotFoundError("Category not found");
    }

    const disabled = await this.repo.softDelete(id);

    auditLogger.log({
      actorUserId,
      action: CATEGORY_ACTIONS.DISABLE,
      entityType: CATEGORY_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        name: existing.name,
        previousIsActive: existing.isActive,
      },
    });

    return toCategoryDto(disabled);
  }

  async listCategories(query: ListCategoriesQuery): Promise<{
    items: CategoryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const publicOnly = true;

    const [records, total] = await Promise.all([
      this.repo.findManyPaginated({
        ...query,
        publicOnly,
      }),
      this.repo.count({
        search: query.search,
        publicOnly,
      }),
    ]);

    return {
      items: records.map(toCategoryDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getCategoryById(id: string): Promise<CategoryDto> {
    const category = await this.repo.findActiveById(id);
    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return toCategoryDto(category);
  }
}

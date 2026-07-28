import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { CategoryRepository } from "../../categories/repositories/category.repository.js";
import {
  PRODUCT_TEMPLATE_ACTIONS,
  PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
} from "../constants/productTemplate.constants.js";
import {
  toProductTemplateDetailDto,
  toProductTemplateListItemDto,
} from "../dto/productTemplate.dto.js";
import {
  ProductTemplateRepository,
  type ProductTemplateFieldCreateData,
} from "../repositories/productTemplate.repository.js";
import type {
  CreateProductTemplateInput,
  ListProductTemplatesQuery,
  ProductTemplateBaseDefaults,
  ProductTemplateDetailDto,
  ProductTemplateFieldInput,
  ProductTemplateListItemDto,
  SearchProductTemplatesQuery,
  UpdateProductTemplateInput,
} from "../types/productTemplate.types.js";

function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function toJsonInput(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

/** Normalize optional baseDefaults snapshot for storage. */
function normalizeBaseDefaults(
  input: ProductTemplateBaseDefaults | null | undefined,
): Prisma.InputJsonValue | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;

  const out: Record<string, unknown> = {};
  if (input.productName !== undefined) out.productName = input.productName;
  if (input.brand !== undefined) out.brand = input.brand;
  if (input.model !== undefined) out.model = input.model;
  if (input.pricing !== undefined) out.pricing = String(input.pricing);
  if (input.moq !== undefined) out.moq = input.moq;
  if (input.description !== undefined) out.description = input.description;
  if (input.details !== undefined) out.details = input.details;

  return Object.keys(out).length > 0
    ? (out as Prisma.InputJsonValue)
    : null;
}

function mapFieldInputs(
  fields: ProductTemplateFieldInput[],
): ProductTemplateFieldCreateData[] {
  return fields.map((field, index) => ({
    key: field.key,
    label: field.label,
    fieldType: field.fieldType,
    options: toJsonInput(field.options),
    defaultValue: toJsonInput(field.defaultValue),
    unit: field.unit ?? null,
    sortOrder: field.sortOrder ?? index,
    isActive: field.isActive ?? true,
  }));
}

export class ProductTemplateService {
  private readonly repo = new ProductTemplateRepository(prisma);
  private readonly categoryRepo = new CategoryRepository(prisma);

  private async assertCategoriesExist(categoryIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(categoryIds)];
    for (const categoryId of uniqueIds) {
      const category = await this.categoryRepo.findActiveById(categoryId);
      if (!category) {
        throw new NotFoundError(`Category not found: ${categoryId}`);
      }
    }
  }

  async createTemplate(
    actorUserId: string,
    input: CreateProductTemplateInput,
  ): Promise<ProductTemplateDetailDto> {
    const existing = await this.repo.findByName(input.name);
    if (existing) {
      throw new ConflictError("Template name already exists");
    }

    const categoryIds = input.categoryIds ?? [];
    if (categoryIds.length > 0) {
      await this.assertCategoriesExist(categoryIds);
    }

    try {
      const created = await this.repo.create({
        name: input.name,
        description: input.description,
        baseDefaults: normalizeBaseDefaults(input.baseDefaults),
        isActive: input.isActive ?? true,
        categoryIds: [...new Set(categoryIds)],
        fields: mapFieldInputs(input.fields ?? []),
      });

      auditLogger.log({
        actorUserId,
        action: PRODUCT_TEMPLATE_ACTIONS.CREATE,
        entityType: PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          name: created.name,
          categoryIds,
          fieldCount: created.fields.length,
        },
      });

      return toProductTemplateDetailDto(created);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Template name already exists");
      }
      throw error;
    }
  }

  async updateTemplate(
    actorUserId: string,
    id: string,
    input: UpdateProductTemplateInput,
  ): Promise<ProductTemplateDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Product template not found");
    }

    if (input.name) {
      const nameTaken = await this.repo.findByName(input.name, id);
      if (nameTaken) {
        throw new ConflictError("Template name already exists");
      }
    }

    if (input.categoryIds) {
      await this.assertCategoriesExist(input.categoryIds);
    }

    try {
      await this.repo.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.baseDefaults !== undefined
          ? { baseDefaults: normalizeBaseDefaults(input.baseDefaults) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      });

      if (input.categoryIds !== undefined) {
        await this.repo.replaceCategories(id, [...new Set(input.categoryIds)]);
        auditLogger.log({
          actorUserId,
          action: PRODUCT_TEMPLATE_ACTIONS.REPLACE_CATEGORIES,
          entityType: PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
          entityId: id,
          metadata: { categoryIds: input.categoryIds },
        });
      }

      if (input.fields !== undefined) {
        await this.repo.replaceFields(id, mapFieldInputs(input.fields));
        auditLogger.log({
          actorUserId,
          action: PRODUCT_TEMPLATE_ACTIONS.REPLACE_FIELDS,
          entityType: PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
          entityId: id,
          metadata: { fieldCount: input.fields.length },
        });
      }

      const updated = await this.repo.findById(id);
      if (!updated) {
        throw new NotFoundError("Product template not found");
      }

      auditLogger.log({
        actorUserId,
        action: PRODUCT_TEMPLATE_ACTIONS.UPDATE,
        entityType: PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
        entityId: id,
        metadata: {
          changedFields: Object.keys(input).filter(
            (key) => input[key as keyof UpdateProductTemplateInput] !== undefined,
          ),
        },
      });

      return toProductTemplateDetailDto(updated);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Template name already exists");
      }
      throw error;
    }
  }

  async disableTemplate(
    actorUserId: string,
    id: string,
  ): Promise<ProductTemplateDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Product template not found");
    }

    if (!existing.isActive) {
      throw new NotFoundError("Product template not found");
    }

    const disabled = await this.repo.softDisable(id);

    auditLogger.log({
      actorUserId,
      action: PRODUCT_TEMPLATE_ACTIONS.DISABLE,
      entityType: PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        name: existing.name,
        previousIsActive: existing.isActive,
      },
    });

    return toProductTemplateDetailDto(disabled);
  }

  async replaceFields(
    actorUserId: string,
    id: string,
    fields: ProductTemplateFieldInput[],
  ): Promise<ProductTemplateDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Product template not found");
    }

    const updated = await this.repo.replaceFields(id, mapFieldInputs(fields));

    auditLogger.log({
      actorUserId,
      action: PRODUCT_TEMPLATE_ACTIONS.REPLACE_FIELDS,
      entityType: PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: { fieldCount: fields.length },
    });

    return toProductTemplateDetailDto(updated);
  }

  async replaceCategories(
    actorUserId: string,
    id: string,
    categoryIds: string[],
  ): Promise<ProductTemplateDetailDto> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Product template not found");
    }

    await this.assertCategoriesExist(categoryIds);
    const updated = await this.repo.replaceCategories(id, [
      ...new Set(categoryIds),
    ]);

    auditLogger.log({
      actorUserId,
      action: PRODUCT_TEMPLATE_ACTIONS.REPLACE_CATEGORIES,
      entityType: PRODUCT_TEMPLATE_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: { categoryIds },
    });

    return toProductTemplateDetailDto(updated);
  }

  async getTemplateById(id: string): Promise<ProductTemplateDetailDto> {
    const template = await this.repo.findById(id);
    if (!template) {
      throw new NotFoundError("Product template not found");
    }
    return toProductTemplateDetailDto(template);
  }

  async listTemplates(query: ListProductTemplatesQuery): Promise<{
    items: ProductTemplateListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const filterOptions = {
      q: query.q,
      categoryId: query.categoryId,
      isActive: query.isActive,
      includeInactive: true,
    };

    const [records, total] = await Promise.all([
      this.repo.findManyPaginated({
        ...query,
        ...filterOptions,
      }),
      this.repo.count(filterOptions),
    ]);

    return {
      items: records.map(toProductTemplateListItemDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async searchTemplates(
    query: SearchProductTemplatesQuery,
  ): Promise<ProductTemplateDetailDto[]> {
    await this.assertCategoriesExist(query.categoryIds);
    const records = await this.repo.searchActiveByCategoryIds(
      [...new Set(query.categoryIds)],
      query.q,
    );
    return records.map(toProductTemplateDetailDto);
  }
}

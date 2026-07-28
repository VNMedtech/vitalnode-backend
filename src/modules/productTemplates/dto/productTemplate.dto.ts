import type {
  ProductTemplateDetailRecord,
  ProductTemplateListRecord,
} from "../repositories/productTemplate.repository.js";
import type {
  ProductTemplateBaseDefaults,
  ProductTemplateDetailDto,
  ProductTemplateFieldDto,
  ProductTemplateListItemDto,
} from "../types/productTemplate.types.js";

function toFieldDto(
  field: ProductTemplateDetailRecord["fields"][number],
): ProductTemplateFieldDto {
  return {
    id: field.id,
    key: field.key,
    label: field.label,
    fieldType: field.fieldType,
    options: field.options ?? null,
    defaultValue: field.defaultValue ?? null,
    unit: field.unit,
    sortOrder: field.sortOrder,
    isActive: field.isActive,
    createdAt: field.createdAt,
    updatedAt: field.updatedAt,
  };
}

function toCategorySummaries(
  categories: ProductTemplateListRecord["categories"],
) {
  return categories.map((link) => ({
    id: link.category.id,
    name: link.category.name,
  }));
}

function toBaseDefaultsDto(
  value: unknown,
): ProductTemplateBaseDefaults | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const out: ProductTemplateBaseDefaults = {};

  if (typeof raw.productName === "string") out.productName = raw.productName;
  if (typeof raw.brand === "string") out.brand = raw.brand;
  if (typeof raw.model === "string") out.model = raw.model;
  if (typeof raw.pricing === "string") {
    out.pricing = raw.pricing;
  } else if (typeof raw.pricing === "number" && Number.isFinite(raw.pricing)) {
    out.pricing = String(raw.pricing);
  }
  if (typeof raw.moq === "number" && Number.isInteger(raw.moq)) {
    out.moq = raw.moq;
  }
  if (typeof raw.description === "string") out.description = raw.description;
  if (raw.details === null) {
    out.details = null;
  } else if (typeof raw.details === "string") {
    out.details = raw.details;
  }

  return Object.keys(out).length > 0 ? out : null;
}

export function toProductTemplateListItemDto(
  record: ProductTemplateListRecord,
): ProductTemplateListItemDto {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    baseDefaults: toBaseDefaultsDto(record.baseDefaults),
    isActive: record.isActive,
    fieldCount: record._count.fields,
    categories: toCategorySummaries(record.categories),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toProductTemplateDetailDto(
  record: ProductTemplateDetailRecord,
): ProductTemplateDetailDto {
  const fields = [...record.fields]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    .map(toFieldDto);

  return {
    ...toProductTemplateListItemDto({
      ...record,
      _count: {
        fields: record.fields.filter((f) => f.isActive).length,
      },
    }),
    fields,
  };
}

import type {
  ProductTemplateDetailRecord,
  ProductTemplateListRecord,
} from "../repositories/productTemplate.repository.js";
import type {
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

export function toProductTemplateListItemDto(
  record: ProductTemplateListRecord,
): ProductTemplateListItemDto {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
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
      _count: { fields: record.fields.length },
    }),
    fields,
  };
}

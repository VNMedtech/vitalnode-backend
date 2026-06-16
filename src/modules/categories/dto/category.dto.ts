import type { CategoryRecord } from "../repositories/category.repository.js";
import type { CategoryDto } from "../types/category.types.js";

export function toCategoryDto(record: CategoryRecord): CategoryDto {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

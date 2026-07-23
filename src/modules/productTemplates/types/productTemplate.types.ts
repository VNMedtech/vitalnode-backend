import type { ProductTemplateFieldType } from "../../../../generated/prisma/client.js";
import type { ProductTemplateSortField } from "../constants/productTemplate.constants.js";

export interface ProductTemplateCategorySummaryDto {
  id: string;
  name: string;
}

export interface ProductTemplateFieldDto {
  id: string;
  key: string;
  label: string;
  fieldType: ProductTemplateFieldType;
  options: unknown;
  defaultValue: unknown;
  unit: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductTemplateListItemDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  fieldCount: number;
  categories: ProductTemplateCategorySummaryDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductTemplateDetailDto extends ProductTemplateListItemDto {
  fields: ProductTemplateFieldDto[];
}

export interface ProductTemplateFieldInput {
  key: string;
  label: string;
  fieldType: ProductTemplateFieldType;
  options?: unknown;
  defaultValue?: unknown;
  unit?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateProductTemplateInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  categoryIds?: string[];
  fields?: ProductTemplateFieldInput[];
}

export interface UpdateProductTemplateInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  categoryIds?: string[];
  fields?: ProductTemplateFieldInput[];
}

export interface ListProductTemplatesQuery {
  page: number;
  limit: number;
  sortBy: ProductTemplateSortField;
  sortOrder: "asc" | "desc";
  q?: string;
  categoryId?: string;
  isActive?: boolean;
}

export interface SearchProductTemplatesQuery {
  categoryIds: string[];
  q?: string;
}

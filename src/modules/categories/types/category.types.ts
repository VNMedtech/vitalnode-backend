import type { CategorySortField } from "../constants/category.constants.js";

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
}

export interface ListCategoriesQuery {
  page: number;
  limit: number;
  sortBy: CategorySortField;
  sortOrder: "asc" | "desc";
  search?: string;
}

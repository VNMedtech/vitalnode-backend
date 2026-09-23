import type { AdminModule } from "../../../shared/enums/adminModule.enum.js";
import type { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import type { SubAdminSortField } from "../constants/subAdmin.constants.js";

export interface ListSubAdminsQuery {
  page: number;
  limit: number;
  sortBy: SubAdminSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  status?: UserStatus;
}

export interface CreateSubAdminInput {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  password: string;
  modules: AdminModule[];
}

export interface UpdateSubAdminInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  modules?: AdminModule[];
}

export interface DisableEnableSubAdminInput {
  reason?: string;
}

export interface SubAdminListItemDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  status: string;
  modules: AdminModule[];
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubAdminDetailDto extends SubAdminListItemDto {
  lastLoginAt: Date | null;
}

export interface AdminModuleCatalogItemDto {
  id: AdminModule;
  label: string;
  description: string;
}

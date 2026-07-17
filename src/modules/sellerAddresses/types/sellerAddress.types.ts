import type { SellerAddressSortField } from "../constants/sellerAddress.constants.js";

export interface SellerAddressDto {
  id: string;
  label: string;
  contactPerson: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: string | null;
  longitude: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSellerAddressInput {
  label: string;
  contactPerson?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude?: string;
  longitude?: string;
  isDefault?: boolean;
}

export interface UpdateSellerAddressInput {
  label?: string;
  contactPerson?: string | null;
  phone?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: string | null;
  longitude?: string | null;
  isDefault?: boolean;
}

export interface ListSellerAddressesQuery {
  page: number;
  limit: number;
  sortBy: SellerAddressSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  isActive?: boolean;
}

import type { AddressSortField } from "../constants/address.constants.js";

export interface AddressDto {
  id: string;
  recipientName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddressInput {
  recipientName: string;
  phoneNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  recipientName?: string;
  phoneNumber?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  isDefault?: boolean;
}

export interface ListAddressesQuery {
  page: number;
  limit: number;
  sortBy: AddressSortField;
  sortOrder: "asc" | "desc";
  search?: string;
}

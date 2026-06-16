import type { DeliveryPartnerSortField } from "../constants/deliveryPartner.constants.js";
import type { UserStatus } from "../../../shared/enums/userStatus.enum.js";

export interface DeliveryPartnerUserSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  status: UserStatus;
  mustChangePassword: boolean;
}

export interface DeliveryPartnerListItemDto {
  id: string;
  userId: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  user: DeliveryPartnerUserSummaryDto;
  createdAt: Date;
  updatedAt: Date;
}

export type DeliveryPartnerDetailDto = DeliveryPartnerListItemDto;

export interface CreateDeliveryPartnerInput {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface UpdateDeliveryPartnerInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface ListDeliveryPartnersQuery {
  page: number;
  limit: number;
  sortBy: DeliveryPartnerSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  status?: UserStatus;
  city?: string;
  state?: string;
  country?: string;
}

export interface DisableDeliveryPartnerInput {
  reason?: string;
}

export interface EnableDeliveryPartnerInput {
  reason?: string;
}

export interface CreateDeliveryPartnerResultDto {
  deliveryPartner: DeliveryPartnerDetailDto;
  temporaryPassword: string;
}

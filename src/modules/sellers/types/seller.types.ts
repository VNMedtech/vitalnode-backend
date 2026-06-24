import type { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import type { SellerSortField } from "../constants/seller.constants.js";

export interface SellerDocumentDto {
  id: string;
  fileUrl: string;
  fileType: string;
  createdAt: Date;
}

export interface SellerUserSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  status: string;
}

export interface SellerListItemDto {
  id: string;
  userId: string;
  businessName: string;
  contactPerson: string;
  city: string;
  state: string;
  country: string;
  approvalStatus: SellerApprovalStatus;
  commissionPercentage: string | null;
  user: SellerUserSummaryDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerDetailDto extends SellerListItemDto {
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  latitude: string | null;
  longitude: string | null;
  documents: SellerDocumentDto[];
}

export interface ListSellersQuery {
  page: number;
  limit: number;
  sortBy: SellerSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  companyName?: string;
  email?: string;
  approvalStatus?: SellerApprovalStatus;
  city?: string;
  state?: string;
  country?: string;
}

export interface RejectSellerInput {
  reason?: string;
}

export interface DisableSellerInput {
  reason?: string;
}

export interface EnableSellerInput {
  reason?: string;
}

export interface ApproveSellerInput {
  commissionPercentage: number;
}

export interface UpdateSellerCommissionInput {
  commissionPercentage: number;
}

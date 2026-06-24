import type {
  SellerDetailRecord,
  SellerListRecord,
} from "../repositories/seller.repository.js";
import type {
  SellerDetailDto,
  SellerDocumentDto,
  SellerListItemDto,
} from "../types/seller.types.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";

function toSellerDocumentDto(
  document: SellerDetailRecord["documents"][number],
): SellerDocumentDto {
  return {
    id: document.id,
    fileUrl: document.fileUrl,
    fileType: document.fileType,
    createdAt: document.createdAt,
  };
}

function toSellerListItemDto(record: SellerListRecord): SellerListItemDto {
  return {
    id: record.id,
    userId: record.userId,
    businessName: record.businessName,
    contactPerson: record.contactPerson,
    city: record.city,
    state: record.state,
    country: record.country,
    approvalStatus: record.approvalStatus as SellerApprovalStatus,
    commissionPercentage: record.commissionPercentage?.toString() ?? null,
    user: {
      id: record.user.id,
      email: record.user.email,
      firstName: record.user.firstName,
      lastName: record.user.lastName,
      phoneNumber: record.user.phoneNumber,
      status: record.user.status,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toSellerListItemDtoFromRecord(
  record: SellerListRecord,
): SellerListItemDto {
  return toSellerListItemDto(record);
}

export function toSellerDetailDto(record: SellerDetailRecord): SellerDetailDto {
  return {
    ...toSellerListItemDto(record),
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    postalCode: record.postalCode,
    latitude: record.latitude?.toString() ?? null,
    longitude: record.longitude?.toString() ?? null,
    documents: record.documents.map(toSellerDocumentDto),
  };
}

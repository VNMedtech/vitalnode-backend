import type {
  DeliveryPartnerDetailRecord,
  DeliveryPartnerListRecord,
} from "../repositories/deliveryPartner.repository.js";
import type {
  DeliveryPartnerDetailDto,
  DeliveryPartnerListItemDto,
} from "../types/deliveryPartner.types.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";

function toDeliveryPartnerListItemDto(
  record: DeliveryPartnerListRecord,
): DeliveryPartnerListItemDto {
  return {
    id: record.id,
    userId: record.userId,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    country: record.country,
    postalCode: record.postalCode,
    user: {
      id: record.user.id,
      email: record.user.email,
      firstName: record.user.firstName,
      lastName: record.user.lastName,
      phoneNumber: record.user.phoneNumber,
      status: record.user.status as UserStatus,
      mustChangePassword: record.user.mustChangePassword,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toDeliveryPartnerListItemDtoFromRecord(
  record: DeliveryPartnerListRecord,
): DeliveryPartnerListItemDto {
  return toDeliveryPartnerListItemDto(record);
}

export function toDeliveryPartnerDetailDto(
  record: DeliveryPartnerDetailRecord,
): DeliveryPartnerDetailDto {
  return toDeliveryPartnerListItemDto(record);
}

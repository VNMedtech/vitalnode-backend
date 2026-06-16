import type { AddressRecord } from "../repositories/address.repository.js";
import type { AddressDto } from "../types/address.types.js";

export function toAddressDto(record: AddressRecord): AddressDto {
  return {
    id: record.id,
    recipientName: record.name,
    phoneNumber: record.phone,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    country: record.country,
    postalCode: record.postalCode,
    isDefault: record.isDefault,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

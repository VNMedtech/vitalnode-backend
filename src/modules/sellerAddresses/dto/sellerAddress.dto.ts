import type { SellerAddressRecord } from "../repositories/sellerAddress.repository.js";
import type { SellerAddressDto } from "../types/sellerAddress.types.js";

function decimalToString(
  value: SellerAddressRecord["latitude"],
): string | null {
  if (value == null) return null;
  return value.toString();
}

export function toSellerAddressDto(
  record: SellerAddressRecord,
): SellerAddressDto {
  return {
    id: record.id,
    label: record.label,
    contactPerson: record.contactPerson,
    phone: record.phone,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    country: record.country,
    postalCode: record.postalCode,
    latitude: decimalToString(record.latitude),
    longitude: decimalToString(record.longitude),
    isDefault: record.isDefault,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

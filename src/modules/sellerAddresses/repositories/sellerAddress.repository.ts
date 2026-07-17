import type {
  Prisma,
  PrismaClient,
} from "../../../../generated/prisma/client.js";
import type { SellerAddressSortField } from "../constants/sellerAddress.constants.js";

const sellerAddressSelect = {
  id: true,
  sellerId: true,
  label: true,
  contactPerson: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SellerAddressSelect;

export type SellerAddressRecord = Prisma.SellerAddressGetPayload<{
  select: typeof sellerAddressSelect;
}>;

export interface FindSellerAddressesOptions {
  sellerId: string;
  page: number;
  limit: number;
  sortBy: SellerAddressSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  isActive?: boolean;
}

export interface CreateSellerAddressData {
  sellerId: string;
  label: string;
  contactPerson?: string | null;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude?: string | null;
  longitude?: string | null;
  isDefault: boolean;
  isActive?: boolean;
}

export interface UpdateSellerAddressData {
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
  isActive?: boolean;
}

export class SellerAddressRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  create(data: CreateSellerAddressData) {
    return this.prisma.sellerAddress.create({
      data: {
        sellerId: data.sellerId,
        label: data.label,
        contactPerson: data.contactPerson ?? null,
        phone: data.phone ?? null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isDefault: data.isDefault,
        isActive: data.isActive ?? true,
      },
      select: sellerAddressSelect,
    });
  }

  findByIdAndSellerId(id: string, sellerId: string) {
    return this.prisma.sellerAddress.findFirst({
      where: { id, sellerId },
      select: sellerAddressSelect,
    });
  }

  findById(id: string) {
    return this.prisma.sellerAddress.findFirst({
      where: { id },
      select: sellerAddressSelect,
    });
  }

  findDefaultActiveBySellerId(sellerId: string) {
    return this.prisma.sellerAddress.findFirst({
      where: { sellerId, isDefault: true, isActive: true },
      select: sellerAddressSelect,
    });
  }

  countBySellerId(sellerId: string) {
    return this.prisma.sellerAddress.count({ where: { sellerId } });
  }

  countActiveBySellerId(sellerId: string, excludeId?: string) {
    return this.prisma.sellerAddress.count({
      where: {
        sellerId,
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  countOrdersUsingAddress(addressId: string) {
    return this.prisma.order.count({
      where: { pickupAddressId: addressId },
    });
  }

  findManyPaginated(options: FindSellerAddressesOptions) {
    const { sellerId, page, limit, sortBy, sortOrder, search, isActive } =
      options;
    const skip = (page - 1) * limit;

    const where: Prisma.SellerAddressWhereInput = {
      sellerId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { label: { contains: search, mode: "insensitive" } },
              { contactPerson: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { state: { contains: search, mode: "insensitive" } },
              { postalCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.sellerAddress.findMany({
      where,
      select: sellerAddressSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });
  }

  count(
    options: Pick<
      FindSellerAddressesOptions,
      "sellerId" | "search" | "isActive"
    >,
  ) {
    const { sellerId, search, isActive } = options;

    return this.prisma.sellerAddress.count({
      where: {
        sellerId,
        ...(isActive !== undefined ? { isActive } : {}),
        ...(search
          ? {
              OR: [
                { label: { contains: search, mode: "insensitive" } },
                { contactPerson: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { state: { contains: search, mode: "insensitive" } },
                { postalCode: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    });
  }

  update(id: string, data: UpdateSellerAddressData) {
    return this.prisma.sellerAddress.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.contactPerson !== undefined
          ? { contactPerson: data.contactPerson }
          : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.addressLine1 !== undefined
          ? { addressLine1: data.addressLine1 }
          : {}),
        ...(data.addressLine2 !== undefined
          ? { addressLine2: data.addressLine2 }
          : {}),
        ...(data.city !== undefined ? { city: data.city } : {}),
        ...(data.state !== undefined ? { state: data.state } : {}),
        ...(data.country !== undefined ? { country: data.country } : {}),
        ...(data.postalCode !== undefined
          ? { postalCode: data.postalCode }
          : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: sellerAddressSelect,
    });
  }

  delete(id: string) {
    return this.prisma.sellerAddress.delete({
      where: { id },
      select: sellerAddressSelect,
    });
  }

  clearDefaultsForSeller(sellerId: string, excludeId?: string) {
    return this.prisma.sellerAddress.updateMany({
      where: {
        sellerId,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isDefault: false },
    });
  }
}

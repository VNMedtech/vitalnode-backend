import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { AddressSortField } from "../constants/address.constants.js";

const addressSelect = {
  id: true,
  buyerId: true,
  name: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  country: true,
  postalCode: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

export type AddressRecord = Prisma.AddressGetPayload<{
  select: typeof addressSelect;
}>;

export interface FindAddressesOptions {
  buyerId: string;
  page: number;
  limit: number;
  sortBy: AddressSortField;
  sortOrder: "asc" | "desc";
  search?: string;
}

export interface CreateAddressData {
  buyerId: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefault: boolean;
}

export interface UpdateAddressData {
  name?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  isDefault?: boolean;
}

function toPrismaSortField(
  sortBy: AddressSortField,
): keyof Prisma.AddressOrderByWithRelationInput {
  if (sortBy === "recipientName") {
    return "name";
  }
  return sortBy;
}

export class AddressRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  create(data: CreateAddressData) {
    return this.prisma.address.create({
      data: {
        buyerId: data.buyerId,
        name: data.name,
        phone: data.phone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        isDefault: data.isDefault,
      },
      select: addressSelect,
    });
  }

  findByIdAndBuyerId(id: string, buyerId: string) {
    return this.prisma.address.findFirst({
      where: { id, buyerId },
      select: addressSelect,
    });
  }

  countByBuyerId(buyerId: string) {
    return this.prisma.address.count({
      where: { buyerId },
    });
  }

  findManyPaginated(options: FindAddressesOptions) {
    const { buyerId, page, limit, sortBy, sortOrder, search } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.AddressWhereInput = {
      buyerId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { state: { contains: search, mode: "insensitive" } },
              { postalCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.AddressOrderByWithRelationInput = {
      [toPrismaSortField(sortBy)]: sortOrder,
    };

    return this.prisma.address.findMany({
      where,
      select: addressSelect,
      orderBy,
      skip,
      take: limit,
    });
  }

  count(options: Pick<FindAddressesOptions, "buyerId" | "search">) {
    const { buyerId, search } = options;

    return this.prisma.address.count({
      where: {
        buyerId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
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

  update(id: string, data: UpdateAddressData) {
    return this.prisma.address.update({
      where: { id },
      data,
      select: addressSelect,
    });
  }

  delete(id: string) {
    return this.prisma.address.delete({
      where: { id },
      select: addressSelect,
    });
  }

  clearDefaultsForBuyer(buyerId: string, excludeId?: string) {
    return this.prisma.address.updateMany({
      where: {
        buyerId,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isDefault: false },
    });
  }
}

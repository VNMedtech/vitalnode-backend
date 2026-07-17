import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import {
  SELLER_ADDRESS_ACTIONS,
  SELLER_ADDRESS_AUDIT_ENTITY_TYPE,
} from "../constants/sellerAddress.constants.js";
import { toSellerAddressDto } from "../dto/sellerAddress.dto.js";
import {
  SellerAddressRepository,
  type CreateSellerAddressData,
  type SellerAddressRecord,
  type UpdateSellerAddressData,
} from "../repositories/sellerAddress.repository.js";
import type {
  CreateSellerAddressInput,
  ListSellerAddressesQuery,
  SellerAddressDto,
  UpdateSellerAddressInput,
} from "../types/sellerAddress.types.js";

function buildUpdateMetadata(
  before: SellerAddressRecord,
  input: UpdateSellerAddressInput,
): Record<string, unknown> {
  const changedFields: string[] = [];
  const keys: (keyof UpdateSellerAddressInput)[] = [
    "label",
    "contactPerson",
    "phone",
    "addressLine1",
    "addressLine2",
    "city",
    "state",
    "country",
    "postalCode",
    "latitude",
    "longitude",
    "isDefault",
  ];

  for (const key of keys) {
    if (input[key] !== undefined) {
      changedFields.push(key);
    }
  }

  return {
    changedFields,
    previousLabel: before.label,
  };
}

export class SellerAddressService {
  private readonly addressRepo = new SellerAddressRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);

  private async resolveSellerId(actorUserId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(actorUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile required");
    }
    return seller.id;
  }

  private async getOwnedAddressOrThrow(
    addressId: string,
    sellerId: string,
  ): Promise<SellerAddressRecord> {
    const address = await this.addressRepo.findByIdAndSellerId(
      addressId,
      sellerId,
    );
    if (!address) {
      throw new NotFoundError("Warehouse address not found");
    }
    return address;
  }

  async createAddress(
    actorUserId: string,
    input: CreateSellerAddressInput,
  ): Promise<SellerAddressDto> {
    const sellerId = await this.resolveSellerId(actorUserId);

    const created = await prisma.$transaction(async (tx) => {
      const addressRepo = new SellerAddressRepository(tx);
      const existingCount = await addressRepo.countBySellerId(sellerId);
      const shouldBeDefault = input.isDefault === true || existingCount === 0;

      if (shouldBeDefault) {
        await addressRepo.clearDefaultsForSeller(sellerId);
      }

      const data: CreateSellerAddressData = {
        sellerId,
        label: input.label,
        contactPerson: input.contactPerson,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        country: input.country,
        postalCode: input.postalCode,
        latitude: input.latitude,
        longitude: input.longitude,
        isDefault: shouldBeDefault,
        isActive: true,
      };

      return addressRepo.create(data);
    });

    auditLogger.log({
      actorUserId,
      action: SELLER_ADDRESS_ACTIONS.CREATE,
      entityType: SELLER_ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: created.id,
      metadata: {
        sellerId,
        isDefault: created.isDefault,
        label: created.label,
        city: created.city,
      },
    });

    return toSellerAddressDto(created);
  }

  async getAddress(
    actorUserId: string,
    addressId: string,
  ): Promise<SellerAddressDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const address = await this.getOwnedAddressOrThrow(addressId, sellerId);
    return toSellerAddressDto(address);
  }

  async updateAddress(
    actorUserId: string,
    addressId: string,
    input: UpdateSellerAddressInput,
  ): Promise<SellerAddressDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const existing = await this.getOwnedAddressOrThrow(addressId, sellerId);

    const updated = await prisma.$transaction(async (tx) => {
      const addressRepo = new SellerAddressRepository(tx);
      const updateData: UpdateSellerAddressData = {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.contactPerson !== undefined
          ? { contactPerson: input.contactPerson }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.addressLine1 !== undefined
          ? { addressLine1: input.addressLine1 }
          : {}),
        ...(input.addressLine2 !== undefined
          ? { addressLine2: input.addressLine2 }
          : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.postalCode !== undefined
          ? { postalCode: input.postalCode }
          : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined
          ? { longitude: input.longitude }
          : {}),
      };

      if (input.isDefault === true) {
        if (!existing.isActive) {
          throw new ValidationError(
            "Cannot set an inactive warehouse as default",
          );
        }
        await addressRepo.clearDefaultsForSeller(sellerId, addressId);
        updateData.isDefault = true;
      } else if (input.isDefault === false) {
        updateData.isDefault = false;
      }

      return addressRepo.update(addressId, updateData);
    });

    auditLogger.log({
      actorUserId,
      action: SELLER_ADDRESS_ACTIONS.UPDATE,
      entityType: SELLER_ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: addressId,
      metadata: buildUpdateMetadata(existing, input),
    });

    return toSellerAddressDto(updated);
  }

  async setDefaultAddress(
    actorUserId: string,
    addressId: string,
  ): Promise<SellerAddressDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const existing = await this.getOwnedAddressOrThrow(addressId, sellerId);

    if (!existing.isActive) {
      throw new ValidationError("Cannot set an inactive warehouse as default");
    }

    if (existing.isDefault) {
      return toSellerAddressDto(existing);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const addressRepo = new SellerAddressRepository(tx);
      await addressRepo.clearDefaultsForSeller(sellerId, addressId);
      return addressRepo.update(addressId, { isDefault: true });
    });

    auditLogger.log({
      actorUserId,
      action: SELLER_ADDRESS_ACTIONS.SET_DEFAULT,
      entityType: SELLER_ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: addressId,
      metadata: { sellerId, previousDefaultCleared: true },
    });

    return toSellerAddressDto(updated);
  }

  async disableAddress(
    actorUserId: string,
    addressId: string,
  ): Promise<SellerAddressDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const existing = await this.getOwnedAddressOrThrow(addressId, sellerId);

    if (!existing.isActive) {
      return toSellerAddressDto(existing);
    }

    const otherActive = await this.addressRepo.countActiveBySellerId(
      sellerId,
      addressId,
    );
    if (otherActive === 0) {
      throw new ConflictError(
        "A seller must keep at least one active warehouse address",
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const addressRepo = new SellerAddressRepository(tx);
      const disabled = await addressRepo.update(addressId, {
        isActive: false,
        isDefault: false,
      });

      if (existing.isDefault) {
        const nextDefault = await addressRepo.findManyPaginated({
          sellerId,
          page: 1,
          limit: 1,
          sortBy: "createdAt",
          sortOrder: "asc",
          isActive: true,
        });
        if (nextDefault[0]) {
          await addressRepo.update(nextDefault[0].id, { isDefault: true });
        }
      }

      return disabled;
    });

    auditLogger.log({
      actorUserId,
      action: SELLER_ADDRESS_ACTIONS.DISABLE,
      entityType: SELLER_ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: addressId,
      metadata: { sellerId, wasDefault: existing.isDefault },
    });

    return toSellerAddressDto(updated);
  }

  async deleteAddress(
    actorUserId: string,
    addressId: string,
  ): Promise<SellerAddressDto> {
    const sellerId = await this.resolveSellerId(actorUserId);
    const existing = await this.getOwnedAddressOrThrow(addressId, sellerId);

    const otherActive = await this.addressRepo.countActiveBySellerId(
      sellerId,
      addressId,
    );
    if (existing.isActive && otherActive === 0) {
      throw new ConflictError(
        "A seller must keep at least one active warehouse address",
      );
    }

    const orderCount =
      await this.addressRepo.countOrdersUsingAddress(addressId);
    if (orderCount > 0) {
      return this.disableAddress(actorUserId, addressId);
    }

    const deleted = await prisma.$transaction(async (tx) => {
      const addressRepo = new SellerAddressRepository(tx);

      if (existing.isDefault && otherActive > 0) {
        const nextDefault = await addressRepo.findManyPaginated({
          sellerId,
          page: 1,
          limit: 1,
          sortBy: "createdAt",
          sortOrder: "asc",
          isActive: true,
        });
        const candidate = nextDefault.find((a) => a.id !== addressId);
        if (candidate) {
          await addressRepo.clearDefaultsForSeller(sellerId, candidate.id);
          await addressRepo.update(candidate.id, { isDefault: true });
        }
      }

      return addressRepo.delete(addressId);
    });

    auditLogger.log({
      actorUserId,
      action: SELLER_ADDRESS_ACTIONS.DELETE,
      entityType: SELLER_ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: addressId,
      metadata: {
        sellerId,
        wasDefault: existing.isDefault,
        label: existing.label,
      },
    });

    return toSellerAddressDto(deleted);
  }

  async listAddresses(
    actorUserId: string,
    query: ListSellerAddressesQuery,
  ): Promise<{
    items: SellerAddressDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const sellerId = await this.resolveSellerId(actorUserId);
    return this.listAddressesForSeller(sellerId, query);
  }

  async listAddressesForSeller(
    sellerId: string,
    query: ListSellerAddressesQuery,
  ): Promise<{
    items: SellerAddressDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const seller = await this.sellerRepo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    const [records, total] = await Promise.all([
      this.addressRepo.findManyPaginated({
        sellerId,
        ...query,
      }),
      this.addressRepo.count({
        sellerId,
        search: query.search,
        isActive: query.isActive,
      }),
    ]);

    return {
      items: records.map(toSellerAddressDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}

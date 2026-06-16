import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import {
  ADDRESS_ACTIONS,
  ADDRESS_AUDIT_ENTITY_TYPE,
} from "../constants/address.constants.js";
import { toAddressDto } from "../dto/address.dto.js";
import {
  AddressRepository,
  type AddressRecord,
  type CreateAddressData,
  type UpdateAddressData,
} from "../repositories/address.repository.js";
import type {
  AddressDto,
  CreateAddressInput,
  ListAddressesQuery,
  UpdateAddressInput,
} from "../types/address.types.js";

function buildUpdateMetadata(
  before: AddressRecord,
  input: UpdateAddressInput,
): Record<string, unknown> {
  const changedFields: string[] = [];

  if (
    input.recipientName !== undefined &&
    input.recipientName !== before.name
  ) {
    changedFields.push("recipientName");
  }
  if (input.phoneNumber !== undefined && input.phoneNumber !== before.phone) {
    changedFields.push("phoneNumber");
  }
  if (
    input.addressLine1 !== undefined &&
    input.addressLine1 !== before.addressLine1
  ) {
    changedFields.push("addressLine1");
  }
  if (
    input.addressLine2 !== undefined &&
    input.addressLine2 !== before.addressLine2
  ) {
    changedFields.push("addressLine2");
  }
  if (input.city !== undefined && input.city !== before.city) {
    changedFields.push("city");
  }
  if (input.state !== undefined && input.state !== before.state) {
    changedFields.push("state");
  }
  if (input.country !== undefined && input.country !== before.country) {
    changedFields.push("country");
  }
  if (
    input.postalCode !== undefined &&
    input.postalCode !== before.postalCode
  ) {
    changedFields.push("postalCode");
  }
  if (
    input.isDefault !== undefined &&
    input.isDefault !== before.isDefault
  ) {
    changedFields.push("isDefault");
  }

  return { changedFields };
}

export class AddressService {
  private readonly addressRepo = new AddressRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  private async getOwnedAddressOrThrow(
    addressId: string,
    buyerId: string,
  ): Promise<AddressRecord> {
    const address = await this.addressRepo.findByIdAndBuyerId(
      addressId,
      buyerId,
    );
    if (!address) {
      throw new NotFoundError("Address not found");
    }
    return address;
  }

  async createAddress(
    actorUserId: string,
    input: CreateAddressInput,
  ): Promise<AddressDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);

    const created = await prisma.$transaction(async (tx) => {
      const addressRepo = new AddressRepository(tx);
      const existingCount = await addressRepo.countByBuyerId(buyerId);
      const shouldBeDefault = input.isDefault === true || existingCount === 0;

      if (shouldBeDefault) {
        await addressRepo.clearDefaultsForBuyer(buyerId);
      }

      const data: CreateAddressData = {
        buyerId,
        name: input.recipientName,
        phone: input.phoneNumber,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        country: input.country,
        postalCode: input.postalCode,
        isDefault: shouldBeDefault,
      };

      return addressRepo.create(data);
    });

    auditLogger.log({
      actorUserId,
      action: ADDRESS_ACTIONS.CREATE,
      entityType: ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: created.id,
      metadata: {
        buyerId,
        isDefault: created.isDefault,
        city: created.city,
        state: created.state,
        country: created.country,
      },
    });

    return toAddressDto(created);
  }

  async getAddress(
    actorUserId: string,
    addressId: string,
  ): Promise<AddressDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const address = await this.getOwnedAddressOrThrow(addressId, buyerId);
    return toAddressDto(address);
  }

  async updateAddress(
    actorUserId: string,
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<AddressDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const existing = await this.getOwnedAddressOrThrow(addressId, buyerId);

    const updated = await prisma.$transaction(async (tx) => {
      const addressRepo = new AddressRepository(tx);
      const updateData: UpdateAddressData = {
        ...(input.recipientName !== undefined
          ? { name: input.recipientName }
          : {}),
        ...(input.phoneNumber !== undefined ? { phone: input.phoneNumber } : {}),
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
      };

      if (input.isDefault === true) {
        await addressRepo.clearDefaultsForBuyer(buyerId, addressId);
        updateData.isDefault = true;
      } else if (input.isDefault === false) {
        updateData.isDefault = false;
      }

      return addressRepo.update(addressId, updateData);
    });

    auditLogger.log({
      actorUserId,
      action: ADDRESS_ACTIONS.UPDATE,
      entityType: ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: addressId,
      metadata: buildUpdateMetadata(existing, input),
    });

    return toAddressDto(updated);
  }

  async deleteAddress(
    actorUserId: string,
    addressId: string,
  ): Promise<AddressDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const existing = await this.getOwnedAddressOrThrow(addressId, buyerId);

    const deleted = await this.addressRepo.delete(addressId);

    auditLogger.log({
      actorUserId,
      action: ADDRESS_ACTIONS.DELETE,
      entityType: ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: addressId,
      metadata: {
        buyerId,
        wasDefault: existing.isDefault,
        city: existing.city,
        state: existing.state,
      },
    });

    return toAddressDto(deleted);
  }

  async setDefaultAddress(
    actorUserId: string,
    addressId: string,
  ): Promise<AddressDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const existing = await this.getOwnedAddressOrThrow(addressId, buyerId);

    if (existing.isDefault) {
      return toAddressDto(existing);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const addressRepo = new AddressRepository(tx);
      await addressRepo.clearDefaultsForBuyer(buyerId, addressId);
      return addressRepo.update(addressId, { isDefault: true });
    });

    auditLogger.log({
      actorUserId,
      action: ADDRESS_ACTIONS.SET_DEFAULT,
      entityType: ADDRESS_AUDIT_ENTITY_TYPE,
      entityId: addressId,
      metadata: {
        buyerId,
        previousDefaultCleared: true,
      },
    });

    return toAddressDto(updated);
  }

  async listAddresses(
    actorUserId: string,
    query: ListAddressesQuery,
  ): Promise<{
    items: AddressDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const buyerId = await this.resolveBuyerId(actorUserId);

    const [records, total] = await Promise.all([
      this.addressRepo.findManyPaginated({
        buyerId,
        ...query,
      }),
      this.addressRepo.count({
        buyerId,
        search: query.search,
      }),
    ]);

    return {
      items: records.map(toAddressDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}

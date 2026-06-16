/**
 * @read-only
 * @idempotent: yes
 * @external-calls: none
 */
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import { toOrderDetailDto, toOrderSummaryDto } from "../dto/order.dto.js";
import { OrderRepository } from "../repositories/order.repository.js";
import type {
  ListOrdersQuery,
  OrderDetailDto,
  OrderSummaryDto,
} from "../types/order.types.js";

export class OrderService {
  private readonly orderRepo = new OrderRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  private async resolveSellerId(actorUserId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(actorUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile required");
    }
    return seller.id;
  }

  private async resolveDeliveryPartnerId(
    actorUserId: string,
  ): Promise<string> {
    const partner = await prisma.deliveryPartnerProfile.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!partner) {
      throw new ForbiddenError("Delivery partner profile required");
    }
    return partner.id;
  }

  async listOrders(
    actorUserId: string,
    role: UserRole,
    query: ListOrdersQuery,
  ): Promise<{
    items: OrderSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const filters: Parameters<OrderRepository["findManySummaries"]>[0] = {
      ...query,
    };

    if (role === UserRole.BUYER) {
      filters.buyerId = await this.resolveBuyerId(actorUserId);
    } else if (role === UserRole.SELLER) {
      filters.sellerId = await this.resolveSellerId(actorUserId);
    } else if (role === UserRole.DELIVERY_PARTNER) {
      filters.deliveryPartnerId =
        await this.resolveDeliveryPartnerId(actorUserId);
    }

    const [records, total] = await Promise.all([
      this.orderRepo.findManySummaries(filters),
      this.orderRepo.count(filters),
    ]);

    return {
      items: records.map(toOrderSummaryDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listAssignedOrders(
    actorUserId: string,
    query: ListOrdersQuery,
  ): Promise<{
    items: OrderSummaryDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);

    const filters = {
      ...query,
      deliveryPartnerId,
      status: query.status ?? undefined,
    };

    const [records, total] = await Promise.all([
      this.orderRepo.findManySummaries(filters),
      this.orderRepo.count(filters),
    ]);

    return {
      items: records.map(toOrderSummaryDto),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getOrderDetails(
    actorUserId: string,
    role: UserRole,
    orderId: string,
  ): Promise<OrderDetailDto> {
    let record;

    switch (role) {
      case UserRole.BUYER: {
        const buyerId = await this.resolveBuyerId(actorUserId);
        record = await this.orderRepo.findDetailByIdForBuyer(orderId, buyerId);
        break;
      }
      case UserRole.SELLER: {
        const sellerId = await this.resolveSellerId(actorUserId);
        record = await this.orderRepo.findDetailByIdForSeller(orderId, sellerId);
        break;
      }
      case UserRole.DELIVERY_PARTNER: {
        const deliveryPartnerId =
          await this.resolveDeliveryPartnerId(actorUserId);
        record = await this.orderRepo.findDetailByIdForDeliveryPartner(
          orderId,
          deliveryPartnerId,
        );
        break;
      }
      case UserRole.ADMIN:
        record = await this.orderRepo.findDetailById(orderId);
        break;
      default:
        throw new ForbiddenError("Access denied");
    }

    if (!record) {
      throw new NotFoundError("Order not found");
    }

    return toOrderDetailDto(record);
  }
}

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
import {
  DELIVERY_PARTNER_COMPLETED_STATUSES,
  DELIVERY_PARTNER_FAILED_STATUSES,
  DELIVERY_PARTNER_INACTIVE_ASSIGNMENT_STATUSES,
} from "../constants/order.constants.js";
import { toOrderDetailDto, toOrderSummaryDto } from "../dto/order.dto.js";
import { OrderRepository } from "../repositories/order.repository.js";
import type {
  DeliveryPartnerAssignedStatsDto,
  ListOrdersQuery,
  OrderDetailDto,
  OrderSummaryDto,
} from "../types/order.types.js";

const INACTIVE_ASSIGNMENT_STATUS_SET = new Set<string>(
  DELIVERY_PARTNER_INACTIVE_ASSIGNMENT_STATUSES,
);
const COMPLETED_STATUS_SET = new Set<string>(
  DELIVERY_PARTNER_COMPLETED_STATUSES,
);
const FAILED_STATUS_SET = new Set<string>(DELIVERY_PARTNER_FAILED_STATUSES);

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

    const redactPricing = role === UserRole.DELIVERY_PARTNER;

    return {
      items: records.map((record) =>
        toOrderSummaryDto(record, {
          redactPricingForDeliveryPartner: redactPricing,
        }),
      ),
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
      items: records.map((record) =>
        toOrderSummaryDto(record, {
          redactPricingForDeliveryPartner: true,
        }),
      ),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getAssignedStats(
    actorUserId: string,
  ): Promise<DeliveryPartnerAssignedStatsDto> {
    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);
    const groups = await this.orderRepo.countAssignedByStatus(deliveryPartnerId);

    let ongoing = 0;
    let completed = 0;
    let failed = 0;

    for (const group of groups) {
      const count = group._count._all;
      const status = group.orderStatus;

      if (COMPLETED_STATUS_SET.has(status)) {
        completed += count;
      } else if (FAILED_STATUS_SET.has(status)) {
        failed += count;
      } else if (!INACTIVE_ASSIGNMENT_STATUS_SET.has(status)) {
        ongoing += count;
      }
    }

    return {
      ongoing,
      completed,
      failed,
      rating: null,
      ratingCount: null,
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

    const forDeliveryPartner = role === UserRole.DELIVERY_PARTNER;
    return toOrderDetailDto(record, {
      redactBuyerShippingForDeliveryPartner: forDeliveryPartner,
      redactPricingForDeliveryPartner: forDeliveryPartner,
    });
  }
}

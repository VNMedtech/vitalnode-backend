import type {
  OrderStatus,
  PrismaClient,
} from "../../../../generated/prisma/client.js";
import { POST_DELIVERY_ORDER_STATUSES } from "../../../shared/constants/orderSettlement.constants.js";

export interface EligibleDeliveryOrderRecord {
  id: string;
  buyerId: string;
  deliveryPartnerId: string;
  orderStatus: OrderStatus;
}

export class DeliveryPartnerReviewEligibilityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Returns the order when it belongs to the buyer, is post-delivery,
   * and has a non-null deliveryPartnerId (INTERNAL_DP final assignee).
   */
  findEligibleOrderForBuyer(
    orderId: string,
    buyerId: string,
  ): Promise<EligibleDeliveryOrderRecord | null> {
    return this.prisma.order
      .findFirst({
        where: {
          id: orderId,
          buyerId,
          orderStatus: { in: [...POST_DELIVERY_ORDER_STATUSES] },
          deliveryPartnerId: { not: null },
        },
        select: {
          id: true,
          buyerId: true,
          deliveryPartnerId: true,
          orderStatus: true,
        },
      })
      .then((order) => {
        if (!order || !order.deliveryPartnerId) {
          return null;
        }
        return {
          id: order.id,
          buyerId: order.buyerId,
          deliveryPartnerId: order.deliveryPartnerId,
          orderStatus: order.orderStatus,
        };
      });
  }

  findOrderOwnership(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        buyerId: true,
        deliveryPartnerId: true,
        orderStatus: true,
      },
    });
  }
}

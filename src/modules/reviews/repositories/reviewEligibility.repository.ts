import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { POST_DELIVERY_ORDER_STATUSES } from "../../../shared/constants/orderSettlement.constants.js";

export class ReviewEligibilityRepository {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  hasDeliveredPurchase(buyerId: string, productId: string): Promise<boolean> {
    return this.prisma.order
      .findFirst({
        where: {
          buyerId,
          orderStatus: { in: [...POST_DELIVERY_ORDER_STATUSES] },
          items: {
            some: { productId },
          },
        },
        select: { id: true },
      })
      .then((order) => order !== null);
  }
}

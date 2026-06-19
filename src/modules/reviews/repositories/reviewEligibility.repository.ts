import type { PrismaClient } from "../../../../generated/prisma/client.js";
import { OrderStatus } from "../../../../generated/prisma/client.js";

export class ReviewEligibilityRepository {
  constructor(
    private readonly prisma: PrismaClient,
  ) {}

  hasDeliveredPurchase(buyerId: string, productId: string): Promise<boolean> {
    return this.prisma.order
      .findFirst({
        where: {
          buyerId,
          orderStatus: OrderStatus.DELIVERED,
          items: {
            some: { productId },
          },
        },
        select: { id: true },
      })
      .then((order) => order !== null);
  }
}

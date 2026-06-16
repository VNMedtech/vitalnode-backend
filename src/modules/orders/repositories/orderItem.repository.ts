import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface OrderLineItem {
  id: string;
  productId: string;
  quantity: number;
  productSnapshot: Prisma.JsonValue;
}

export class OrderItemRepository {
  constructor(private readonly db: DbClient) {}

  findByOrderIdSorted(orderId: string): Promise<OrderLineItem[]> {
    return this.db.orderItem.findMany({
      where: { orderId },
      select: {
        id: true,
        productId: true,
        quantity: true,
        productSnapshot: true,
      },
      orderBy: { productId: "asc" },
    });
  }
}

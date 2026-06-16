import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

const cartItemProductSelect = {
  id: true,
  productName: true,
  brand: true,
  model: true,
  productType: true,
  description: true,
  pricing: true,
  moq: true,
  status: true,
  deletedAt: true,
  sellerId: true,
  seller: {
    select: {
      id: true,
      businessName: true,
      approvalStatus: true,
      user: {
        select: {
          status: true,
          deletedAt: true,
        },
      },
    },
  },
  category: {
    select: {
      isActive: true,
      deletedAt: true,
    },
  },
  inventory: {
    select: {
      availableQuantity: true,
    },
  },
  media: {
    select: {
      fileUrl: true,
      displayOrder: true,
    },
    orderBy: {
      displayOrder: "asc" as const,
    },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

const cartWithItemsSelect = {
  id: true,
  buyerId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
      product: {
        select: cartItemProductSelect,
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.CartSelect;

export type CartWithItemsRecord = Prisma.CartGetPayload<{
  select: typeof cartWithItemsSelect;
}>;

export class CartRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findByBuyerIdWithItems(buyerId: string) {
    return this.prisma.cart.findUnique({
      where: { buyerId },
      select: cartWithItemsSelect,
    });
  }

  findByBuyerId(buyerId: string) {
    return this.prisma.cart.findUnique({
      where: { buyerId },
      select: {
        id: true,
        buyerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  createForBuyer(buyerId: string) {
    return this.prisma.cart.create({
      data: { buyerId },
      select: cartWithItemsSelect,
    });
  }

  findOrCreateByBuyerId(buyerId: string) {
    return this.prisma.cart.upsert({
      where: { buyerId },
      create: { buyerId },
      update: {},
      select: {
        id: true,
        buyerId: true,
      },
    });
  }

  findByBuyerIdWithItemsAfterMutation(cartId: string) {
    return this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      select: cartWithItemsSelect,
    });
  }
}

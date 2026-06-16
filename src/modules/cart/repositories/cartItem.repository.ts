import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

export interface CreateCartItemData {
  cartId: string;
  productId: string;
  quantity: number;
}

export class CartItemRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findByIdAndCartId(itemId: string, cartId: string) {
    return this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
      select: {
        id: true,
        cartId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findByCartIdAndProductId(cartId: string, productId: string) {
    return this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId,
          productId,
        },
      },
      select: {
        id: true,
        cartId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  create(data: CreateCartItemData) {
    return this.prisma.cartItem.create({
      data,
      select: {
        id: true,
        cartId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  updateQuantity(itemId: string, quantity: number) {
    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      select: {
        id: true,
        cartId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  delete(itemId: string) {
    return this.prisma.cartItem.delete({
      where: { id: itemId },
      select: {
        id: true,
        cartId: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  deleteAllByCartId(cartId: string) {
    return this.prisma.cartItem.deleteMany({
      where: { cartId },
    });
  }

  deleteByCartIdAndProductIds(cartId: string, productIds: string[]) {
    if (productIds.length === 0) {
      return Promise.resolve({ count: 0 });
    }

    return this.prisma.cartItem.deleteMany({
      where: {
        cartId,
        productId: { in: productIds },
      },
    });
  }

  countByCartId(cartId: string) {
    return this.prisma.cartItem.count({
      where: { cartId },
    });
  }

  findSellerIdsByCartId(cartId: string) {
    return this.prisma.cartItem.findMany({
      where: { cartId },
      select: {
        product: {
          select: {
            sellerId: true,
          },
        },
      },
    });
  }
}

import { Prisma } from "../../../../generated/prisma/client.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import type { CartWithItemsRecord } from "../repositories/cart.repository.js";
import type { CartDto, CartItemDto, CartProductSummaryDto } from "../types/cart.types.js";

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

function multiplyDecimal(price: Prisma.Decimal, quantity: number): string {
  return price.mul(quantity).toString();
}

function sumLineTotals(items: CartItemDto[]): string {
  return items
    .reduce((sum, item) => sum.add(new Prisma.Decimal(item.lineTotal)), new Prisma.Decimal(0))
    .toString();
}

function isProductAvailable(
  product: CartWithItemsRecord["items"][number]["product"],
): boolean {
  if (product.deletedAt !== null) {
    return false;
  }

  if (product.status !== ProductStatus.APPROVED) {
    return false;
  }

  if (product.category.deletedAt !== null || !product.category.isActive) {
    return false;
  }

  if (product.seller.approvalStatus !== SellerApprovalStatus.ACTIVE) {
    return false;
  }

  if (
    product.seller.user.deletedAt !== null ||
    product.seller.user.status !== UserStatus.ACTIVE
  ) {
    return false;
  }

  return true;
}

function toCartProductSummaryDto(
  product: CartWithItemsRecord["items"][number]["product"],
): CartProductSummaryDto {
  const sortedMedia = [...product.media].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  return {
    id: product.id,
    productName: product.productName,
    brand: product.brand,
    model: product.model,
    productType: product.productType,
    description: product.description,
    pricing: decimalToString(product.pricing),
    moq: product.moq,
    availableQuantity: product.inventory?.availableQuantity ?? 0,
    primaryImageUrl: sortedMedia[0]?.fileUrl ?? null,
    seller: {
      id: product.seller.id,
      businessName: product.seller.businessName,
    },
    isAvailable: isProductAvailable(product),
  };
}

function sumItemQuantities(items: CartItemDto[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function resolveCartSeller(
  items: CartItemDto[],
): CartDto["seller"] {
  const firstItem = items[0];
  if (!firstItem) {
    return null;
  }

  return firstItem.product.seller;
}

function toCartItemDto(
  item: CartWithItemsRecord["items"][number],
): CartItemDto {
  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: decimalToString(item.product.pricing),
    lineTotal: multiplyDecimal(item.product.pricing, item.quantity),
    product: toCartProductSummaryDto(item.product),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function toCartDto(record: CartWithItemsRecord): CartDto {
  const items = record.items.map(toCartItemDto);

  return {
    id: record.id,
    buyerId: record.buyerId,
    seller: resolveCartSeller(items),
    items,
    itemCount: items.length,
    totalItems: sumItemQuantities(items),
    subtotal: sumLineTotals(items),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toEmptyCartDto(buyerId: string): CartDto {
  return {
    id: null,
    buyerId,
    seller: null,
    items: [],
    itemCount: 0,
    totalItems: 0,
    subtotal: "0",
    createdAt: null,
    updatedAt: null,
  };
}

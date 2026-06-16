import { ProductStatus } from "../enums/productStatus.enum.js";

export const PRODUCT_STATUS_TRANSITIONS: Readonly<
  Record<ProductStatus, readonly ProductStatus[]>
> = {
  [ProductStatus.PENDING_APPROVAL]: [
    ProductStatus.APPROVED,
    ProductStatus.REJECTED,
  ],
  [ProductStatus.APPROVED]: [
    ProductStatus.DISABLED,
    ProductStatus.OUT_OF_STOCK,
  ],
  [ProductStatus.OUT_OF_STOCK]: [ProductStatus.APPROVED],
  [ProductStatus.DISABLED]: [ProductStatus.APPROVED],
  [ProductStatus.REJECTED]: [],
};

export function canTransitionProductStatus(
  from: ProductStatus,
  to: ProductStatus,
): boolean {
  return PRODUCT_STATUS_TRANSITIONS[from].includes(to);
}

export function assertProductStatusTransition(
  from: ProductStatus,
  to: ProductStatus,
): void {
  if (!canTransitionProductStatus(from, to)) {
    throw new Error(`Invalid product status transition: ${from} -> ${to}`);
  }
}

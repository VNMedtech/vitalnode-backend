import type { ProductDetailRecord } from "../../products/repositories/product.repository.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";

export interface ValidatedCartProduct {
  id: string;
  sellerId: string;
  moq: number;
  availableQuantity: number;
}

export function validateProductForCart(
  product: ProductDetailRecord | null,
): ValidatedCartProduct {
  if (!product) {
    throw new NotFoundError("Product not found or unavailable");
  }

  if (product.status === ProductStatus.DISABLED) {
    throw new ValidationError("Validation failed", [
      { field: "productId", message: "Product is disabled" },
    ]);
  }

  if (
    product.status === ProductStatus.REJECTED ||
    product.status === ProductStatus.PENDING_APPROVAL
  ) {
    throw new ValidationError("Validation failed", [
      { field: "productId", message: "Product is not available for purchase" },
    ]);
  }

  if (product.status === ProductStatus.OUT_OF_STOCK) {
    throw new ConflictError("Product is out of stock");
  }

  if (!product.inventory) {
    throw new ValidationError("Validation failed", [
      { field: "productId", message: "Product inventory is not configured" },
    ]);
  }

  if (product.inventory.availableQuantity <= 0) {
    throw new ConflictError("Product is out of stock");
  }

  return {
    id: product.id,
    sellerId: product.sellerId,
    moq: product.moq,
    availableQuantity: product.inventory.availableQuantity,
  };
}

export function assertCartQuantityWithinInventory(
  quantity: number,
  product: ValidatedCartProduct,
): void {
  if (quantity < product.moq) {
    throw new ValidationError("Validation failed", [
      {
        field: "quantity",
        message: `Quantity must be at least the minimum order quantity of ${product.moq}`,
      },
    ]);
  }

  if (quantity > product.availableQuantity) {
    throw new ConflictError(
      `Only ${product.availableQuantity} units available in inventory`,
    );
  }
}

export function assertSingleSellerCart(
  existingSellerIds: string[],
  newProductSellerId: string,
): void {
  if (existingSellerIds.length === 0) {
    return;
  }

  const distinctSellerIds = [...new Set(existingSellerIds)];
  const cartSellerId = distinctSellerIds[0];

  if (distinctSellerIds.length > 1 || cartSellerId !== newProductSellerId) {
    throw new ValidationError("Validation failed", [
      {
        field: "productId",
        message: "Cart can only contain products from a single seller",
      },
    ]);
  }
}

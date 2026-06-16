/**
 * @transaction-owner
 * @idempotent: yes
 * @external-calls: none
 */
import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import { SellerApprovalStatus } from "../../../shared/enums/sellerApprovalStatus.enum.js";
import { UserStatus } from "../../../shared/enums/userStatus.enum.js";
import { withIdempotency } from "../../../shared/idempotency/withIdempotency.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { AddressRepository } from "../../addresses/repositories/address.repository.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import type { CartWithItemsRecord } from "../../cart/repositories/cart.repository.js";
import { CartRepository } from "../../cart/repositories/cart.repository.js";
import {
  ORDER_ACTIONS,
  ORDER_AUDIT_ENTITY_TYPE,
  ORDER_ROUTES,
} from "../constants/order.constants.js";
import { toCheckoutResultDto } from "../dto/order.dto.js";
import { OrderRepository } from "../repositories/order.repository.js";
import type {
  AddressSnapshot,
  CreateOrderInput,
  ProductSnapshot,
} from "../types/order.types.js";

type CartItem = CartWithItemsRecord["items"][number];

function isCartProductEligible(product: CartItem["product"]): boolean {
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

  return (
    product.seller.user.deletedAt === null &&
    product.seller.user.status === UserStatus.ACTIVE
  );
}

function buildProductSnapshot(item: CartItem): ProductSnapshot {
  const sortedMedia = [...item.product.media].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  return {
    id: item.product.id,
    productName: item.product.productName,
    brand: item.product.brand,
    model: item.product.model,
    productType: item.product.productType,
    pricing: item.product.pricing.toString(),
    moq: item.product.moq,
    status: item.product.status,
    sellerId: item.product.sellerId,
    primaryImageUrl: sortedMedia[0]?.fileUrl ?? null,
  };
}

function buildAddressSnapshot(
  address: Awaited<ReturnType<AddressRepository["findByIdAndBuyerId"]>>,
): AddressSnapshot {
  if (!address) {
    throw new NotFoundError("Shipping address not found");
  }

  return {
    id: address.id,
    name: address.name,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    country: address.country,
    postalCode: address.postalCode,
  };
}

export class CheckoutService {
  private readonly cartRepo = new CartRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly addressRepo = new AddressRepository(prisma);

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  async checkout(
    actorUserId: string,
    input: CreateOrderInput,
    idempotencyKey?: string,
  ) {
    const execute = async () => {
      const buyerId = await this.resolveBuyerId(actorUserId);
      const cart = await this.cartRepo.findByBuyerIdWithItems(buyerId);

      if (!cart || cart.items.length === 0) {
        throw new ValidationError("Cart is empty");
      }

      const address = await this.addressRepo.findByIdAndBuyerId(
        input.shippingAddressId,
        buyerId,
      );
      if (!address) {
        throw new NotFoundError("Shipping address not found");
      }

      const orderRepo = new OrderRepository(prisma);
      const pendingOrder = await orderRepo.findPendingPaymentByBuyerId(buyerId);
      if (pendingOrder) {
        throw new ConflictError(
          `Complete or cancel pending order ${pendingOrder.orderNumber} before starting a new checkout`,
        );
      }

      const sellerIds = new Set(cart.items.map((item) => item.product.sellerId));
      if (sellerIds.size !== 1) {
        throw new ValidationError(
          "Checkout requires all cart items from a single seller",
        );
      }

      const sellerId = cart.items[0]!.product.sellerId;

      for (const item of cart.items) {
        if (!isCartProductEligible(item.product)) {
          throw new ConflictError(
            `Product "${item.product.productName}" is unavailable for checkout`,
          );
        }

        if (item.quantity < item.product.moq) {
          throw new ValidationError("Validation failed", [
            {
              field: "quantity",
              message: `Quantity for "${item.product.productName}" must be at least ${item.product.moq}`,
            },
          ]);
        }

        const availableQuantity = item.product.inventory?.availableQuantity ?? 0;
        // Advisory pre-check only — authoritative deduction happens at payment success.
        if (availableQuantity < item.quantity) {
          throw new ConflictError(
            `Insufficient inventory for "${item.product.productName}"`,
          );
        }
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum.add(item.product.pricing.mul(item.quantity)),
        new Prisma.Decimal(0),
      );
      const totalAmount = subtotal;
      const shippingAddressSnapshot = buildAddressSnapshot(address);

      const created = await runInTransaction(async (tx) => {
        const orderRepo = new OrderRepository(tx);
        const orderNumber = await orderRepo.generateOrderNumber();

        const order = await orderRepo.createCheckoutOrder({
          orderNumber,
          buyerId,
          sellerId,
          shippingAddressSnapshot:
            shippingAddressSnapshot as unknown as Prisma.InputJsonValue,
          subtotal,
          totalAmount,
          items: cart.items.map((item) => ({
            productId: item.productId,
            productSnapshot: buildProductSnapshot(
              item,
            ) as unknown as Prisma.InputJsonValue,
            quantity: item.quantity,
            unitPrice: item.product.pricing,
            totalPrice: item.product.pricing.mul(item.quantity),
          })),
        });

        await recordCommerceAudit(tx, {
          actorUserId,
          action: ORDER_ACTIONS.CHECKOUT_INITIATED,
          entityType: ORDER_AUDIT_ENTITY_TYPE,
          entityId: order.id,
          metadata: {
            orderNumber: order.orderNumber,
            buyerId,
            sellerId,
            subtotal: subtotal.toString(),
            totalAmount: totalAmount.toString(),
            itemCount: cart.items.length,
            shippingAddressId: address.id,
          },
        });

        return order;
      });

      if (!created.payment) {
        throw new ConflictError("Payment record was not created for order");
      }

      return toCheckoutResultDto({
        orderId: created.id,
        orderNumber: created.orderNumber,
        orderStatus: created.orderStatus,
        subtotal: created.subtotal,
        totalAmount: created.totalAmount,
        paymentId: created.payment.id,
      });
    };

    if (!idempotencyKey) {
      return execute();
    }

    return withIdempotency({
      actorUserId,
      key: idempotencyKey,
      route: ORDER_ROUTES.CHECKOUT,
      requestHash: `${input.shippingAddressId}`,
      handler: execute,
    });
  }
}

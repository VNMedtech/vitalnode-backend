import {
  OrderStatus,
  type Prisma,
} from "../../../../generated/prisma/client.js";
import type {
  OrderDetailRecord,
  OrderSummaryRecord,
} from "../repositories/order.repository.js";
import type {
  AddressSnapshot,
  CheckoutResultDto,
  OrderDeliveryPartnerContactDto,
  OrderDetailDto,
  OrderItemDto,
  OrderPaymentSummary,
  OrderProofDto,
  OrderSellerContactDto,
  OrderSummaryDto,
  ProductSnapshot,
} from "../types/order.types.js";

/** Statuses where the delivery partner may see the customer shipping address. */
const DELIVERY_PARTNER_CUSTOMER_VISIBLE_STATUSES: ReadonlySet<OrderStatus> =
  new Set([
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.PENDING_SETTLEMENT,
    OrderStatus.DELIVERY_FAILED,
  ]);

export function isCustomerDetailsVisibleToDeliveryPartner(
  status: OrderStatus,
): boolean {
  return DELIVERY_PARTNER_CUSTOMER_VISIBLE_STATUSES.has(status);
}

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

function parseProductSnapshot(snapshot: Prisma.JsonValue): ProductSnapshot {
  const data = snapshot as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    productName: String(data.productName ?? ""),
    brand: String(data.brand ?? ""),
    model: String(data.model ?? ""),
    productType: String(data.productType ?? ""),
    pricing: String(data.pricing ?? ""),
    moq: Number(data.moq ?? 0),
    status: String(data.status ?? ""),
    sellerId: String(data.sellerId ?? ""),
    primaryImageUrl:
      data.primaryImageUrl === null || data.primaryImageUrl === undefined
        ? null
        : String(data.primaryImageUrl),
  };
}

function parseAddressSnapshot(snapshot: Prisma.JsonValue): AddressSnapshot {
  const data = snapshot as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? ""),
    phone: String(data.phone ?? ""),
    addressLine1: String(data.addressLine1 ?? ""),
    addressLine2:
      data.addressLine2 === null || data.addressLine2 === undefined
        ? null
        : String(data.addressLine2),
    city: String(data.city ?? ""),
    state: String(data.state ?? ""),
    country: String(data.country ?? ""),
    postalCode: String(data.postalCode ?? ""),
  };
}

function toOrderItemDto(
  item: OrderSummaryRecord["items"][number],
): OrderItemDto {
  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: decimalToString(item.unitPrice),
    totalPrice: decimalToString(item.totalPrice),
    productSnapshot: parseProductSnapshot(item.productSnapshot),
  };
}

function toPaymentSummary(
  payment: OrderDetailRecord["payment"],
): OrderPaymentSummary | null {
  if (!payment) {
    return null;
  }

  return {
    id: payment.id,
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId,
    amount: decimalToString(payment.amount),
    paymentStatus: payment.paymentStatus,
    refundStatus: payment.refundStatus,
  };
}

function toProofDto(proof: OrderDetailRecord["proofs"][number]): OrderProofDto {
  return {
    id: proof.id,
    proofType: proof.proofType,
    fileUploadId: proof.fileUploadId,
    fileUrl: proof.fileUrl,
    uploadedBy: proof.uploadedBy,
    createdAt: proof.createdAt,
  };
}

function toDeliveryPartnerContactDto(
  partner: OrderDetailRecord["deliveryPartner"],
): OrderDeliveryPartnerContactDto | null {
  if (!partner) {
    return null;
  }

  return {
    id: partner.id,
    firstName: partner.user.firstName,
    lastName: partner.user.lastName,
    phoneNumber: partner.user.phoneNumber,
  };
}

function toSellerContactDto(
  seller: OrderDetailRecord["seller"],
): OrderSellerContactDto {
  return {
    id: seller.id,
    businessName: seller.businessName,
    contactPerson: seller.contactPerson,
    phoneNumber: seller.user.phoneNumber,
    addressLine1: seller.addressLine1,
    addressLine2: seller.addressLine2,
    city: seller.city,
    state: seller.state,
    country: seller.country,
    postalCode: seller.postalCode,
  };
}

export function toOrderSummaryDto(record: OrderSummaryRecord): OrderSummaryDto {
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    orderStatus: record.orderStatus,
    totalAmount: decimalToString(record.totalAmount),
    subtotal: decimalToString(record.subtotal),
    placedAt: record.placedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    buyerId: record.buyerId,
    sellerId: record.sellerId,
    deliveryPartnerId: record.deliveryPartnerId,
  };
}

export type ToOrderDetailDtoOptions = {
  /** When true, omit buyer shipping until the order is out for delivery. */
  redactBuyerShippingForDeliveryPartner?: boolean;
};

export function toOrderDetailDto(
  record: OrderDetailRecord,
  options: ToOrderDetailDtoOptions = {},
): OrderDetailDto {
  const showCustomerShipping =
    !options.redactBuyerShippingForDeliveryPartner ||
    isCustomerDetailsVisibleToDeliveryPartner(record.orderStatus);

  return {
    ...toOrderSummaryDto(record),
    shippingAddressSnapshot: showCustomerShipping
      ? parseAddressSnapshot(record.shippingAddressSnapshot)
      : null,
    seller: toSellerContactDto(record.seller),
    deliveryPartner: toDeliveryPartnerContactDto(record.deliveryPartner),
    items: record.items.map(toOrderItemDto),
    payment: toPaymentSummary(record.payment),
    proofs: record.proofs.map(toProofDto),
  };
}

export function toCheckoutResultDto(input: {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderDetailRecord["orderStatus"];
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  paymentId: string;
}): CheckoutResultDto {
  return {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    orderStatus: input.orderStatus,
    subtotal: decimalToString(input.subtotal),
    totalAmount: decimalToString(input.totalAmount),
    paymentId: input.paymentId,
  };
}

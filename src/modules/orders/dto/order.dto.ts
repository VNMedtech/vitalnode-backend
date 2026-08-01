import {
  OrderStatus,
  type Prisma,
} from "../../../../generated/prisma/client.js";
import { toDeliveryPartnerReviewDto } from "../../deliveryPartnerReviews/dto/deliveryPartnerReview.dto.js";
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
  PickupAddressSnapshot,
  ProductSnapshot,
  ShipmentDto,
} from "../types/order.types.js";

/** Statuses where the delivery partner may see the customer shipping address. */
const DELIVERY_PARTNER_CUSTOMER_VISIBLE_STATUSES: ReadonlySet<OrderStatus> =
  new Set([
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.PENDING_SETTLEMENT,
    OrderStatus.SETTLED,
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

function parseProductSnapshot(
  snapshot: Prisma.JsonValue,
  options: { redactPricingForDeliveryPartner?: boolean } = {},
): ProductSnapshot {
  const data = snapshot as Record<string, unknown>;
  const redactPricing = options.redactPricingForDeliveryPartner === true;
  return {
    id: String(data.id ?? ""),
    productName: String(data.productName ?? ""),
    brand: String(data.brand ?? ""),
    model: String(data.model ?? ""),
    productType: String(data.productType ?? ""),
    pricing: redactPricing ? null : String(data.pricing ?? ""),
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

function parsePickupAddressSnapshot(
  snapshot: Prisma.JsonValue,
): PickupAddressSnapshot {
  const data = snapshot as Record<string, unknown>;
  return {
    id: String(data.id ?? ""),
    label: String(data.label ?? ""),
    contactPerson:
      data.contactPerson === null || data.contactPerson === undefined
        ? null
        : String(data.contactPerson),
    phone:
      data.phone === null || data.phone === undefined
        ? null
        : String(data.phone),
    addressLine1: String(data.addressLine1 ?? ""),
    addressLine2:
      data.addressLine2 === null || data.addressLine2 === undefined
        ? null
        : String(data.addressLine2),
    city: String(data.city ?? ""),
    state: String(data.state ?? ""),
    country: String(data.country ?? ""),
    postalCode: String(data.postalCode ?? ""),
    latitude:
      data.latitude === null || data.latitude === undefined
        ? null
        : String(data.latitude),
    longitude:
      data.longitude === null || data.longitude === undefined
        ? null
        : String(data.longitude),
  };
}

/**
 * TEMPORARY legacy fallback: build a pickup snapshot from the live SellerProfile
 * address when `Order.pickupAddressSnapshot` is missing (pre-warehouse orders).
 * New confirms always persist a warehouse snapshot — do not rely on this path
 * for current fulfillment. Remove once legacy orders are backfilled or aged out.
 */
function pickupSnapshotFromSellerProfile(
  seller: OrderDetailRecord["seller"],
): PickupAddressSnapshot {
  return {
    id: seller.id,
    label: "Business address",
    contactPerson: seller.contactPerson,
    phone: seller.user.phoneNumber,
    addressLine1: seller.addressLine1,
    addressLine2: seller.addressLine2,
    city: seller.city,
    state: seller.state,
    country: seller.country,
    postalCode: seller.postalCode,
    latitude: seller.latitude == null ? null : seller.latitude.toString(),
    longitude: seller.longitude == null ? null : seller.longitude.toString(),
  };
}

function resolvePickupAddressSnapshot(
  record: OrderDetailRecord,
): PickupAddressSnapshot | null {
  if (record.pickupAddressSnapshot != null) {
    return parsePickupAddressSnapshot(record.pickupAddressSnapshot);
  }
  // Temporary: pre-warehouse orders only. Prefer Order.pickupAddressSnapshot.
  return pickupSnapshotFromSellerProfile(record.seller);
}

function toOrderItemDto(
  item: OrderSummaryRecord["items"][number],
  options: { redactPricingForDeliveryPartner?: boolean } = {},
): OrderItemDto {
  const redactPricing = options.redactPricingForDeliveryPartner === true;
  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: redactPricing ? null : decimalToString(item.unitPrice),
    totalPrice: redactPricing ? null : decimalToString(item.totalPrice),
    productSnapshot: parseProductSnapshot(item.productSnapshot, options),
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

/** Maps SellerProfile contact; address fields are registered business address (not dispatch pickup). */
function toSellerContactDto(
  seller: OrderDetailRecord["seller"],
): OrderSellerContactDto {
  return {
    id: seller.id,
    businessName: seller.businessName,
    contactPerson: seller.contactPerson,
    phoneNumber: seller.user.phoneNumber,
    // Deprecated for dispatch — clients must use pickupAddressSnapshot.
    addressLine1: seller.addressLine1,
    addressLine2: seller.addressLine2,
    city: seller.city,
    state: seller.state,
    country: seller.country,
    postalCode: seller.postalCode,
  };
}

function toShipmentDto(
  shipment: OrderDetailRecord["shipment"],
): ShipmentDto | null {
  if (!shipment) {
    return null;
  }

  return {
    id: shipment.id,
    method: shipment.method,
    bookingSource: shipment.bookingSource,
    status: shipment.status,
    deliveryPartnerId: shipment.deliveryPartnerId,
    carrier: shipment.carrier,
    awbNumber: shipment.awbNumber,
    trackingUrl: shipment.trackingUrl,
    labelUrl: shipment.labelUrl,
    externalShipmentId: shipment.externalShipmentId,
    bookedAt: shipment.bookedAt,
    shippedAt: shipment.shippedAt,
    deliveredAt: shipment.deliveredAt,
    failureReason: shipment.failureReason,
  };
}

export type ToOrderSummaryDtoOptions = {
  /** When true, null out commercial pricing fields for delivery partners. */
  redactPricingForDeliveryPartner?: boolean;
  /** When true, omit customerName until the order is SHIPPED (or later). */
  redactBuyerShippingForDeliveryPartner?: boolean;
};

function resolveCustomerName(
  record: OrderSummaryRecord,
  options: ToOrderSummaryDtoOptions,
): string | null {
  if (
    options.redactBuyerShippingForDeliveryPartner &&
    !isCustomerDetailsVisibleToDeliveryPartner(record.orderStatus)
  ) {
    return null;
  }
  if (record.shippingAddressSnapshot == null) {
    return null;
  }
  const name = parseAddressSnapshot(record.shippingAddressSnapshot).name.trim();
  return name || null;
}

export function toOrderSummaryDto(
  record: OrderSummaryRecord,
  options: ToOrderSummaryDtoOptions = {},
): OrderSummaryDto {
  const redactPricing = options.redactPricingForDeliveryPartner === true;
  return {
    id: record.id,
    orderNumber: record.orderNumber,
    orderStatus: record.orderStatus,
    totalAmount: redactPricing ? null : decimalToString(record.totalAmount),
    subtotal: redactPricing ? null : decimalToString(record.subtotal),
    placedAt: record.placedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    buyerId: record.buyerId,
    sellerId: record.sellerId,
    deliveryPartnerId: record.deliveryPartnerId,
    customerName: resolveCustomerName(record, options),
    shipment: toShipmentDto(record.shipment),
  };
}

export type ToOrderDetailDtoOptions = {
  /** When true, omit buyer shipping until the order is SHIPPED. */
  redactBuyerShippingForDeliveryPartner?: boolean;
  /** When true, null out commercial pricing / payment for delivery partners. */
  redactPricingForDeliveryPartner?: boolean;
  /** When true, include the buyer's delivery-partner review (buyer role only). */
  includeDeliveryPartnerReview?: boolean;
};

export function toOrderDetailDto(
  record: OrderDetailRecord,
  options: ToOrderDetailDtoOptions = {},
): OrderDetailDto {
  const showCustomerShipping =
    !options.redactBuyerShippingForDeliveryPartner ||
    isCustomerDetailsVisibleToDeliveryPartner(record.orderStatus);
  const redactPricing = options.redactPricingForDeliveryPartner === true;
  const summaryOptions: ToOrderSummaryDtoOptions = {
    redactPricingForDeliveryPartner: redactPricing,
    redactBuyerShippingForDeliveryPartner:
      options.redactBuyerShippingForDeliveryPartner,
  };

  return {
    ...toOrderSummaryDto(record, summaryOptions),
    shippingAddressSnapshot: showCustomerShipping
      ? parseAddressSnapshot(record.shippingAddressSnapshot)
      : null,
    pickupAddressSnapshot: resolvePickupAddressSnapshot(record),
    seller: toSellerContactDto(record.seller),
    deliveryPartner: toDeliveryPartnerContactDto(record.deliveryPartner),
    shipment: toShipmentDto(record.shipment),
    items: record.items.map((item) => toOrderItemDto(item, summaryOptions)),
    payment: redactPricing ? null : toPaymentSummary(record.payment),
    proofs: record.proofs.map(toProofDto),
    deliveryPartnerReview:
      options.includeDeliveryPartnerReview && record.deliveryPartnerReview
        ? toDeliveryPartnerReviewDto(record.deliveryPartnerReview)
        : null,
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

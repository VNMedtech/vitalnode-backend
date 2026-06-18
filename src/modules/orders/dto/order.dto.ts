import type { Prisma } from "../../../../generated/prisma/client.js";
import type {
  OrderDetailRecord,
  OrderSummaryRecord,
} from "../repositories/order.repository.js";
import type {
  AddressSnapshot,
  CheckoutResultDto,
  OrderDetailDto,
  OrderItemDto,
  OrderPaymentSummary,
  OrderProofDto,
  OrderSummaryDto,
  ProductSnapshot,
} from "../types/order.types.js";

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

export function toOrderDetailDto(record: OrderDetailRecord): OrderDetailDto {
  return {
    ...toOrderSummaryDto(record),
    shippingAddressSnapshot: parseAddressSnapshot(record.shippingAddressSnapshot),
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

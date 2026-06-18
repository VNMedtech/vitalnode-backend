import type { OrderStatus, ProofType } from "../../../../generated/prisma/client.js";
import type { OrderSortField } from "../constants/order.constants.js";

export interface CreateOrderInput {
  shippingAddressId: string;
}

export interface CancelOrderInput {
  orderId: string;
  reason?: string;
}

export interface CancelOrderByIdInput {
  reason?: string;
}

export interface AssignDeliveryPartnerInput {
  deliveryPartnerId: string;
}

export interface OrderProofInput {
  fileUploadId: string;
  fileUrl: string;
}

export interface DeliveryFailedInput {
  reason?: string;
}

export interface ListOrdersQuery {
  page: number;
  limit: number;
  sortBy: OrderSortField;
  sortOrder: "asc" | "desc";
  status?: OrderStatus;
  search?: string;
}

export interface ProductSnapshot {
  id: string;
  productName: string;
  brand: string;
  model: string;
  productType: string;
  pricing: string;
  moq: number;
  status: string;
  sellerId: string;
  primaryImageUrl: string | null;
}

export interface AddressSnapshot {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface OrderPaymentSummary {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: string;
  paymentStatus: string;
  refundStatus: string;
}

export interface OrderProofDto {
  id: string;
  proofType: ProofType;
  fileUploadId: string | null;
  fileUrl: string;
  uploadedBy: string;
  createdAt: Date;
}

export interface OrderItemDto {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  productSnapshot: ProductSnapshot;
}

export interface OrderSummaryDto {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  totalAmount: string;
  subtotal: string;
  placedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  buyerId: string;
  sellerId: string;
  deliveryPartnerId: string | null;
}

export interface OrderDetailDto extends OrderSummaryDto {
  shippingAddressSnapshot: AddressSnapshot;
  items: OrderItemDto[];
  payment: OrderPaymentSummary | null;
  proofs: OrderProofDto[];
}

export interface CheckoutResultDto {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  subtotal: string;
  totalAmount: string;
  paymentId: string;
}

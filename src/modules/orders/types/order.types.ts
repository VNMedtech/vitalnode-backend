import type {
  FulfillmentMethod,
  OrderStatus,
  ProofType,
  ShipmentBookingSource,
  ShipmentStatus,
} from "../../../../generated/prisma/client.js";
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

export interface ConfirmOrderInput {
  pickupAddressId: string;
}

export interface SwitchFulfillmentMethodInput {
  fulfillmentMethod: FulfillmentMethod;
}

export interface SaveTrackingInput {
  carrier?: string | null;
  awbNumber?: string | null;
  trackingUrl?: string | null;
}

export interface OrderProofInput {
  fileUploadId: string;
  fileUrl: string;
}

export interface DeliveryFailedInput {
  reason?: string;
}

export interface ShipmentDto {
  id: string;
  method: FulfillmentMethod;
  bookingSource: ShipmentBookingSource | null;
  status: ShipmentStatus;
  deliveryPartnerId: string | null;
  carrier: string | null;
  awbNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  externalShipmentId: string | null;
  bookedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  failureReason: string | null;
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

export interface PickupAddressSnapshot {
  id: string;
  label: string;
  contactPerson: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: string | null;
  longitude: string | null;
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
  /** Present after seller/admin confirm; null while PLACED / unpaid. */
  shipment: ShipmentDto | null;
}

/** Contact fields for the assigned delivery partner (order detail only). */
export interface OrderDeliveryPartnerContactDto {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
}

/**
 * Seller identity/contact on order detail.
 * Address fields below are the registered SellerProfile business address (legacy).
 * Dispatch pickup origin must use `pickupAddressSnapshot`, not these fields.
 */
export interface OrderSellerContactDto {
  id: string;
  businessName: string;
  contactPerson: string;
  phoneNumber: string | null;
  /**
   * @deprecated Registered business address only. Do not use for dispatch pickup —
   * use `OrderDetailDto.pickupAddressSnapshot` instead. Kept for backward compatibility.
   */
  addressLine1: string;
  /** @deprecated See addressLine1 — use pickupAddressSnapshot for dispatch. */
  addressLine2: string | null;
  /** @deprecated See addressLine1 — use pickupAddressSnapshot for dispatch. */
  city: string;
  /** @deprecated See addressLine1 — use pickupAddressSnapshot for dispatch. */
  state: string;
  /** @deprecated See addressLine1 — use pickupAddressSnapshot for dispatch. */
  country: string;
  /** @deprecated See addressLine1 — use pickupAddressSnapshot for dispatch. */
  postalCode: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  /** Null for delivery partners until the order is SHIPPED. */
  shippingAddressSnapshot: AddressSnapshot | null;
  /**
   * Immutable pickup warehouse snapshotted at confirmation.
   * Temporary fallback: if missing (pre-warehouse orders), DTO may synthesize
   * from SellerProfile address via pickupSnapshotFromSellerProfile — do not
   * treat that as the long-term source of truth.
   */
  pickupAddressSnapshot: PickupAddressSnapshot | null;
  seller: OrderSellerContactDto;
  deliveryPartner: OrderDeliveryPartnerContactDto | null;
  shipment: ShipmentDto | null;
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

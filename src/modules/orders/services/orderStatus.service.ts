/**
 * @transaction-owner
 * @idempotent: yes (status guards + conditional updates)
 * @external-calls: none
 */
import {
  FulfillmentMethod,
  OrderStatus,
  ProofType,
  ShipmentBookingSource,
  ShipmentStatus,
} from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import {
  assertOrderStatusTransition,
  canTransitionOrderStatus,
} from "../../../shared/stateMachine/orderStatus.guard.js";
import { runInTransaction } from "../../../shared/transactions/runInTransaction.js";
import { recordCommerceAudit } from "../../auditLogs/services/commerceAudit.service.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import { SellerAddressRepository } from "../../sellerAddresses/repositories/sellerAddress.repository.js";
import { UPLOAD_TYPES } from "../../uploads/constants/upload.constants.js";
import { UploadAssociationService } from "../../uploads/services/uploadAssociation.service.js";
import {
  ORDER_ACTIONS,
  ORDER_AUDIT_ENTITY_TYPE,
} from "../constants/order.constants.js";
import { toOrderDetailDto } from "../dto/order.dto.js";
import { OrderRepository } from "../repositories/order.repository.js";
import { OrderProofRepository } from "../repositories/orderProof.repository.js";
import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { finalizeOrderEarningsOnDelivery } from "../../settlements/services/sellerCommission.service.js";
import {
  notificationDispatcher,
  orderNotificationContextService,
} from "../../notifications/index.js";
import type {
  ConfirmOrderInput,
  DeliveryFailedInput,
  OrderDetailDto,
  OrderProofInput,
  PickupAddressSnapshot,
  SaveTrackingInput,
  SwitchFulfillmentMethodInput,
} from "../types/order.types.js";
import type { OrderDetailRecord } from "../repositories/order.repository.js";
import type { SellerAddressRecord } from "../../sellerAddresses/repositories/sellerAddress.repository.js";
import type { Prisma } from "../../../../generated/prisma/client.js";

function buildPickupAddressSnapshot(
  address: SellerAddressRecord,
): PickupAddressSnapshot {
  return {
    id: address.id,
    label: address.label,
    contactPerson: address.contactPerson,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    country: address.country,
    postalCode: address.postalCode,
    latitude: address.latitude == null ? null : address.latitude.toString(),
    longitude: address.longitude == null ? null : address.longitude.toString(),
  };
}
function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrderStatus(from, to)) {
    throw new ConflictError(`Invalid order status transition: ${from} -> ${to}`);
  }
}

function requireShipment(order: OrderDetailRecord) {
  if (!order.shipment) {
    throw new ConflictError(
      "Fulfillment method must be set before this action",
    );
  }
  return order.shipment;
}

export class OrderStatusService {
  private readonly orderRepo = new OrderRepository(prisma);
  private readonly sellerRepo = new SellerRepository(prisma);
  private readonly uploadAssociation = new UploadAssociationService();

  private async storeHandoverProofFile(
    actorUserId: string,
    file: Express.Multer.File,
  ): Promise<OrderProofInput> {
    const upload = await this.uploadAssociation.storeFileForAssociation(
      actorUserId,
      UserRole.SELLER,
      UPLOAD_TYPES.HANDOVER_PROOF,
      file,
    );

    return {
      fileUploadId: upload.id,
      fileUrl: upload.fileUrl,
    };
  }

  private async storeDeliveryProofFile(
    actorUserId: string,
    file: Express.Multer.File,
  ): Promise<OrderProofInput> {
    const upload = await this.uploadAssociation.storeFileForAssociation(
      actorUserId,
      UserRole.DELIVERY_PARTNER,
      UPLOAD_TYPES.DELIVERY_PROOF,
      file,
    );

    return {
      fileUploadId: upload.id,
      fileUrl: upload.fileUrl,
    };
  }

  private async resolveSellerId(actorUserId: string): Promise<string> {
    const seller = await this.sellerRepo.findIdByUserId(actorUserId);
    if (!seller) {
      throw new ForbiddenError("Seller profile required");
    }
    return seller.id;
  }

  private async resolveDeliveryPartnerId(
    actorUserId: string,
  ): Promise<string> {
    const partner = await prisma.deliveryPartnerProfile.findUnique({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!partner) {
      throw new ForbiddenError("Delivery partner profile required");
    }
    return partner.id;
  }

  private async getSellerOrderOrThrow(orderId: string, sellerId: string) {
    const order = await this.orderRepo.findDetailByIdForSeller(orderId, sellerId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    return order;
  }

  private async getDeliveryPartnerOrderOrThrow(
    orderId: string,
    deliveryPartnerId: string,
  ) {
    const order = await this.orderRepo.findDetailByIdForDeliveryPartner(
      orderId,
      deliveryPartnerId,
    );
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    return order;
  }

  private async getOrderForSellerOrAdmin(
    actorUserId: string,
    role: UserRole,
    orderId: string,
  ): Promise<OrderDetailRecord> {
    if (role === UserRole.ADMIN) {
      const order = await this.orderRepo.findDetailById(orderId);
      if (!order) {
        throw new NotFoundError("Order not found");
      }
      return order;
    }

    if (role === UserRole.SELLER) {
      const sellerId = await this.resolveSellerId(actorUserId);
      return this.getSellerOrderOrThrow(orderId, sellerId);
    }

    throw new ForbiddenError("Seller or admin access required");
  }

  async confirmOrder(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    input: ConfirmOrderInput,
  ): Promise<OrderDetailDto> {
    const order = await this.getOrderForSellerOrAdmin(actorUserId, role, orderId);

    const from = order.orderStatus;
    const to = OrderStatus.CONFIRMED;
    assertTransition(from, to);

    if (from !== OrderStatus.PLACED) {
      throw new ConflictError("Order must be placed before confirmation");
    }

    if (order.shipment) {
      throw new ConflictError("Order already has a shipment");
    }

    const pickupAddress = await new SellerAddressRepository(prisma).findById(
      input.pickupAddressId,
    );
    if (!pickupAddress || pickupAddress.sellerId !== order.sellerId) {
      throw new ValidationError("Invalid pickup warehouse address", [
        {
          field: "pickupAddressId",
          message: "Pickup address must belong to the order's seller",
        },
      ]);
    }
    if (!pickupAddress.isActive) {
      throw new ValidationError("Invalid pickup warehouse address", [
        {
          field: "pickupAddressId",
          message: "Pickup address is inactive",
        },
      ]);
    }

    const pickupAddressSnapshot = buildPickupAddressSnapshot(pickupAddress);

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (role === UserRole.SELLER) {
        const sellerId = await this.resolveSellerId(actorUserId);
        if (locked.sellerId !== sellerId) {
          throw new NotFoundError("Order not found");
        }
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
        pickupAddressId: pickupAddress.id,
        pickupAddressSnapshot:
          pickupAddressSnapshot as unknown as Prisma.InputJsonValue,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          pickupAddressId: pickupAddress.id,
          processedByRole: role,
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      const orderConfirmedEvent =
        await orderNotificationContextService.buildOrderConfirmedEvent(orderId);
      if (orderConfirmedEvent) {
        notificationDispatcher.emit(orderConfirmedEvent);
      }

      return toOrderDetailDto(detail);
    });
  }

  async switchFulfillmentMethod(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    input: SwitchFulfillmentMethodInput,
  ): Promise<OrderDetailDto> {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only admin can set or switch fulfillment method");
    }

    const order = await this.orderRepo.findDetailById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    if (order.orderStatus !== OrderStatus.CONFIRMED) {
      throw new ConflictError(
        "Fulfillment method can only be changed while order is CONFIRMED",
      );
    }

    const bookingSource =
      input.fulfillmentMethod === FulfillmentMethod.THIRD_PARTY
        ? ShipmentBookingSource.MANUAL
        : null;

    if (!order.shipment) {
      return runInTransaction(async (tx) => {
        const orderRepo = new OrderRepository(tx);
        const shipmentRepo = new ShipmentRepository(tx);

        const locked = await orderRepo.lockById(orderId);
        if (!locked) {
          throw new NotFoundError("Order not found");
        }

        if (locked.orderStatus !== OrderStatus.CONFIRMED) {
          throw new ConflictError("Order status has changed");
        }

        await shipmentRepo.create({
          orderId,
          method: input.fulfillmentMethod,
          bookingSource,
          status: ShipmentStatus.CREATED,
        });

        await recordCommerceAudit(tx, {
          actorUserId,
          action: ORDER_ACTIONS.FULFILLMENT_METHOD_SET,
          entityType: ORDER_AUDIT_ENTITY_TYPE,
          entityId: orderId,
          metadata: {
            fulfillmentMethod: input.fulfillmentMethod,
            bookingSource,
            processedByRole: role,
          },
        });

        const detail = await orderRepo.findDetailById(orderId);
        if (!detail) {
          throw new NotFoundError("Order not found");
        }
        return toOrderDetailDto(detail);
      });
    }

    const shipment = order.shipment;

    if (shipment.method === input.fulfillmentMethod) {
      return toOrderDetailDto(order);
    }

    const clearPartner =
      input.fulfillmentMethod === FulfillmentMethod.THIRD_PARTY;
    const clearTracking =
      input.fulfillmentMethod === FulfillmentMethod.INTERNAL_DP;

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== OrderStatus.CONFIRMED) {
        throw new ConflictError("Order status has changed");
      }

      await shipmentRepo.updateMethod({
        orderId,
        method: input.fulfillmentMethod,
        bookingSource,
        status: ShipmentStatus.CREATED,
        clearPartner,
        clearTracking,
      });

      if (clearPartner) {
        await orderRepo.clearDeliveryPartner({
          orderId,
          expectedStatus: OrderStatus.CONFIRMED,
        });
      }

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.FULFILLMENT_METHOD_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousMethod: shipment.method,
          newMethod: input.fulfillmentMethod,
          processedByRole: role,
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }
      return toOrderDetailDto(detail);
    });
  }

  async saveTrackingDetails(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    input: SaveTrackingInput,
  ): Promise<OrderDetailDto> {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only admin can save or update tracking details");
    }

    const order = await this.orderRepo.findDetailById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found");
    }
    const shipment = requireShipment(order);

    if (shipment.method !== FulfillmentMethod.THIRD_PARTY) {
      throw new ConflictError(
        "Tracking details apply only to third-party fulfillment",
      );
    }

    if (
      order.orderStatus !== OrderStatus.CONFIRMED &&
      order.orderStatus !== OrderStatus.SHIPPED
    ) {
      throw new ConflictError(
        "Tracking details can only be saved while order is CONFIRMED or SHIPPED",
      );
    }

    const nextTrackingUrl =
      input.trackingUrl !== undefined ? input.trackingUrl : shipment.trackingUrl;
    const shouldBook =
      Boolean(nextTrackingUrl) &&
      (shipment.status === ShipmentStatus.CREATED ||
        shipment.status === ShipmentStatus.BOOKED);

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      await shipmentRepo.updateTracking({
        orderId,
        carrier: input.carrier,
        awbNumber: input.awbNumber,
        trackingUrl: input.trackingUrl,
        ...(shouldBook && nextTrackingUrl
          ? {
              status: ShipmentStatus.BOOKED,
              bookedAt: shipment.bookedAt ?? new Date(),
            }
          : {}),
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.TRACKING_UPDATED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          carrier: input.carrier,
          awbNumber: input.awbNumber,
          trackingUrl: input.trackingUrl,
          processedByRole: role,
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }
      return toOrderDetailDto(detail);
    });
  }

  async uploadHandoverProof(
    actorUserId: string,
    orderId: string,
    file: Express.Multer.File | undefined,
  ): Promise<OrderDetailDto> {
    if (!file) {
      throw new ValidationError("Validation failed", [
        { field: "file", message: "Proof image file is required" },
      ]);
    }

    const sellerId = await this.resolveSellerId(actorUserId);
    const order = await this.getSellerOrderOrThrow(orderId, sellerId);
    const shipment = requireShipment(order);

    if (
      shipment.method !== FulfillmentMethod.INTERNAL_DP &&
      shipment.method !== FulfillmentMethod.THIRD_PARTY
    ) {
      throw new ConflictError(
        "Handover proof applies only to INTERNAL_DP or THIRD_PARTY fulfillment",
      );
    }

    if (order.orderStatus !== OrderStatus.CONFIRMED) {
      throw new ConflictError(
        "Handover proof can only be uploaded while order is confirmed",
      );
    }

    const existing = order.proofs.some(
      (proof) => proof.proofType === ProofType.HANDOVER,
    );
    if (existing) {
      throw new ConflictError("Handover proof already uploaded for this order");
    }

    const input = await this.storeHandoverProofFile(actorUserId, file);

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked || locked.sellerId !== sellerId) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== OrderStatus.CONFIRMED) {
        throw new ConflictError("Order status has changed");
      }

      const duplicate = await proofRepo.existsByOrderIdAndType(
        orderId,
        ProofType.HANDOVER,
      );
      if (duplicate) {
        throw new ConflictError("Handover proof already uploaded for this order");
      }

      await proofRepo.create({
        orderId,
        proofType: ProofType.HANDOVER,
        fileUploadId: input.fileUploadId,
        fileUrl: input.fileUrl,
        uploadedBy: actorUserId,
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.HANDOVER_PROOF_UPLOADED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          proofType: ProofType.HANDOVER,
          fileUploadId: input.fileUploadId,
          fileUrl: input.fileUrl,
        },
      });

      const detail = await orderRepo.findDetailByIdForSeller(orderId, sellerId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      return toOrderDetailDto(detail);
    });
  }

  async markShipped(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    file?: Express.Multer.File,
  ): Promise<OrderDetailDto> {
    const order = await this.getOrderForSellerOrAdmin(actorUserId, role, orderId);
    const shipment = requireShipment(order);

    const from = order.orderStatus;
    const to = OrderStatus.SHIPPED;
    assertTransition(from, to);

    if (shipment.method === FulfillmentMethod.INTERNAL_DP) {
      return this.markShippedInternalDp(actorUserId, role, order, file);
    }

    return this.markShippedThirdParty(actorUserId, role, order, file);
  }

  /** @deprecated Prefer markShipped — kept as alias for INTERNAL_DP OFD path. */
  async markOutForDelivery(
    actorUserId: string,
    orderId: string,
    file?: Express.Multer.File,
  ): Promise<OrderDetailDto> {
    return this.markShipped(actorUserId, UserRole.SELLER, orderId, file);
  }

  private async markShippedInternalDp(
    actorUserId: string,
    role: UserRole,
    order: OrderDetailRecord,
    file?: Express.Multer.File,
  ): Promise<OrderDetailDto> {
    const orderId = order.id;
    const from = order.orderStatus;
    const to = OrderStatus.SHIPPED;
    const shipment = requireShipment(order);

    const partnerId =
      shipment.deliveryPartnerId ?? order.deliveryPartnerId;
    if (!partnerId) {
      throw new ValidationError(
        "Delivery partner must be assigned before marking shipped",
      );
    }

    const hasHandoverProof = order.proofs.some(
      (proof) => proof.proofType === ProofType.HANDOVER,
    );
    if (!hasHandoverProof && !file) {
      throw new ValidationError(
        "Handover proof must be uploaded before marking shipped",
      );
    }

    if (file && role === UserRole.ADMIN && !hasHandoverProof) {
      throw new ValidationError(
        "Handover proof must be uploaded by the seller before marking shipped",
      );
    }

    const proofInput =
      file && role === UserRole.SELLER
        ? await this.storeHandoverProofFile(actorUserId, file)
        : undefined;

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (role === UserRole.SELLER) {
        const sellerId = await this.resolveSellerId(actorUserId);
        if (locked.sellerId !== sellerId) {
          throw new NotFoundError("Order not found");
        }
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      if (proofInput) {
        const duplicate = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.HANDOVER,
        );
        if (!duplicate) {
          await proofRepo.create({
            orderId,
            proofType: ProofType.HANDOVER,
            fileUploadId: proofInput.fileUploadId,
            fileUrl: proofInput.fileUrl,
            uploadedBy: actorUserId,
          });
        }
      } else {
        const handoverProof = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.HANDOVER,
        );
        if (!handoverProof) {
          throw new ValidationError(
            "Handover proof must be uploaded before marking shipped",
          );
        }
      }

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await shipmentRepo.markShipped({
        orderId,
        status: ShipmentStatus.OUT_FOR_DELIVERY,
        shippedAt: new Date(),
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          proofType: ProofType.HANDOVER,
          deliveryPartnerId: partnerId,
          fulfillmentMethod: FulfillmentMethod.INTERNAL_DP,
          processedByRole: role,
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }
      return toOrderDetailDto(detail);
    });
  }

  private async markShippedThirdParty(
    actorUserId: string,
    role: UserRole,
    order: OrderDetailRecord,
    file?: Express.Multer.File,
  ): Promise<OrderDetailDto> {
    const orderId = order.id;
    const from = order.orderStatus;
    const to = OrderStatus.SHIPPED;
    const shipment = requireShipment(order);

    const trackingUrl = shipment.trackingUrl;
    if (!trackingUrl) {
      throw new ValidationError(
        "Admin must save tracking details before marking shipped",
      );
    }

    const hasHandoverProof = order.proofs.some(
      (proof) => proof.proofType === ProofType.HANDOVER,
    );
    if (!hasHandoverProof && !file) {
      throw new ValidationError(
        "Handover proof must be uploaded before marking shipped",
      );
    }

    if (file && role === UserRole.ADMIN && !hasHandoverProof) {
      throw new ValidationError(
        "Handover proof must be uploaded by the seller before marking shipped",
      );
    }

    const proofInput =
      file && role === UserRole.SELLER
        ? await this.storeHandoverProofFile(actorUserId, file)
        : undefined;

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (role === UserRole.SELLER) {
        const sellerId = await this.resolveSellerId(actorUserId);
        if (locked.sellerId !== sellerId) {
          throw new NotFoundError("Order not found");
        }
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      if (proofInput) {
        const duplicate = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.HANDOVER,
        );
        if (!duplicate) {
          await proofRepo.create({
            orderId,
            proofType: ProofType.HANDOVER,
            fileUploadId: proofInput.fileUploadId,
            fileUrl: proofInput.fileUrl,
            uploadedBy: actorUserId,
          });
        }
      } else {
        const handoverProof = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.HANDOVER,
        );
        if (!handoverProof) {
          throw new ValidationError(
            "Handover proof must be uploaded before marking shipped",
          );
        }
      }

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await shipmentRepo.markShipped({
        orderId,
        status: ShipmentStatus.IN_TRANSIT,
        shippedAt: new Date(),
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          proofType: ProofType.HANDOVER,
          fulfillmentMethod: FulfillmentMethod.THIRD_PARTY,
          trackingUrl: shipment.trackingUrl,
          processedByRole: role,
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      const orderShippedEvent =
        await orderNotificationContextService.buildOrderShippedEvent(orderId, {
          trackingUrl,
          carrier: shipment.carrier,
          awbNumber: shipment.awbNumber,
        });
      if (orderShippedEvent) {
        notificationDispatcher.emit(orderShippedEvent);
      }

      return toOrderDetailDto(detail);
    });
  }

  async uploadDeliveryProof(
    actorUserId: string,
    orderId: string,
    file: Express.Multer.File | undefined,
  ): Promise<OrderDetailDto> {
    if (!file) {
      throw new ValidationError("Validation failed", [
        { field: "file", message: "Proof image file is required" },
      ]);
    }

    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);
    const order = await this.getDeliveryPartnerOrderOrThrow(
      orderId,
      deliveryPartnerId,
    );
    const shipment = requireShipment(order);

    if (shipment.method !== FulfillmentMethod.INTERNAL_DP) {
      throw new ConflictError(
        "Delivery proof applies only to internal delivery partner fulfillment",
      );
    }

    if (order.orderStatus !== OrderStatus.SHIPPED) {
      throw new ConflictError(
        "Delivery proof can only be uploaded while order is shipped",
      );
    }

    const existing = order.proofs.some(
      (proof) => proof.proofType === ProofType.DELIVERY,
    );
    if (existing) {
      throw new ConflictError("Delivery proof already uploaded for this order");
    }

    const input = await this.storeDeliveryProofFile(actorUserId, file);

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== OrderStatus.SHIPPED) {
        throw new ConflictError("Order status has changed");
      }

      const duplicate = await proofRepo.existsByOrderIdAndType(
        orderId,
        ProofType.DELIVERY,
      );
      if (duplicate) {
        throw new ConflictError("Delivery proof already uploaded for this order");
      }

      await proofRepo.create({
        orderId,
        proofType: ProofType.DELIVERY,
        fileUploadId: input.fileUploadId,
        fileUrl: input.fileUrl,
        uploadedBy: actorUserId,
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.DELIVERY_PROOF_UPLOADED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          proofType: ProofType.DELIVERY,
          fileUploadId: input.fileUploadId,
          fileUrl: input.fileUrl,
        },
      });

      const detail = await orderRepo.findDetailByIdForDeliveryPartner(
        orderId,
        deliveryPartnerId,
      );
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      return toOrderDetailDto(detail, {
        redactBuyerShippingForDeliveryPartner: true,
        redactPricingForDeliveryPartner: true,
      });
    });
  }

  async markDelivered(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    file?: Express.Multer.File,
  ): Promise<OrderDetailDto> {
    if (role === UserRole.DELIVERY_PARTNER) {
      return this.markDeliveredInternalDp(actorUserId, orderId, file);
    }

    if (role === UserRole.ADMIN) {
      const order = await this.orderRepo.findDetailById(orderId);
      if (!order) {
        throw new NotFoundError("Order not found");
      }
      const shipment = requireShipment(order);

      if (shipment.method === FulfillmentMethod.THIRD_PARTY) {
        return this.markDeliveredThirdParty(actorUserId, role, order);
      }

      throw new ForbiddenError(
        "Internal DP delivery must be marked by the assigned delivery partner",
      );
    }

    if (role === UserRole.SELLER) {
      throw new ForbiddenError(
        "Only admin can mark third-party orders as delivered; sellers cannot mark delivery",
      );
    }

    throw new ForbiddenError("Not allowed to mark this order delivered");
  }

  private async markDeliveredInternalDp(
    actorUserId: string,
    orderId: string,
    file?: Express.Multer.File,
  ): Promise<OrderDetailDto> {
    const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);
    const order = await this.getDeliveryPartnerOrderOrThrow(
      orderId,
      deliveryPartnerId,
    );
    requireShipment(order);

    const from = order.orderStatus;
    const to = OrderStatus.PENDING_SETTLEMENT;
    assertTransition(from, to);

    const hasDeliveryProof = order.proofs.some(
      (proof) => proof.proofType === ProofType.DELIVERY,
    );
    if (!hasDeliveryProof && !file) {
      throw new ValidationError(
        "Delivery proof must be uploaded before marking delivered",
      );
    }

    const proofInput = file
      ? await this.storeDeliveryProofFile(actorUserId, file)
      : undefined;

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const proofRepo = new OrderProofRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      if (proofInput) {
        const duplicate = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.DELIVERY,
        );
        if (!duplicate) {
          await proofRepo.create({
            orderId,
            proofType: ProofType.DELIVERY,
            fileUploadId: proofInput.fileUploadId,
            fileUrl: proofInput.fileUrl,
            uploadedBy: actorUserId,
          });
        }
      } else {
        const deliveryProof = await proofRepo.existsByOrderIdAndType(
          orderId,
          ProofType.DELIVERY,
        );
        if (!deliveryProof) {
          throw new ValidationError(
            "Delivery proof must be uploaded before marking delivered",
          );
        }
      }

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await shipmentRepo.markDelivered({
        orderId,
        deliveredAt: new Date(),
      });

      await finalizeOrderEarningsOnDelivery(
        tx,
        orderId,
        locked.sellerId,
        locked.totalAmount,
      );

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          proofType: ProofType.DELIVERY,
          fulfillmentMethod: FulfillmentMethod.INTERNAL_DP,
          processedByRole: UserRole.DELIVERY_PARTNER,
        },
      });

      const detail = await orderRepo.findDetailByIdForDeliveryPartner(
        orderId,
        deliveryPartnerId,
      );
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      const orderDeliveredEvent =
        await orderNotificationContextService.buildOrderDeliveredEvent(orderId);
      if (orderDeliveredEvent) {
        notificationDispatcher.emit(orderDeliveredEvent);
      }

      return toOrderDetailDto(detail, {
        redactBuyerShippingForDeliveryPartner: true,
        redactPricingForDeliveryPartner: true,
      });
    });
  }

  private async markDeliveredThirdParty(
    actorUserId: string,
    role: UserRole,
    order: OrderDetailRecord,
  ): Promise<OrderDetailDto> {
    const orderId = order.id;
    const from = order.orderStatus;
    const to = OrderStatus.PENDING_SETTLEMENT;
    assertTransition(from, to);

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (role === UserRole.SELLER) {
        const sellerId = await this.resolveSellerId(actorUserId);
        if (locked.sellerId !== sellerId) {
          throw new NotFoundError("Order not found");
        }
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await shipmentRepo.markDelivered({
        orderId,
        deliveredAt: new Date(),
      });

      await finalizeOrderEarningsOnDelivery(
        tx,
        orderId,
        locked.sellerId,
        locked.totalAmount,
      );

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          fulfillmentMethod: FulfillmentMethod.THIRD_PARTY,
          processedByRole: role,
        },
      });

      const orderDeliveredEvent =
        await orderNotificationContextService.buildOrderDeliveredEvent(orderId);
      if (orderDeliveredEvent) {
        notificationDispatcher.emit(orderDeliveredEvent);
      }

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }
      return toOrderDetailDto(detail);
    });
  }

  async markDeliveryFailed(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    input: DeliveryFailedInput,
  ): Promise<OrderDetailDto> {
    if (role === UserRole.DELIVERY_PARTNER) {
      const deliveryPartnerId = await this.resolveDeliveryPartnerId(actorUserId);
      const order = await this.getDeliveryPartnerOrderOrThrow(
        orderId,
        deliveryPartnerId,
      );
      const shipment = requireShipment(order);

      if (shipment.method !== FulfillmentMethod.INTERNAL_DP) {
        throw new ConflictError(
          "Delivery partner can only fail internal DP shipments",
        );
      }

      return this.transitionToDeliveryFailed(
        actorUserId,
        role,
        orderId,
        order.orderStatus,
        input.reason ?? null,
      );
    }

    if (role === UserRole.ADMIN) {
      const order = await this.orderRepo.findDetailById(orderId);
      if (!order) {
        throw new NotFoundError("Order not found");
      }
      requireShipment(order);

      return this.transitionToDeliveryFailed(
        actorUserId,
        role,
        orderId,
        order.orderStatus,
        input.reason ?? null,
      );
    }

    if (role === UserRole.SELLER) {
      throw new ForbiddenError(
        "Only admin can mark third-party orders as delivery failed; sellers cannot mark delivery failed",
      );
    }

    throw new ForbiddenError("Not allowed to mark delivery failed");
  }

  private async transitionToDeliveryFailed(
    actorUserId: string,
    role: UserRole,
    orderId: string,
    from: OrderStatus,
    reason: string | null,
  ): Promise<OrderDetailDto> {
    const to = OrderStatus.DELIVERY_FAILED;
    assertTransition(from, to);

    return runInTransaction(async (tx) => {
      const orderRepo = new OrderRepository(tx);
      const shipmentRepo = new ShipmentRepository(tx);

      const locked = await orderRepo.lockById(orderId);
      if (!locked) {
        throw new NotFoundError("Order not found");
      }

      if (locked.orderStatus !== from) {
        throw new ConflictError("Order status has changed");
      }

      assertOrderStatusTransition(from, to);

      const updated = await orderRepo.updateStatus({
        orderId,
        expectedStatus: from,
        nextStatus: to,
      });

      if (updated.count !== 1) {
        throw new ConflictError("Order status update failed");
      }

      await shipmentRepo.markFailed({
        orderId,
        failureReason: reason,
      });

      await recordCommerceAudit(tx, {
        actorUserId,
        action: ORDER_ACTIONS.STATUS_CHANGED,
        entityType: ORDER_AUDIT_ENTITY_TYPE,
        entityId: orderId,
        metadata: {
          previousStatus: from,
          newStatus: to,
          reason,
          processedByRole: role,
        },
      });

      const detail = await orderRepo.findDetailById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found");
      }

      const deliveryFailedEvent =
        await orderNotificationContextService.buildDeliveryFailedEvent(
          orderId,
          reason,
        );
      if (deliveryFailedEvent) {
        notificationDispatcher.emit(deliveryFailedEvent);
      }

      return toOrderDetailDto(detail, {
        redactBuyerShippingForDeliveryPartner:
          role === UserRole.DELIVERY_PARTNER,
        redactPricingForDeliveryPartner: role === UserRole.DELIVERY_PARTNER,
      });
    });
  }
}

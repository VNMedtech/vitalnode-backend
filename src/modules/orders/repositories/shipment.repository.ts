import {
  FulfillmentMethod,
  ShipmentBookingSource,
  ShipmentStatus,
  type Prisma,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const shipmentSelect = {
  id: true,
  orderId: true,
  method: true,
  bookingSource: true,
  status: true,
  deliveryPartnerId: true,
  carrier: true,
  awbNumber: true,
  trackingUrl: true,
  labelUrl: true,
  externalShipmentId: true,
  bookedAt: true,
  shippedAt: true,
  deliveredAt: true,
  failureReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShipmentSelect;

export type ShipmentRecord = Prisma.ShipmentGetPayload<{
  select: typeof shipmentSelect;
}>;

export class ShipmentRepository {
  constructor(private readonly db: DbClient) {}

  findByOrderId(orderId: string) {
    return this.db.shipment.findUnique({
      where: { orderId },
      select: shipmentSelect,
    });
  }

  create(input: {
    orderId: string;
    method: FulfillmentMethod;
    bookingSource?: ShipmentBookingSource | null;
    status?: ShipmentStatus;
  }) {
    return this.db.shipment.create({
      data: {
        orderId: input.orderId,
        method: input.method,
        bookingSource: input.bookingSource ?? null,
        status: input.status ?? ShipmentStatus.CREATED,
      },
      select: shipmentSelect,
    });
  }

  updateMethod(input: {
    orderId: string;
    method: FulfillmentMethod;
    bookingSource: ShipmentBookingSource | null;
    status: ShipmentStatus;
    clearPartner: boolean;
    clearTracking: boolean;
  }) {
    return this.db.shipment.update({
      where: { orderId: input.orderId },
      data: {
        method: input.method,
        bookingSource: input.bookingSource,
        status: input.status,
        ...(input.clearPartner
          ? { deliveryPartnerId: null }
          : {}),
        ...(input.clearTracking
          ? {
              carrier: null,
              awbNumber: null,
              trackingUrl: null,
              labelUrl: null,
              externalShipmentId: null,
              bookedAt: null,
            }
          : {}),
      },
      select: shipmentSelect,
    });
  }

  assignDeliveryPartner(input: {
    orderId: string;
    deliveryPartnerId: string;
    status: ShipmentStatus;
  }) {
    return this.db.shipment.update({
      where: { orderId: input.orderId },
      data: {
        deliveryPartnerId: input.deliveryPartnerId,
        status: input.status,
      },
      select: shipmentSelect,
    });
  }

  updateTracking(input: {
    orderId: string;
    carrier?: string | null;
    awbNumber?: string | null;
    trackingUrl?: string | null;
    status?: ShipmentStatus;
    bookedAt?: Date | null;
  }) {
    return this.db.shipment.update({
      where: { orderId: input.orderId },
      data: {
        ...(input.carrier !== undefined ? { carrier: input.carrier } : {}),
        ...(input.awbNumber !== undefined ? { awbNumber: input.awbNumber } : {}),
        ...(input.trackingUrl !== undefined
          ? { trackingUrl: input.trackingUrl }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.bookedAt !== undefined ? { bookedAt: input.bookedAt } : {}),
      },
      select: shipmentSelect,
    });
  }

  markShipped(input: {
    orderId: string;
    status: ShipmentStatus;
    shippedAt: Date;
  }) {
    return this.db.shipment.update({
      where: { orderId: input.orderId },
      data: {
        status: input.status,
        shippedAt: input.shippedAt,
      },
      select: shipmentSelect,
    });
  }

  markDelivered(input: { orderId: string; deliveredAt: Date }) {
    return this.db.shipment.update({
      where: { orderId: input.orderId },
      data: {
        status: ShipmentStatus.DELIVERED,
        deliveredAt: input.deliveredAt,
      },
      select: shipmentSelect,
    });
  }

  markFailed(input: { orderId: string; failureReason: string | null }) {
    return this.db.shipment.update({
      where: { orderId: input.orderId },
      data: {
        status: ShipmentStatus.FAILED,
        failureReason: input.failureReason,
      },
      select: shipmentSelect,
    });
  }
}

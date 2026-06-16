import { randomUUID } from "node:crypto";
import {
  OrderStatus,
  PaymentStatus,
  type Prisma,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";
import { PENDING_RAZORPAY_ORDER_PREFIX } from "../../payments/constants/payment.constants.js";
import type { OrderSortField } from "../constants/order.constants.js";
import { ORDER_NUMBER_PREFIX } from "../constants/order.constants.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const orderItemSelect = {
  id: true,
  productId: true,
  quantity: true,
  unitPrice: true,
  totalPrice: true,
  productSnapshot: true,
} satisfies Prisma.OrderItemSelect;

const orderSummarySelect = {
  id: true,
  orderNumber: true,
  buyerId: true,
  sellerId: true,
  deliveryPartnerId: true,
  orderStatus: true,
  subtotal: true,
  totalAmount: true,
  placedAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: orderItemSelect,
    orderBy: {
      productId: "asc" as const,
    },
  },
} satisfies Prisma.OrderSelect;

const orderDetailSelect = {
  ...orderSummarySelect,
  shippingAddressSnapshot: true,
  payment: {
    select: {
      id: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      amount: true,
      paymentStatus: true,
      refundStatus: true,
    },
  },
  proofs: {
    select: {
      id: true,
      proofType: true,
      fileUrl: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.OrderSelect;

export type OrderSummaryRecord = Prisma.OrderGetPayload<{
  select: typeof orderSummarySelect;
}>;

export type OrderDetailRecord = Prisma.OrderGetPayload<{
  select: typeof orderDetailSelect;
}>;

export type OrderWithPaymentAndItems = Prisma.OrderGetPayload<{
  select: typeof orderWithPaymentAndItemsSelect;
}>;

const orderWithPaymentAndItemsSelect = {
  id: true,
  orderNumber: true,
  buyerId: true,
  sellerId: true,
  orderStatus: true,
  totalAmount: true,
  placedAt: true,
  payment: {
    select: {
      id: true,
      razorpayOrderId: true,
      razorpayPaymentId: true,
      amount: true,
      paymentStatus: true,
      refundStatus: true,
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      productSnapshot: true,
    },
    orderBy: {
      productId: "asc" as const,
    },
  },
} satisfies Prisma.OrderSelect;

export interface CreateCheckoutOrderInput {
  orderNumber: string;
  buyerId: string;
  sellerId: string;
  shippingAddressSnapshot: Prisma.InputJsonValue;
  subtotal: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  items: Array<{
    productId: string;
    productSnapshot: Prisma.InputJsonValue;
    quantity: number;
    unitPrice: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
  }>;
}

export interface FindOrdersOptions {
  page: number;
  limit: number;
  sortBy: OrderSortField;
  sortOrder: "asc" | "desc";
  status?: OrderStatus;
  search?: string;
  buyerId?: string;
  sellerId?: string;
  deliveryPartnerId?: string;
}

function buildOrderWhere(
  options: Omit<FindOrdersOptions, "page" | "limit" | "sortBy" | "sortOrder">,
): Prisma.OrderWhereInput {
  const { status, search, buyerId, sellerId, deliveryPartnerId } = options;

  return {
    ...(buyerId ? { buyerId } : {}),
    ...(sellerId ? { sellerId } : {}),
    ...(deliveryPartnerId ? { deliveryPartnerId } : {}),
    ...(status ? { orderStatus: status } : {}),
    ...(search
      ? {
          OR: [{ orderNumber: { contains: search, mode: "insensitive" } }],
        }
      : {}),
  };
}

export class OrderRepository {
  constructor(private readonly db: DbClient) {}

  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${ORDER_NUMBER_PREFIX}-${year}`;

    const count = await this.db.order.count({
      where: {
        orderNumber: { startsWith: prefix },
      },
    });

    return `${prefix}${String(count + 1).padStart(6, "0")}`;
  }

  createCheckoutOrder(data: CreateCheckoutOrderInput) {
    return this.db.order.create({
      data: {
        orderNumber: data.orderNumber,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        shippingAddressSnapshot: data.shippingAddressSnapshot,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        subtotal: data.subtotal,
        totalAmount: data.totalAmount,
        items: {
          create: data.items,
        },
        payment: {
          create: {
            razorpayOrderId: `${PENDING_RAZORPAY_ORDER_PREFIX}${randomUUID()}`,
            amount: data.totalAmount,
            paymentStatus: PaymentStatus.PENDING,
          },
        },
      },
      select: {
        id: true,
        orderNumber: true,
        orderStatus: true,
        subtotal: true,
        totalAmount: true,
        payment: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  findByIdWithPaymentAndItems(orderId: string) {
    return this.db.order.findUnique({
      where: { id: orderId },
      select: orderWithPaymentAndItemsSelect,
    });
  }

  findByIdForBuyer(orderId: string, buyerId: string) {
    return this.db.order.findFirst({
      where: { id: orderId, buyerId },
      select: orderWithPaymentAndItemsSelect,
    });
  }

  findPendingPaymentByBuyerId(buyerId: string) {
    return this.db.order.findFirst({
      where: {
        buyerId,
        orderStatus: OrderStatus.PENDING_PAYMENT,
      },
      select: {
        id: true,
        orderNumber: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  findDetailById(orderId: string) {
    return this.db.order.findUnique({
      where: { id: orderId },
      select: orderDetailSelect,
    });
  }

  findDetailByIdForBuyer(orderId: string, buyerId: string) {
    return this.db.order.findFirst({
      where: { id: orderId, buyerId },
      select: orderDetailSelect,
    });
  }

  findDetailByIdForSeller(orderId: string, sellerId: string) {
    return this.db.order.findFirst({
      where: { id: orderId, sellerId },
      select: orderDetailSelect,
    });
  }

  findDetailByIdForDeliveryPartner(
    orderId: string,
    deliveryPartnerId: string,
  ) {
    return this.db.order.findFirst({
      where: { id: orderId, deliveryPartnerId },
      select: orderDetailSelect,
    });
  }

  findManySummaries(options: FindOrdersOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;
    const where = buildOrderWhere(options);

    return this.db.order.findMany({
      where,
      select: orderSummarySelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });
  }

  count(options: Omit<FindOrdersOptions, "page" | "limit" | "sortBy" | "sortOrder">) {
    return this.db.order.count({
      where: buildOrderWhere(options),
    });
  }

  async lockById(orderId: string): Promise<OrderWithPaymentAndItems | null> {
    await this.db.$queryRaw`
      SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE
    `;

    return this.findByIdWithPaymentAndItems(orderId);
  }

  markPlaced(orderId: string, placedAt: Date) {
    return this.db.order.updateMany({
      where: {
        id: orderId,
        orderStatus: OrderStatus.PENDING_PAYMENT,
      },
      data: {
        orderStatus: OrderStatus.PLACED,
        placedAt,
      },
    });
  }

  markRefunded(orderId: string) {
    return this.db.order.updateMany({
      where: {
        id: orderId,
        orderStatus: OrderStatus.CANCELLED,
      },
      data: {
        orderStatus: OrderStatus.REFUNDED,
      },
    });
  }

  updateStatus(input: {
    orderId: string;
    expectedStatus: OrderStatus;
    nextStatus: OrderStatus;
  }) {
    return this.db.order.updateMany({
      where: {
        id: input.orderId,
        orderStatus: input.expectedStatus,
      },
      data: {
        orderStatus: input.nextStatus,
      },
    });
  }

  assignDeliveryPartner(input: {
    orderId: string;
    expectedStatus: OrderStatus;
    nextStatus: OrderStatus;
    deliveryPartnerId: string;
  }) {
    return this.db.order.updateMany({
      where: {
        id: input.orderId,
        orderStatus: input.expectedStatus,
      },
      data: {
        orderStatus: input.nextStatus,
        deliveryPartnerId: input.deliveryPartnerId,
      },
    });
  }

  reassignDeliveryPartner(input: {
    orderId: string;
    expectedStatus: OrderStatus;
    deliveryPartnerId: string;
  }) {
    return this.db.order.updateMany({
      where: {
        id: input.orderId,
        orderStatus: input.expectedStatus,
      },
      data: {
        deliveryPartnerId: input.deliveryPartnerId,
      },
    });
  }
}

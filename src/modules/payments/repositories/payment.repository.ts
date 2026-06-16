import {
  PaymentStatus,
  RefundStatus,
  type Prisma,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

const paymentDetailSelect = {
  id: true,
  orderId: true,
  razorpayOrderId: true,
  razorpayPaymentId: true,
  amount: true,
  paymentStatus: true,
  refundStatus: true,
  createdAt: true,
  updatedAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      buyerId: true,
      orderStatus: true,
      totalAmount: true,
    },
  },
} satisfies Prisma.PaymentSelect;

export type PaymentDetailRecord = Prisma.PaymentGetPayload<{
  select: typeof paymentDetailSelect;
}>;

export class PaymentRepository {
  constructor(private readonly db: DbClient) {}

  findByRazorpayOrderId(razorpayOrderId: string) {
    return this.db.payment.findUnique({
      where: { razorpayOrderId },
      select: paymentDetailSelect,
    });
  }

  findByRazorpayPaymentId(razorpayPaymentId: string) {
    return this.db.payment.findUnique({
      where: { razorpayPaymentId },
      select: paymentDetailSelect,
    });
  }

  findByOrderId(orderId: string) {
    return this.db.payment.findUnique({
      where: { orderId },
      select: paymentDetailSelect,
    });
  }

  async lockById(paymentId: string): Promise<PaymentDetailRecord | null> {
    await this.db.$queryRaw`
      SELECT id FROM "Payment" WHERE id = ${paymentId}::uuid FOR UPDATE
    `;

    return this.db.payment.findUnique({
      where: { id: paymentId },
      select: paymentDetailSelect,
    });
  }

  updateRazorpayOrderId(paymentId: string, razorpayOrderId: string) {
    return this.db.payment.update({
      where: { id: paymentId },
      data: { razorpayOrderId },
      select: paymentDetailSelect,
    });
  }

  markSuccess(input: {
    paymentId: string;
    razorpayPaymentId: string;
  }) {
    return this.db.payment.updateMany({
      where: {
        id: input.paymentId,
        paymentStatus: PaymentStatus.PENDING,
      },
      data: {
        paymentStatus: PaymentStatus.SUCCESS,
        razorpayPaymentId: input.razorpayPaymentId,
      },
    });
  }

  markFailed(paymentId: string) {
    return this.db.payment.updateMany({
      where: {
        id: paymentId,
        paymentStatus: PaymentStatus.PENDING,
      },
      data: {
        paymentStatus: PaymentStatus.FAILED,
      },
    });
  }

  markCapturedFulfillmentFailed(input: {
    paymentId: string;
    razorpayPaymentId: string;
  }) {
    return this.db.payment.updateMany({
      where: {
        id: input.paymentId,
        paymentStatus: PaymentStatus.PENDING,
      },
      data: {
        paymentStatus: PaymentStatus.FAILED,
        razorpayPaymentId: input.razorpayPaymentId,
      },
    });
  }

  markRefundPending(paymentId: string) {
    return this.db.payment.updateMany({
      where: {
        id: paymentId,
        paymentStatus: PaymentStatus.SUCCESS,
        refundStatus: {
          in: [RefundStatus.NOT_APPLICABLE, RefundStatus.FAILED],
        },
      },
      data: {
        refundStatus: RefundStatus.PENDING,
      },
    });
  }

  markRefundSuccess(paymentId: string) {
    return this.db.payment.updateMany({
      where: {
        id: paymentId,
        refundStatus: RefundStatus.PENDING,
      },
      data: {
        refundStatus: RefundStatus.SUCCESS,
      },
    });
  }

  markRefundFailed(paymentId: string) {
    return this.db.payment.updateMany({
      where: {
        id: paymentId,
        refundStatus: RefundStatus.PENDING,
      },
      data: {
        refundStatus: RefundStatus.FAILED,
      },
    });
  }
}

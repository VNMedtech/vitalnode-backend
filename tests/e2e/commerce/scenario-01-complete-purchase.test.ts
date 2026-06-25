import { describe, expect, it } from "vitest";
import { ORDER_ACTIONS } from "../../../src/modules/orders/constants/order.constants.js";
import {
  ORDER_ACTIONS as PAYMENT_ORDER_ACTIONS,
  PAYMENT_ACTIONS,
} from "../../../src/modules/payments/constants/payment.constants.js";
import { getTestPrisma } from "../../utils/db.js";
import {
  browseMarketplaceProduct,
  buildPendingPaymentContext,
  fulfillOrderThroughDelivery,
  registerBuyerWithAddress,
  setupMarketplaceProduct,
  verifyPaymentForOrder,
} from "./helpers.js";
import {
  addressRequest,
  buyerInvoiceRequest,
  cartRequest,
  orderRequest,
  productRequest,
} from "../../utils/request.helpers.js";
import { addressCreationPayload } from "../../fixtures/address.payloads.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 1: Complete Purchase Flow", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("executes buyer registration through delivery with inventory, payment, snapshots, and audit validation", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    // Buyer registration
    const { auth: buyerAuth } = await registerBuyerViaApi(app);
    expect(buyerAuth.user.role).toBe("BUYER");

    // Marketplace setup + product browsing
    const marketplace = await setupMarketplaceProduct(app, prisma);
    await browseMarketplaceProduct(app, marketplace.productId);

    const listRes = await productRequest(app).listMarketplace();
    expect(listRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: marketplace.productId }),
      ]),
    );

    const detailRes = await productRequest(app).getMarketplaceById(
      marketplace.productId,
    );
    expect(detailRes.body.data.productName).toBeTruthy();

    // Address creation
    const addressRes = await addressRequest(app, buyerAuth.accessToken).create(
      addressCreationPayload(),
    );
    expect(addressRes.status).toBe(201);
    const addressId = addressRes.body.data.id as string;

    // Add to cart
    const cartRes = await cartRequest(app, buyerAuth.accessToken).addItem({
      productId: marketplace.productId,
      quantity: 2,
    });
    expect(cartRes.status).toBe(200);
    expect(cartRes.body.data.items).toHaveLength(1);

    const inventoryBefore = await prisma.inventory.findUnique({
      where: { productId: marketplace.productId },
    });
    expect(inventoryBefore?.availableQuantity).toBe(50);

    // Checkout → order creation (pending payment)
    const checkoutRes = await orderRequest(app, buyerAuth.accessToken).checkout(
      { shippingAddressId: addressId },
      `e2e-checkout-${Date.now()}`,
    );
    expect(checkoutRes.status).toBe(201);
    const orderId = checkoutRes.body.data.orderId as string;

    let order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    expect(order.orderStatus).toBe("PENDING_PAYMENT");
    expect(order.payment?.paymentStatus).toBe("PENDING");

    // Snapshots at checkout
    const orderItem = order.items[0]!;
    const productSnapshot = orderItem.productSnapshot as Record<string, unknown>;
    expect(productSnapshot.id).toBe(marketplace.productId);
    expect(productSnapshot.productName).toBeTruthy();

    const addressSnapshot = order.shippingAddressSnapshot as Record<
      string,
      unknown
    >;
    expect(addressSnapshot.city).toBe("Mumbai");
    expect(addressSnapshot.postalCode).toBe("400001");

    // Payment verification → order placed
    const payment = await verifyPaymentForOrder(
      app,
      buyerAuth.accessToken,
      orderId,
    );
    expect(payment.verifyRes.status).toBe(200);
    expect(payment.verifyRes.body.data.orderStatus).toBe("PLACED");

    order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    expect(order.orderStatus).toBe("PLACED");
    expect(order.payment?.paymentStatus).toBe("SUCCESS");
    expect(order.payment?.razorpayPaymentId).toBe(payment.razorpayPaymentId);

    // Invoice generated for paid order
    const invoice = await prisma.invoice.findUnique({
      where: { orderId },
    });
    expect(invoice).not.toBeNull();
    expect(invoice?.invoiceNumber).toMatch(/^VN-INV-\d{8}-\d{6}$/);
    expect(invoice?.pdfUrl).toContain("invoices/");

    const invoiceRes = await buyerInvoiceRequest(
      app,
      buyerAuth.accessToken,
    ).getByOrderId(orderId);
    expect(invoiceRes.status).toBe(200);
    expect(invoiceRes.body.data.paymentStatus).toBe("PAID");
    expect(invoiceRes.body.data.downloadUrl).toContain("https://");

    // Inventory deducted on payment
    const inventoryAfterPayment = await prisma.inventory.findUnique({
      where: { productId: marketplace.productId },
    });
    expect(inventoryAfterPayment?.availableQuantity).toBe(48);

    const deduction = await prisma.inventoryMovement.findFirst({
      where: {
        referenceId: orderId,
        movementType: "ORDER_DEDUCTION",
      },
    });
    expect(deduction?.quantityChanged).toBe(-2);

    // Processing → out for delivery → delivered
    await fulfillOrderThroughDelivery(
      app,
      {
        orderId,
        adminToken: marketplace.adminToken,
        sellerToken: marketplace.sellerToken,
      },
      prisma,
    );

    order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    expect(order.orderStatus).toBe("PENDING_SETTLEMENT");

    // Audit logs across lifecycle
    const placedAudit = await prisma.auditLog.findFirst({
      where: { action: PAYMENT_ORDER_ACTIONS.PLACED, entityId: orderId },
    });
    expect(placedAudit).not.toBeNull();

    const paymentAudit = await prisma.auditLog.findFirst({
      where: {
        action: PAYMENT_ACTIONS.SUCCESS,
        entityId: order.payment!.id,
      },
    });
    expect(paymentAudit).not.toBeNull();

    const statusAudits = await prisma.auditLog.findMany({
      where: { action: ORDER_ACTIONS.STATUS_CHANGED, entityId: orderId },
    });
    const statuses = statusAudits.map(
      (a) => (a.metadata as Record<string, unknown>)?.newStatus,
    );
    expect(statuses).toEqual(
      expect.arrayContaining(["PROCESSING", "OUT_FOR_DELIVERY", "PENDING_SETTLEMENT"]),
    );

    const inventoryAudit = await prisma.auditLog.findFirst({
      where: { action: "INVENTORY_DEDUCTED" },
    });
    expect(inventoryAudit).not.toBeNull();
  });
});

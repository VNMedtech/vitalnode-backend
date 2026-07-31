import { describe, expect, it } from "vitest";
import { NOTIFICATION_TYPES } from "../../../src/modules/notifications/constants/notification.constants.js";
import {
  ORDER_PROOF_FILE,
  setupAssignedOrder,
  setupOutForDeliveryOrder,
} from "../../factories/order.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { orderRequest } from "../../utils/request.helpers.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { useOrdersTestLifecycle } from "./setup.js";

async function waitForNotification(
  prisma: ReturnType<typeof getTestPrisma>,
  userId: string,
  type: string,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const notification = await prisma.notification.findFirst({
      where: { userId, type },
      orderBy: { createdAt: "desc" },
    });
    if (notification) {
      return notification;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

describe("Orders — Section 5: Delivery Actions", () => {
  const { getApp } = useOrdersTestLifecycle();

  it("lists orders assigned to the delivery partner", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: context.orderId },
      select: { shippingAddressSnapshot: true },
    });
    const snapshot = order.shippingAddressSnapshot as { name: string };

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).listAssigned();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: context.orderId,
          customerName: snapshot.name,
        }),
      ]),
    );
  });

  it("hides customerName on assigned list before SHIPPED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).listAssigned();

    expect(res.status).toBe(200);
    const row = res.body.data.find(
      (item: { id: string }) => item.id === context.orderId,
    );
    expect(row).toEqual(
      expect.objectContaining({
        id: context.orderId,
        orderStatus: "CONFIRMED",
        customerName: null,
      }),
    );
  });

  it("shows seller pickup contact and hides customer shipping before SHIPPED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupAssignedOrder(app, prisma);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: context.orderId },
      select: {
        pickupAddressSnapshot: true,
        seller: {
          select: {
            id: true,
            businessName: true,
            contactPerson: true,
            addressLine1: true,
            city: true,
            state: true,
            postalCode: true,
            user: { select: { phoneNumber: true } },
          },
        },
      },
    });
    const seller = order.seller;
    const pickup = order.pickupAddressSnapshot as {
      id: string;
      label: string;
      addressLine1: string;
      city: string;
    };

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).getById(context.orderId);

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.shippingAddressSnapshot).toBeNull();
    expect(res.body.data.customerName).toBeNull();
    expect(res.body.data.pickupAddressSnapshot).toEqual(
      expect.objectContaining({
        id: pickup.id,
        label: pickup.label,
        addressLine1: pickup.addressLine1,
        city: pickup.city,
      }),
    );
    expect(res.body.data.seller).toEqual(
      expect.objectContaining({
        id: seller.id,
        businessName: seller.businessName,
        contactPerson: seller.contactPerson,
        phoneNumber: seller.user.phoneNumber,
      }),
    );
  });

  it("reveals customer shipping to delivery partner once SHIPPED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: context.orderId },
      select: { shippingAddressSnapshot: true },
    });
    const snapshot = order.shippingAddressSnapshot as {
      name: string;
      phone: string;
      addressLine1: string;
    };

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).getById(context.orderId);

    expect(res.status).toBe(200);
    expect(res.body.data.customerName).toBe(snapshot.name);
    expect(res.body.data.shippingAddressSnapshot).toEqual(
      expect.objectContaining({
        name: snapshot.name,
        phone: snapshot.phone,
        addressLine1: snapshot.addressLine1,
      }),
    );
    expect(res.body.data.seller).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        businessName: expect.any(String),
        addressLine1: expect.any(String),
      }),
    );
    expect(res.body.data.seller).toHaveProperty("phoneNumber");
  });

  it("uploads delivery proof while order is SHIPPED", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);

    expect(res.status).toBe(200);
    expect(res.body.data.proofs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ proofType: "DELIVERY" }),
      ]),
    );

    const proof = await prisma.orderProof.findFirst({
      where: { orderId: context.orderId, proofType: "DELIVERY" },
    });
    expect(proof).not.toBeNull();
  });

  it("marks order as delivered after delivery proof", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    const context = await setupOutForDeliveryOrder(app, prisma);

    await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);

    const res = await orderRequest(
      app,
      context.deliveryPartner.deliveryPartnerToken,
    ).markDelivered(context.orderId);

    expect(res.status).toBe(200);
    expect(res.body.data.orderStatus).toBe("PENDING_SETTLEMENT");

    const order = await prisma.order.findUnique({
      where: { id: context.orderId },
    });
    expect(order?.orderStatus).toBe("PENDING_SETTLEMENT");

    const partnerNotification = await waitForNotification(
      prisma,
      context.deliveryPartner.deliveryPartnerUserId,
      NOTIFICATION_TYPES.ORDER_DELIVERED,
    );
    expect(partnerNotification).not.toBeNull();
    expect(partnerNotification?.title).toBe("Delivery completed");
    expect(partnerNotification?.message).toContain(order?.orderNumber ?? "");
  });

  it("does not list orders for unassigned delivery partners", async () => {
    const app = getApp();
    const prisma = getTestPrisma();
    await setupOutForDeliveryOrder(app, prisma);
    const otherBuyer = await registerBuyerViaApi(app);

    const res = await orderRequest(app, otherBuyer.auth.accessToken).listAssigned();

    expect(res.status).toBe(403);
  });
});

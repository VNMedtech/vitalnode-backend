/**
 * Account disable/enable workflow audit — validates business rules across
 * seller, delivery partner, buyer, admin, orders, products, cart, payments,
 * settlements, inventory, and authentication modules.
 */
import { describe, expect, it } from "vitest";
import { SELLER_ACTIONS } from "../../../src/modules/sellers/constants/seller.constants.js";
import { ADMIN_USER_ACTIONS } from "../../../src/modules/admin/constants/adminUser.constants.js";
import { DELIVERY_PARTNER_ACTIONS } from "../../../src/modules/deliveryPartners/constants/deliveryPartner.constants.js";
import { setupMarketplaceProduct } from "../../factories/commerce.factory.js";
import { productCreationPayload } from "../../fixtures/product.payloads.js";
import {
  ORDER_PROOF_FILE,
  setupAssignedOrder,
  setupOrderTestContext,
  setupOutForDeliveryOrder,
} from "../../factories/order.factory.js";
import { DEFAULT_PASSWORD } from "../../fixtures/auth.payloads.js";
import {
  createAdminViaApi,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import {
  adminUserRequest,
  authRequest,
  cartRequest,
  deliveryPartnerRequest,
  inventoryRequest,
  orderRequest,
  productRequest,
  sellerRequest,
  userRequest,
} from "../../utils/request.helpers.js";
import {
  checkoutCart,
  expectProductAbsentFromMarketplace,
  getSellerProfileId,
  prepareBuyerCart,
  registerBuyerWithAddress,
  verifyPaymentForOrder,
} from "./helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

async function waitForAuditLog(
  prisma: ReturnType<typeof getTestPrisma>,
  action: string,
  entityId: string,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const log = await prisma.auditLog.findFirst({
      where: { action, entityId },
    });
    if (log) {
      return log;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

describe("Account Disable/Enable — QA Audit", () => {
  const { getApp } = useCommerceE2ELifecycle();

  // -------------------------------------------------------------------------
  // SECTION 1 — Seller Disable Tests
  // -------------------------------------------------------------------------
  describe("Section 1 — Seller Disable", () => {
    it("blocks seller login after admin disable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const marketplace = await setupMarketplaceProduct(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        marketplace.sellerUserId,
      );

      const disableRes = await sellerRequest(app, marketplace.adminToken).disable(
        sellerProfileId,
        { reason: "Compliance audit" },
      );
      expect(disableRes.status).toBe(200);
      expect(disableRes.body.data.approvalStatus).toBe("DISABLED");

      const sellerUser = await prisma.user.findUniqueOrThrow({
        where: { id: marketplace.sellerUserId },
        select: { email: true },
      });

      const loginRes = await authRequest(app).login({
        email: sellerUser.email,
        password: DEFAULT_PASSWORD,
      });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.message).toMatch(/disabled/i);
    });

    it("hides seller products from marketplace and blocks cart/checkout", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const marketplace = await setupMarketplaceProduct(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        marketplace.sellerUserId,
      );

      await sellerRequest(app, marketplace.adminToken).disable(sellerProfileId, {
        reason: "Suspended",
      });

      const listRes = await productRequest(app).listMarketplace();
      expectProductAbsentFromMarketplace(listRes.body.data, marketplace.productId);

      const detailRes = await productRequest(app).getMarketplaceById(
        marketplace.productId,
      );
      expect(detailRes.status).toBe(404);

      const buyer = await registerBuyerWithAddress(app);
      const cartRes = await cartRequest(app, buyer.buyerToken).addItem({
        productId: marketplace.productId,
        quantity: 1,
      });
      expect(cartRes.status).toBeGreaterThanOrEqual(400);

      const checkoutRes = await orderRequest(app, buyer.buyerToken).checkout(
        { shippingAddressId: buyer.addressId },
        newIdempotencyKey("disabled-seller-checkout"),
      );
      expect(checkoutRes.status).toBeGreaterThanOrEqual(400);
    });

    it("blocks disabled seller from creating and editing products", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const marketplace = await setupMarketplaceProduct(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        marketplace.sellerUserId,
      );

      await sellerRequest(app, marketplace.adminToken).disable(sellerProfileId);

      const createRes = await productRequest(app, marketplace.sellerToken).create(
        productCreationPayload(marketplace.categoryId),
      );
      expect(createRes.status).toBe(403);

      const updateRes = await productRequest(app, marketplace.sellerToken).update(
        marketplace.productId,
        { productName: "Should Not Update" },
      );
      expect(updateRes.status).toBe(403);
    });

    it("blocks new delivery assignment to disabled seller orders in PLACED state", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupOrderTestContext(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        context.sellerUserId,
      );

      const partnerRes = await deliveryPartnerRequest(
        app,
        context.adminToken,
      ).create({
        email: `dp-audit-${Date.now()}@logistics.example`,
        firstName: "Audit",
        lastName: "Partner",
        phoneNumber: "+919876543210",
        addressLine1: "1 Route Way",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India",
        postalCode: "400001",
      });
      expect(partnerRes.status).toBe(201);
      const partnerId = partnerRes.body.data.deliveryPartner.id as string;

      await sellerRequest(app, context.adminToken).disable(sellerProfileId);

      const assignRes = await orderRequest(
        app,
        context.adminToken,
      ).assignDeliveryPartner(context.orderId, {
        deliveryPartnerId: partnerId,
      });
      expect(assignRes.status).toBeGreaterThanOrEqual(400);
    });

    it("preserves existing order access for buyer and allows seller order fulfillment", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupAssignedOrder(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        context.sellerUserId,
      );

      await sellerRequest(app, context.adminToken).disable(sellerProfileId, {
        reason: "Mid-fulfillment audit",
      });

      const buyerOrderRes = await orderRequest(
        app,
        context.buyerAuth.accessToken,
      ).getById(context.orderId);
      expect(buyerOrderRes.status).toBe(200);
      expect(buyerOrderRes.body.data.orderStatus).toBe("ASSIGNED_DELIVERY_PARTNER");

      const sellerProcessRes = await orderRequest(
        app,
        context.sellerToken,
      ).process(context.orderId);
      expect(sellerProcessRes.status).toBe(200);
      expect(sellerProcessRes.body.data.orderStatus).toBe("PROCESSING");
    });

    it("allows admin settlement for orders delivered before seller disable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupOutForDeliveryOrder(app, prisma);

      await orderRequest(
        app,
        context.deliveryPartner.deliveryPartnerToken,
      ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);

      await orderRequest(
        app,
        context.deliveryPartner.deliveryPartnerToken,
      ).markDelivered(context.orderId);

      const sellerProfileId = await getSellerProfileId(
        prisma,
        context.sellerUserId,
      );
      await sellerRequest(app, context.adminToken).disable(sellerProfileId);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: context.orderId },
      });
      expect(order.orderStatus).toBe("PENDING_SETTLEMENT");

      const paymentCount = await prisma.payment.count({
        where: { orderId: context.orderId },
      });
      expect(paymentCount).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 2 — Delivery Partner Disable Tests
  // -------------------------------------------------------------------------
  describe("Section 2 — Delivery Partner Disable", () => {
    it("blocks delivery partner login after disable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      const createRes = await deliveryPartnerRequest(
        app,
        adminLogin.auth.accessToken,
      ).create({
        email: `dp-login-audit-${Date.now()}@logistics.example`,
        firstName: "Route",
        lastName: "Runner",
        phoneNumber: "+919876543211",
        addressLine1: "2 Fleet Lane",
        city: "Delhi",
        state: "Delhi",
        country: "India",
        postalCode: "110001",
      });
      expect(createRes.status).toBe(201);
      const partnerId = createRes.body.data.deliveryPartner.id as string;
      const tempPassword = createRes.body.data.temporaryPassword as string;
      const email = createRes.body.data.deliveryPartner.user.email as string;

      await deliveryPartnerRequest(app, adminLogin.auth.accessToken).disable(
        partnerId,
        { reason: "Off roster" },
      );

      const loginRes = await authRequest(app).login({
        email,
        password: tempPassword,
      });
      expect(loginRes.status).toBe(403);
      expect(loginRes.body.message).toMatch(/disabled/i);
    });

    it("blocks new delivery assignment to disabled partner", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupOrderTestContext(app, prisma);
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      const createRes = await deliveryPartnerRequest(
        app,
        adminLogin.auth.accessToken,
      ).create({
        email: `dp-assign-audit-${Date.now()}@logistics.example`,
        firstName: "Blocked",
        lastName: "Courier",
        phoneNumber: "+919876543212",
        addressLine1: "3 Depot Rd",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        postalCode: "411001",
      });
      const partnerId = createRes.body.data.deliveryPartner.id as string;

      await deliveryPartnerRequest(app, adminLogin.auth.accessToken).disable(
        partnerId,
      );

      const assignRes = await orderRequest(
        app,
        context.adminToken,
      ).assignDeliveryPartner(context.orderId, {
        deliveryPartnerId: partnerId,
      });
      expect(assignRes.status).toBeGreaterThanOrEqual(400);
      expect(assignRes.body.message).toMatch(/not active/i);
    });

    it("allows disabled partner to complete an already-assigned delivery", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupOutForDeliveryOrder(app, prisma);

      await deliveryPartnerRequest(app, context.adminToken).disable(
        context.deliveryPartner.deliveryPartnerId,
        { reason: "End of shift" },
      );

      const listRes = await orderRequest(
        app,
        context.deliveryPartner.deliveryPartnerToken,
      ).listAssigned();
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some(
        (o: { id: string }) => o.id === context.orderId,
      )).toBe(true);

      const proofRes = await orderRequest(
        app,
        context.deliveryPartner.deliveryPartnerToken,
      ).uploadDeliveryProof(context.orderId, ORDER_PROOF_FILE);
      expect(proofRes.status).toBe(200);

      const deliveredRes = await orderRequest(
        app,
        context.deliveryPartner.deliveryPartnerToken,
      ).markDelivered(context.orderId);
      expect(deliveredRes.status).toBe(200);
      expect(deliveredRes.body.data.orderStatus).toBe("PENDING_SETTLEMENT");
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 3 — Buyer Disable Tests
  // -------------------------------------------------------------------------
  describe("Section 3 — Buyer Disable", () => {
    it("blocks buyer login and new checkout after admin disable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const marketplace = await setupMarketplaceProduct(app, prisma);
      const buyer = await registerBuyerViaApi(app);
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      await adminUserRequest(app, adminLogin.auth.accessToken).disable(
        buyer.auth.user.id,
        { reason: "Policy" },
      );

      const loginRes = await authRequest(app).login({
        email: buyer.auth.user.email,
        password: DEFAULT_PASSWORD,
      });
      expect(loginRes.status).toBe(403);

      const checkoutRes = await orderRequest(app, buyer.auth.accessToken).checkout(
        { shippingAddressId: "550e8400-e29b-41d4-a716-446655440000" },
        newIdempotencyKey("disabled-buyer-checkout"),
      );
      expect(checkoutRes.status).toBe(403);
    });

    it("preserves buyer historical order and payment records in database", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupOrderTestContext(app, prisma);
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      await adminUserRequest(app, adminLogin.auth.accessToken).disable(
        context.buyerAuth.user.id,
      );

      const order = await prisma.order.findUnique({
        where: { id: context.orderId },
      });
      expect(order).not.toBeNull();
      expect(order?.buyerId).toBeTruthy();

      const payments = await prisma.payment.count({
        where: { orderId: context.orderId },
      });
      expect(payments).toBeGreaterThan(0);

      const adminDetail = await adminUserRequest(
        app,
        adminLogin.auth.accessToken,
      ).getById(context.buyerAuth.user.id);
      expect(adminDetail.status).toBe(200);
      expect(adminDetail.body.data.ordersCount).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 4 — Re-enable Tests
  // -------------------------------------------------------------------------
  describe("Section 4 — Re-enable", () => {
    it("restores seller login, marketplace visibility, and ordering", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const marketplace = await setupMarketplaceProduct(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        marketplace.sellerUserId,
      );

      await sellerRequest(app, marketplace.adminToken).disable(sellerProfileId);
      await sellerRequest(app, marketplace.adminToken).enable(sellerProfileId);

      const sellerUser = await prisma.user.findUniqueOrThrow({
        where: { id: marketplace.sellerUserId },
        select: { email: true },
      });
      const loginRes = await authRequest(app).login({
        email: sellerUser.email,
        password: DEFAULT_PASSWORD,
      });
      expect(loginRes.status).toBe(200);

      const listRes = await productRequest(app).listMarketplace();
      expect(
        listRes.body.data.some(
          (p: { id: string }) => p.id === marketplace.productId,
        ),
      ).toBe(true);

      const buyer = await prepareBuyerCart(app, marketplace.productId, 1);
      const checkout = await checkoutCart(
        app,
        buyer.buyerToken,
        buyer.addressId,
      );
      expect(checkout.orderId).toBeTruthy();
    });

    it("restores buyer login after enable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const buyer = await registerBuyerViaApi(app);
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      await adminUserRequest(app, adminLogin.auth.accessToken).disable(
        buyer.auth.user.id,
      );
      await adminUserRequest(app, adminLogin.auth.accessToken).enable(
        buyer.auth.user.id,
      );

      const loginRes = await authRequest(app).login({
        email: buyer.auth.user.email,
        password: DEFAULT_PASSWORD,
      });
      expect(loginRes.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 5 — Data Integrity Tests
  // -------------------------------------------------------------------------
  describe("Section 5 — Data Integrity", () => {
    it("preserves orders, payments, audit logs, and inventory after seller disable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupOrderTestContext(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        context.sellerUserId,
      );

      const inventoryBefore = await prisma.inventory.findFirst({
        where: { productId: context.productId },
      });
      const auditBefore = await prisma.auditLog.count({
        where: { entityId: context.orderId },
      });
      const paymentBefore = await prisma.payment.count({
        where: { orderId: context.orderId },
      });

      await sellerRequest(app, context.adminToken).disable(sellerProfileId);

      const orderAfter = await prisma.order.findUnique({
        where: { id: context.orderId },
      });
      expect(orderAfter).not.toBeNull();

      const paymentAfter = await prisma.payment.count({
        where: { orderId: context.orderId },
      });
      expect(paymentAfter).toBe(paymentBefore);

      const auditAfter = await prisma.auditLog.count({
        where: { entityId: context.orderId },
      });
      expect(auditAfter).toBeGreaterThanOrEqual(auditBefore);

      const disableAudit = await prisma.auditLog.findFirst({
        where: {
          action: SELLER_ACTIONS.DISABLE,
          entityId: sellerProfileId,
        },
      });
      expect(disableAudit).not.toBeNull();

      const inventoryAfter = await prisma.inventory.findFirst({
        where: { productId: context.productId },
      });
      expect(inventoryAfter?.availableQuantity).toBe(
        inventoryBefore?.availableQuantity,
      );
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 6 — Security Tests
  // -------------------------------------------------------------------------
  describe("Section 6 — Security", () => {
    it("invalidates buyer JWT and refresh token after admin disable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const buyer = await registerBuyerViaApi(app);
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      await adminUserRequest(app, adminLogin.auth.accessToken).disable(
        buyer.auth.user.id,
      );

      const profileRes = await userRequest(app, buyer.auth.accessToken).getProfile();
      expect(profileRes.status).toBe(403);

      const refreshRes = await authRequest(app).refreshToken(
        buyer.auth.refreshToken,
      );
      expect([401, 403]).toContain(refreshRes.status);

      const sessions = await prisma.authSession.findMany({
        where: { userId: buyer.auth.user.id, revokedAt: { not: null } },
      });
      expect(sessions.length).toBeGreaterThan(0);
    });

    it("revokes seller sessions and blocks JWT after seller disable", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const marketplace = await setupMarketplaceProduct(app, prisma);
      const sellerProfileId = await getSellerProfileId(
        prisma,
        marketplace.sellerUserId,
      );

      await sellerRequest(app, marketplace.adminToken).disable(sellerProfileId);

      const profileRes = await userRequest(
        app,
        marketplace.sellerToken,
      ).getProfile();
      expect(profileRes.status).toBe(403);

      const sessions = await prisma.authSession.findMany({
        where: {
          userId: marketplace.sellerUserId,
          revokedAt: { not: null },
        },
      });
      expect(sessions.length).toBeGreaterThan(0);
    });

    it("revokes delivery partner refresh sessions while preserving in-flight fulfillment access", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const context = await setupOutForDeliveryOrder(app, prisma);

      await deliveryPartnerRequest(app, context.adminToken).disable(
        context.deliveryPartner.deliveryPartnerId,
      );

      const listRes = await orderRequest(
        app,
        context.deliveryPartner.deliveryPartnerToken,
      ).listAssigned();
      expect(listRes.status).toBe(200);

      const sessions = await prisma.authSession.findMany({
        where: {
          userId: context.deliveryPartner.deliveryPartnerUserId,
          revokedAt: { not: null },
        },
      });
      expect(sessions.length).toBeGreaterThan(0);
    });

    it("prevents disabling the last active admin (or any admin via user management)", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const { login: adminLogin, user: adminUser } = await createAdminViaApi(
        app,
        prisma,
      );

      const activeAdminCount = await prisma.user.count({
        where: {
          role: "ADMIN",
          status: "ACTIVE",
          deletedAt: null,
        },
      });
      expect(activeAdminCount).toBeGreaterThanOrEqual(1);

      const disableRes = await adminUserRequest(
        app,
        adminLogin.auth.accessToken,
      ).disable(adminUser.id);
      expect(disableRes.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // SECTION 7 — Admin audit trail on disable/enable
  // -------------------------------------------------------------------------
  describe("Section 7 — Audit Trail Completeness", () => {
    it("records admin user disable audit entry", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const buyer = await registerBuyerViaApi(app);
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      await adminUserRequest(app, adminLogin.auth.accessToken).disable(
        buyer.auth.user.id,
        { reason: "Audit trail test" },
      );

      const log = await prisma.auditLog.findFirst({
        where: {
          action: ADMIN_USER_ACTIONS.DISABLE,
          entityId: buyer.auth.user.id,
        },
      });
      expect(log).not.toBeNull();
    });

    it("records delivery partner disable audit entry", async () => {
      const app = getApp();
      const prisma = getTestPrisma();
      const { login: adminLogin } = await createAdminViaApi(app, prisma);

      const createRes = await deliveryPartnerRequest(
        app,
        adminLogin.auth.accessToken,
      ).create({
        email: `dp-audit-trail-${Date.now()}@logistics.example`,
        firstName: "Trail",
        lastName: "Partner",
        phoneNumber: "+919876543213",
        addressLine1: "4 Audit Ave",
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        postalCode: "600001",
      });
      const partnerId = createRes.body.data.deliveryPartner.id as string;

      await deliveryPartnerRequest(app, adminLogin.auth.accessToken).disable(
        partnerId,
      );

      const log = await waitForAuditLog(
        prisma,
        DELIVERY_PARTNER_ACTIONS.DISABLE,
        partnerId,
      );
      expect(log).not.toBeNull();
    });
  });
});

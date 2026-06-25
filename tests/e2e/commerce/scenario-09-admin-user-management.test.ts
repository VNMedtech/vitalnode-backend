import { describe, expect, it } from "vitest";
import { ADMIN_USER_ACTIONS } from "../../../src/modules/admin/constants/adminUser.constants.js";
import {
  createAdminViaApi,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import { DEFAULT_PASSWORD } from "../../fixtures/auth.payloads.js";
import { setupMarketplaceProduct } from "./helpers.js";
import {
  addressCreationPayload,
} from "../../fixtures/address.payloads.js";
import {
  addressRequest,
  adminUserRequest,
  authRequest,
  cartRequest,
  orderRequest,
} from "../../utils/request.helpers.js";
import { getTestPrisma } from "../../utils/db.js";
import { newIdempotencyKey } from "../../utils/payment.helpers.js";
import { useCommerceE2ELifecycle } from "./setup.js";

describe("E2E Commerce — Scenario 9: Admin User Management", () => {
  const { getApp } = useCommerceE2ELifecycle();

  it("admin lists users, disables buyer after order, buyer cannot checkout but order remains visible to admin", async () => {
    const app = getApp();
    const prisma = getTestPrisma();

    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app);
    const marketplace = await setupMarketplaceProduct(app, prisma);

    const addressRes = await addressRequest(app, buyer.auth.accessToken).create(
      addressCreationPayload(),
    );
    const addressId = addressRes.body.data.id as string;

    await cartRequest(app, buyer.auth.accessToken).addItem({
      productId: marketplace.productId,
      quantity: 1,
    });

    const checkoutRes = await orderRequest(app, buyer.auth.accessToken).checkout(
      { shippingAddressId: addressId },
      newIdempotencyKey(),
    );
    expect(checkoutRes.status).toBe(201);
    const orderId = checkoutRes.body.data.orderId as string;

    const listBefore = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ role: "BUYER", search: buyer.auth.user.email });
    expect(listBefore.status).toBe(200);
    expect(listBefore.body.data[0].status).toBe("ACTIVE");

    const disableRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).disable(buyer.auth.user.id, { reason: "E2E policy test" });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.accountStatus).toBe("DISABLED");

    const loginRes = await authRequest(app).login({
      email: buyer.auth.user.email,
      password: DEFAULT_PASSWORD,
    });
    expect(loginRes.status).toBe(403);

    const checkoutBlocked = await orderRequest(
      app,
      buyer.auth.accessToken,
    ).checkout({ shippingAddressId: addressId }, newIdempotencyKey());
    expect(checkoutBlocked.status).toBe(403);

    const detailRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).getById(buyer.auth.user.id);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.ordersCount).toBeGreaterThanOrEqual(1);

    const activityRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).activity(buyer.auth.user.id);
    expect(activityRes.status).toBe(200);
    expect(
      activityRes.body.data.recentActions.some(
        (entry: { action: string }) => entry.action === ADMIN_USER_ACTIONS.DISABLE,
      ),
    ).toBe(true);

    const adminOrderRes = await orderRequest(
      app,
      adminLogin.auth.accessToken,
    ).getById(orderId);
    expect(adminOrderRes.status).toBe(200);
    expect(adminOrderRes.body.data.id).toBe(orderId);

    const enableRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).enable(buyer.auth.user.id, {});
    expect(enableRes.status).toBe(200);

    const statsRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).stats();
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.totalUsers).toBeGreaterThanOrEqual(2);
  });
});

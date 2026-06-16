import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserStatus } from "../../../src/shared/enums/userStatus.enum.js";
import { DELIVERY_PARTNER_ACTIONS } from "../../../src/modules/deliveryPartners/constants/deliveryPartner.constants.js";
import {
  createAdminViaApi,
  registerBuyerViaApi,
  setUserStatus,
} from "../../factories/user.factory.js";
import {
  authRequest,
  deliveryPartnerRequest,
  userRequest,
} from "../../utils/request.helpers.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { getTestApp } from "../../utils/testApp.js";

const createDeliveryPartnerPayload = (overrides: Record<string, unknown> = {}) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
  email: `dp-${unique}@logistics.example`,
  firstName: "Ravi",
  lastName: "Kumar",
  phoneNumber: `+9198765${unique.replace(/\D/g, "").slice(-5).padStart(5, "0")}`,
  addressLine1: "12 Transport Nagar",
  addressLine2: "Block B",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  postalCode: "400001",
  ...overrides,
};
};

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

describe("Delivery Partners — Admin Management", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("1. creates a delivery partner with temporary password and mustChangePassword", async () => {
    const prisma = getTestPrisma();
    const { user: adminUser, login: adminLogin } = await createAdminViaApi(
      app,
      prisma,
    );
    const payload = createDeliveryPartnerPayload();

    const res = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.temporaryPassword).toBeTruthy();
    expect(res.body.data.deliveryPartner).toMatchObject({
      city: payload.city,
      user: {
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    const partnerId = res.body.data.deliveryPartner.id as string;

    const auditLog = await waitForAuditLog(
      prisma,
      DELIVERY_PARTNER_ACTIONS.CREATE,
      partnerId,
    );
    expect(auditLog).toBeTruthy();
    expect(auditLog?.actorUserId).toBe(adminUser.id);
  });

  it("2. lists delivery partners with pagination, search, and filters", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const partnerA = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(
      createDeliveryPartnerPayload({
        email: "alpha-dp@logistics.example",
        city: "Mumbai",
      }),
    );
    await deliveryPartnerRequest(app, adminLogin.auth.accessToken).create(
      createDeliveryPartnerPayload({
        email: "beta-dp@logistics.example",
        city: "Delhi",
        state: "Delhi",
      }),
    );

    const partnerAId = partnerA.body.data.deliveryPartner.id as string;

    const listRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });

    const byCityRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ city: "Mumbai" });

    expect(byCityRes.status).toBe(200);
    expect(byCityRes.body.data).toHaveLength(1);
    expect(byCityRes.body.data[0].id).toBe(partnerAId);

    const bySearchRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ search: "beta-dp@logistics" });

    expect(bySearchRes.status).toBe(200);
    expect(bySearchRes.body.data).toHaveLength(1);
    expect(bySearchRes.body.data[0].user.email).toBe("beta-dp@logistics.example");
  });

  it("3. returns delivery partner details by id", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const payload = createDeliveryPartnerPayload();

    const createRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(payload);
    const partnerId = createRes.body.data.deliveryPartner.id as string;

    const res = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).getById(partnerId);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: partnerId,
      addressLine1: payload.addressLine1,
      user: {
        email: payload.email,
        mustChangePassword: true,
      },
    });
  });

  it("4. updates a delivery partner", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const createRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(createDeliveryPartnerPayload());
    const partnerId = createRes.body.data.deliveryPartner.id as string;

    const res = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).update(partnerId, {
      firstName: "Updated",
      city: "Pune",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.firstName).toBe("Updated");
    expect(res.body.data.city).toBe("Pune");
  });

  it("5. disables and re-enables a delivery partner", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const createRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(createDeliveryPartnerPayload());
    const partnerId = createRes.body.data.deliveryPartner.id as string;

    const disableRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).disable(partnerId, { reason: "Inactive service area" });

    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.user.status).toBe("DISABLED");

    const enableRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).enable(partnerId, { reason: "Returned to roster" });

    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.user.status).toBe("ACTIVE");
  });

  it("6. rejects duplicate disable/enable with 409", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const createRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(createDeliveryPartnerPayload());
    const partnerId = createRes.body.data.deliveryPartner.id as string;

    await deliveryPartnerRequest(app, adminLogin.auth.accessToken).disable(
      partnerId,
    );

    const secondDisable = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).disable(partnerId);

    expect(secondDisable.status).toBe(409);

    await deliveryPartnerRequest(app, adminLogin.auth.accessToken).enable(
      partnerId,
    );

    const secondEnable = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).enable(partnerId);

    expect(secondEnable.status).toBe(409);
  });

  it("7. allows first login with temporary password and blocks protected routes until password change", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const payload = createDeliveryPartnerPayload();

    const createRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(payload);
    const temporaryPassword = createRes.body.data.temporaryPassword as string;

    const partnerLogin = await authRequest(app).login({
      email: payload.email,
      password: temporaryPassword,
    });

    expect(partnerLogin.status).toBe(200);
    expect(partnerLogin.body.data.user.mustChangePassword).toBe(true);

    const blockedList = await deliveryPartnerRequest(
      app,
      partnerLogin.body.data.accessToken,
    ).list();

    expect(blockedList.status).toBe(403);

    const profileRes = await userRequest(
      app,
      partnerLogin.body.data.accessToken,
    ).getProfile();

    expect(profileRes.status).toBe(200);
  });

  it("8. denies non-admin access with 403", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { auth } = await registerBuyerViaApi(app);

    const createRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(createDeliveryPartnerPayload());
    const partnerId = createRes.body.data.deliveryPartner.id as string;

    const listRes = await deliveryPartnerRequest(app, auth.accessToken).list();
    expect(listRes.status).toBe(403);

    const createAttempt = await deliveryPartnerRequest(
      app,
      auth.accessToken,
    ).create(createDeliveryPartnerPayload({ email: "blocked@example.com" }));
    expect(createAttempt.status).toBe(403);

    const disableAttempt = await deliveryPartnerRequest(
      app,
      auth.accessToken,
    ).disable(partnerId);
    expect(disableAttempt.status).toBe(403);
  });

  it("9. returns 404 for unknown delivery partner id", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const res = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).getById("550e8400-e29b-41d4-a716-446655440000");

    expect(res.status).toBe(404);
  });

  it("10. returns 409 when creating with duplicate email", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const payload = createDeliveryPartnerPayload({
      email: "duplicate-dp@logistics.example",
    });

    await deliveryPartnerRequest(app, adminLogin.auth.accessToken).create(
      payload,
    );

    const duplicateRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(payload);

    expect(duplicateRes.status).toBe(409);
  });

  it("11. excludes disabled partners from ACTIVE status filter", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const createRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(createDeliveryPartnerPayload());
    const partnerId = createRes.body.data.deliveryPartner.id as string;
    const userId = createRes.body.data.deliveryPartner.userId as string;

    await setUserStatus(prisma, userId, UserStatus.DISABLED);

    const activeRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ status: UserStatus.ACTIVE });

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.some((item: { id: string }) => item.id === partnerId)).toBe(
      false,
    );

    const disabledRes = await deliveryPartnerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ status: UserStatus.DISABLED });

    expect(disabledRes.status).toBe(200);
    expect(disabledRes.body.data.some((item: { id: string }) => item.id === partnerId)).toBe(
      true,
    );
  });
});

import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ADMIN_USER_ACTIONS } from "../../../src/modules/admin/constants/adminUser.constants.js";
import { permissions } from "../../../src/shared/permissions/rbac.permissions.js";
import { UserRole } from "../../../src/shared/enums/userRole.enum.js";
import { UserStatus } from "../../../src/shared/enums/userStatus.enum.js";
import {
  createAdminViaApi,
  createApprovedSeller,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import { DEFAULT_PASSWORD } from "../../fixtures/auth.payloads.js";
import {
  adminUserRequest,
  authRequest,
  userRequest,
} from "../../utils/request.helpers.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { getTestApp } from "../../utils/testApp.js";

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

describe("Admin Users — Management", () => {
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

  it("1. lists users with pagination, search, and filters", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app, {
      email: "alpha-buyer@clinic.example",
      firstName: "Alpha",
      lastName: "Buyer",
    });
    await registerBuyerViaApi(app, {
      email: "beta-buyer@clinic.example",
      firstName: "Beta",
      lastName: "Buyer",
    });

    const listRes = await adminUserRequest(app, adminLogin.auth.accessToken).list({
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThanOrEqual(3);
    expect(listRes.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });

    const searchRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ search: "alpha-buyer" });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data).toHaveLength(1);
    expect(searchRes.body.data[0].id).toBe(buyer.auth.user.id);

    const roleRes = await adminUserRequest(app, adminLogin.auth.accessToken).list({
      role: UserRole.BUYER,
    });
    expect(roleRes.status).toBe(200);
    expect(roleRes.body.data.every((row: { role: string }) => row.role === "BUYER")).toBe(
      true,
    );
  });

  it("2. returns user statistics", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    await registerBuyerViaApi(app);
    await createApprovedSeller(app, prisma);

    const statsRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).stats();

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data).toMatchObject({
      totalUsers: expect.any(Number),
      activeUsers: expect.any(Number),
      disabledUsers: expect.any(Number),
      buyersCount: expect.any(Number),
      sellersCount: expect.any(Number),
      deliveryPartnersCount: expect.any(Number),
    });
    expect(statsRes.body.data.buyersCount).toBeGreaterThanOrEqual(1);
    expect(statsRes.body.data.sellersCount).toBeGreaterThanOrEqual(1);
  });

  it("3. returns user details with counts and last login", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app);

    await authRequest(app).login({
      email: buyer.auth.user.email,
      password: DEFAULT_PASSWORD,
    });

    const detailRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).getById(buyer.auth.user.id);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data).toMatchObject({
      profile: {
        id: buyer.auth.user.id,
        email: buyer.auth.user.email,
        role: "BUYER",
      },
      addressesCount: 0,
      ordersCount: 0,
      accountStatus: "ACTIVE",
      registrationDate: expect.any(String),
    });
    expect(detailRes.body.data.lastLoginAt).toBeTruthy();
  });

  it("4. updates user profile fields", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin, user: adminUser } = await createAdminViaApi(
      app,
      prisma,
    );
    const buyer = await registerBuyerViaApi(app);

    const updateRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).update(buyer.auth.user.id, {
      firstName: "Updated",
      phoneNumber: "+919999999999",
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.profile).toMatchObject({
      firstName: "Updated",
      phoneNumber: "+919999999999",
    });

    const auditLog = await waitForAuditLog(
      prisma,
      ADMIN_USER_ACTIONS.UPDATE,
      buyer.auth.user.id,
    );
    expect(auditLog?.actorUserId).toBe(adminUser.id);
  });

  it("5. disables user — blocks login and preserves order visibility", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app);

    const disableRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).disable(buyer.auth.user.id, { reason: "Policy violation" });

    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.accountStatus).toBe("DISABLED");

    const loginRes = await authRequest(app).login({
      email: buyer.auth.user.email,
      password: DEFAULT_PASSWORD,
    });
    expect(loginRes.status).toBe(403);
    expect(loginRes.body.message).toMatch(/disabled/i);

    const refreshRes = await authRequest(app).refreshToken(buyer.auth.refreshToken);
    expect([401, 403]).toContain(refreshRes.status);
  });

  it("6. enables a previously disabled user", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app);

    await adminUserRequest(app, adminLogin.auth.accessToken).disable(
      buyer.auth.user.id,
      {},
    );

    const enableRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).enable(buyer.auth.user.id, {});

    expect(enableRes.status).toBe(200);
    expect(enableRes.body.data.accountStatus).toBe("ACTIVE");

    const loginRes = await authRequest(app).login({
      email: buyer.auth.user.email,
      password: DEFAULT_PASSWORD,
    });
    expect(loginRes.status).toBe(200);
  });

  it("7. soft deletes user while preserving audit history", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app);

    await adminUserRequest(app, adminLogin.auth.accessToken).update(
      buyer.auth.user.id,
      { firstName: "AuditTrail" },
    );

    const deleteRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).delete(buyer.auth.user.id);

    expect(deleteRes.status).toBe(200);

    const getRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).getById(buyer.auth.user.id);
    expect(getRes.status).toBe(404);

    const auditCount = await prisma.auditLog.count({
      where: {
        OR: [
          { entityId: buyer.auth.user.id, entityType: "USER" },
          { actorUserId: buyer.auth.user.id },
        ],
      },
    });
    expect(auditCount).toBeGreaterThan(0);
  });

  it("8. returns user activity (sessions, orders, actions)", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app);

    await authRequest(app).login({
      email: buyer.auth.user.email,
      password: DEFAULT_PASSWORD,
    });

    await adminUserRequest(app, adminLogin.auth.accessToken).update(
      buyer.auth.user.id,
      { firstName: "Activity" },
    );

    const activityRes = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).activity(buyer.auth.user.id);

    expect(activityRes.status).toBe(200);
    expect(activityRes.body.data.recentSessions.length).toBeGreaterThan(0);
    expect(activityRes.body.data.recentActions.length).toBeGreaterThan(0);
    expect(Array.isArray(activityRes.body.data.recentOrders)).toBe(true);
  });
});

describe("Admin Users — Security", () => {
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

  it("rejects unauthenticated access", async () => {
    const res = await adminUserRequest(app, "").list();
    expect(res.status).toBe(401);
  });

  it("rejects buyer RBAC on admin user endpoints", async () => {
    const prisma = getTestPrisma();
    await createAdminViaApi(app, prisma);
    const buyer = await registerBuyerViaApi(app);

    const res = await adminUserRequest(app, buyer.auth.accessToken).list();
    expect(res.status).toBe(403);
  });

  it("rejects seller RBAC on admin user endpoints", async () => {
    const prisma = getTestPrisma();
    await createAdminViaApi(app, prisma);
    const seller = await createApprovedSeller(app, prisma);

    const res = await adminUserRequest(
      app,
      seller.login.auth.accessToken,
    ).stats();
    expect(res.status).toBe(403);
  });

  it("prevents admin from disabling their own account", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin, user: adminUser } = await createAdminViaApi(
      app,
      prisma,
    );

    const res = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).disable(adminUser.id, {});

    expect(res.status).toBe(403);
  });

  it("prevents modifying other admin accounts", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const secondAdmin = await prisma.user.create({
      data: {
        email: "second-admin@platform.example",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuv", // not used for login
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        firstName: "Second",
        lastName: "Admin",
      },
    });

    const res = await adminUserRequest(
      app,
      adminLogin.auth.accessToken,
    ).disable(secondAdmin.id, {});

    expect(res.status).toBe(403);
  });

  it("buyer cannot access another user's admin detail (ownership via RBAC)", async () => {
    const prisma = getTestPrisma();
    await createAdminViaApi(app, prisma);
    const buyerA = await registerBuyerViaApi(app);
    const buyerB = await registerBuyerViaApi(app);

    const selfRes = await userRequest(app, buyerA.auth.accessToken).getProfile();
    expect(selfRes.status).toBe(200);

    const forbiddenRes = await adminUserRequest(
      app,
      buyerA.auth.accessToken,
    ).getById(buyerB.auth.user.id);
    expect(forbiddenRes.status).toBe(403);
  });
});

describe("Admin Users — RBAC permissions", () => {
  it("defines admin-only user management permissions", () => {
    expect(permissions.users.list).toBe("users:list");
    expect(permissions.users.read).toBe("users:read");
    expect(permissions.users.update).toBe("users:update");
    expect(permissions.users.disable).toBe("users:disable");
    expect(permissions.users.enable).toBe("users:enable");
    expect(permissions.users.delete).toBe("users:delete");
    expect(permissions.users.stats).toBe("users:stats");
    expect(permissions.users.activity).toBe("users:activity");
  });
});

import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SellerApprovalStatus } from "../../../src/shared/enums/sellerApprovalStatus.enum.js";
import { SELLER_ACTIONS } from "../../../src/modules/sellers/constants/seller.constants.js";
import {
  createAdminViaApi,
  createApprovedSeller,
  registerBuyerViaApi,
  registerSellerViaApi,
  setSellerApprovalStatus,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { sellerRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

async function getSellerProfileId(
  prisma: ReturnType<typeof getTestPrisma>,
  userId: string,
): Promise<string> {
  const profile = await prisma.sellerProfile.findFirstOrThrow({
    where: { userId },
    select: { id: true },
  });
  return profile.id;
}

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

describe("Sellers — Admin Management", () => {
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

  it("1. lists sellers with pagination and filters", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const sellerA = await registerSellerViaApi(app, {
      email: "alpha-seller@clinic.example",
      businessName: "Alpha Medical Supplies",
    });
    await registerSellerViaApi(app, {
      email: "beta-seller@hospital.example",
      businessName: "Beta Equipment Co",
    });

    const sellerAId = await getSellerProfileId(
      prisma,
      sellerA.auth.user.id,
    );

    const listRes = await sellerRequest(app, adminLogin.auth.accessToken).list({
      page: 1,
      limit: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });

    const byCompanyRes = await sellerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ companyName: "Alpha Medical" });

    expect(byCompanyRes.status).toBe(200);
    expect(byCompanyRes.body.data).toHaveLength(1);
    expect(byCompanyRes.body.data[0].id).toBe(sellerAId);

    const byEmailRes = await sellerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ email: "beta-seller@hospital" });

    expect(byEmailRes.status).toBe(200);
    expect(byEmailRes.body.data).toHaveLength(1);
    expect(byEmailRes.body.data[0].user.email).toBe(
      "beta-seller@hospital.example",
    );

    const byStatusRes = await sellerRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ approvalStatus: SellerApprovalStatus.PENDING_APPROVAL });

    expect(byStatusRes.status).toBe(200);
    expect(byStatusRes.body.data).toHaveLength(2);
  });

  it("2. returns seller details by id", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { auth, payload } = await registerSellerViaApi(app);
    const sellerId = await getSellerProfileId(prisma, auth.user.id);

    const res = await sellerRequest(app, adminLogin.auth.accessToken).getById(
      sellerId,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: sellerId,
      businessName: payload.businessName,
      approvalStatus: "PENDING_APPROVAL",
      user: {
        email: payload.email,
      },
    });
    expect(res.body.data.documents).toEqual([]);
  });

  it("3. approves a pending seller", async () => {
    const prisma = getTestPrisma();
    const { user: adminUser, login: adminLogin } = await createAdminViaApi(
      app,
      prisma,
    );
    const { auth } = await registerSellerViaApi(app);
    const sellerId = await getSellerProfileId(prisma, auth.user.id);

    const res = await sellerRequest(app, adminLogin.auth.accessToken).approve(
      sellerId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe("ACTIVE");

    const auditLog = await waitForAuditLog(
      prisma,
      SELLER_ACTIONS.APPROVE,
      sellerId,
    );
    expect(auditLog).toBeTruthy();
    expect(auditLog?.actorUserId).toBe(adminUser.id);
  });

  it("4. rejects a pending seller with optional reason", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { auth } = await registerSellerViaApi(app);
    const sellerId = await getSellerProfileId(prisma, auth.user.id);

    const res = await sellerRequest(app, adminLogin.auth.accessToken).reject(
      sellerId,
      { reason: "Incomplete documents" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe("REJECTED");
  });

  it("5. disables an active seller", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { auth } = await createApprovedSeller(app, prisma);
    const sellerId = await getSellerProfileId(prisma, auth.user.id);

    const res = await sellerRequest(app, adminLogin.auth.accessToken).disable(
      sellerId,
      { reason: "Policy violation" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe("DISABLED");
  });

  it("6. re-enables a disabled seller", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { auth } = await registerSellerViaApi(app);
    const sellerId = await getSellerProfileId(prisma, auth.user.id);

    await setSellerApprovalStatus(
      prisma,
      auth.user.id,
      SellerApprovalStatus.DISABLED,
    );

    const res = await sellerRequest(app, adminLogin.auth.accessToken).enable(
      sellerId,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.approvalStatus).toBe("ACTIVE");
  });

  it("7. rejects invalid state transitions with 409", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { auth } = await registerSellerViaApi(app);
    const sellerId = await getSellerProfileId(prisma, auth.user.id);

    await setSellerApprovalStatus(
      prisma,
      auth.user.id,
      SellerApprovalStatus.REJECTED,
    );

    const res = await sellerRequest(app, adminLogin.auth.accessToken).approve(
      sellerId,
    );

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("8. denies non-admin access with 403", async () => {
    const prisma = getTestPrisma();
    const { auth } = await registerBuyerViaApi(app);
    const { auth: sellerAuth } = await registerSellerViaApi(app);
    const sellerId = await getSellerProfileId(prisma, sellerAuth.user.id);

    const listRes = await sellerRequest(app, auth.accessToken).list();
    expect(listRes.status).toBe(403);

    const approveRes = await sellerRequest(app, auth.accessToken).approve(
      sellerId,
    );
    expect(approveRes.status).toBe(403);
  });

  it("9. returns 404 for unknown seller id", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);

    const res = await sellerRequest(app, adminLogin.auth.accessToken).getById(
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(res.status).toBe(404);
  });
});

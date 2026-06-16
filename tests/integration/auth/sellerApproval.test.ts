import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createApprovedSeller,
  createDisabledSeller,
  registerSellerViaApi,
  setSellerApprovalStatus,
} from "../../factories/user.factory.js";
import { SellerApprovalStatus } from "../../../src/shared/enums/sellerApprovalStatus.enum.js";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../../utils/db.js";
import {
  sellerProbeRequest,
  userRequest,
} from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Auth — Seller Approval", () => {
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

  it("23. restricts pending sellers from operational routes", async () => {
    const { auth } = await registerSellerViaApi(app);

    expect(auth.user.sellerApprovalStatus).toBe("PENDING_APPROVAL");

    const profileRes = await userRequest(app, auth.accessToken).getProfile();
    expect(profileRes.status).toBe(200);

    const operationalRes = await sellerProbeRequest(app, auth.accessToken);
    expect(operationalRes.status).toBe(403);
    expect(operationalRes.body.success).toBe(false);
    expect(operationalRes.body.message).toBe(
      "Seller account is pending admin approval",
    );
  });

  it("24. allows approved sellers to access operational routes", async () => {
    const { login } = await createApprovedSeller(app, getTestPrisma());

    const profileRes = await userRequest(
      app,
      login.auth.accessToken,
    ).getProfile();
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.sellerProfile.approvalStatus).toBe("ACTIVE");

    const operationalRes = await sellerProbeRequest(
      app,
      login.auth.accessToken,
    );
    expect(operationalRes.status).toBe(200);
    expect(operationalRes.body.success).toBe(true);
    expect(operationalRes.body.message).toBe(
      "Seller operational access granted",
    );
  });

  it("25. blocks disabled sellers from operational routes", async () => {
    const { login, auth } = await createDisabledSeller(app, getTestPrisma());

    const prisma = getTestPrisma();
    await setSellerApprovalStatus(
      prisma,
      auth.user.id,
      SellerApprovalStatus.DISABLED,
    );

    const profileRes = await userRequest(
      app,
      login.auth.accessToken,
    ).getProfile();
    expect(profileRes.status).toBe(200);

    const operationalRes = await sellerProbeRequest(
      app,
      login.auth.accessToken,
    );
    expect(operationalRes.status).toBe(403);
    expect(operationalRes.body.success).toBe(false);
    expect(operationalRes.body.message).toBe(
      "Seller account has been disabled",
    );
  });
});

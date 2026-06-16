import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { BuyerType } from "../../../generated/prisma/client.js";
import { buyerRegistrationPayload, sellerRegistrationPayload } from "../../fixtures/auth.payloads.js";
import { registerBuyerViaApi, registerSellerViaApi } from "../../factories/user.factory.js";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../../utils/db.js";
import { authRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Auth — Registration", () => {
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

  it("1. registers a buyer and returns tokens", async () => {
    const payload = buyerRegistrationPayload();

    const res = await authRequest(app).registerBuyer(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Buyer registered successfully");
    expect(res.body.data.user).toMatchObject({
      email: payload.email,
      role: "BUYER",
    });
    expect(res.body.data.user.sellerApprovalStatus).toBeUndefined();
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));

    const prisma = getTestPrisma();
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: { buyerProfile: true },
    });

    expect(user).not.toBeNull();
    expect(user?.buyerProfile?.buyerType).toBe(BuyerType.DOCTOR);
    expect(user?.role).toBe("BUYER");
  });

  it("2. registers a seller with pending approval status", async () => {
    const payload = sellerRegistrationPayload();

    const res = await authRequest(app).registerSeller(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Seller registered successfully");
    expect(res.body.data.user).toMatchObject({
      email: payload.email,
      role: "SELLER",
      sellerApprovalStatus: "PENDING_APPROVAL",
    });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));

    const prisma = getTestPrisma();
    const sellerProfile = await prisma.sellerProfile.findFirst({
      where: { user: { email: payload.email } },
    });

    expect(sellerProfile?.approvalStatus).toBe("PENDING_APPROVAL");
    expect(sellerProfile?.businessName).toBe(payload.businessName);
  });

  it("3. rejects duplicate email registration", async () => {
    const payload = buyerRegistrationPayload();
    const first = await registerBuyerViaApi(app, payload);
    expect(first.response.status).toBe(201);

    const duplicate = await authRequest(app).registerBuyer({
      ...buyerRegistrationPayload(),
      email: payload.email,
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.message).toBe("Email already registered");
  });
});

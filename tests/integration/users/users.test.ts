import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD } from "../../fixtures/auth.payloads.js";
import {
  profileUpdatePayload,
  STRONG_NEW_PASSWORD,
  WEAK_PASSWORD,
} from "../../fixtures/user.payloads.js";
import { countActiveSessionsForUser } from "../../factories/auth.factory.js";
import {
  createDeliveryPartnerUser,
  createUserWithPassword,
  loginDeliveryPartnerViaApi,
  loginViaApi,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { authRequest, userRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";
import {
  signInvalidAccessToken,
  tamperAccessToken,
} from "../../utils/jwt.helpers.js";

describe("Users — Profile, Password & Security", () => {
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

  it("1. gets current profile for authenticated user", async () => {
    const { auth, payload } = await registerBuyerViaApi(app);

    const res = await userRequest(app, auth.accessToken).getProfile();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Profile fetched successfully");
    expect(res.body.data).toMatchObject({
      id: auth.user.id,
      email: payload.email,
      role: "BUYER",
      status: "ACTIVE",
      firstName: payload.firstName,
      lastName: payload.lastName,
    });
    expect(res.body.data.buyerProfile).toBeTruthy();
  });

  it("2. updates profile successfully", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const update = profileUpdatePayload({ phoneNumber: "9876543210" });

    const res = await userRequest(app, auth.accessToken).updateProfile(update);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Profile updated successfully");
    expect(res.body.data).toMatchObject({
      firstName: "Updated",
      lastName: "Name",
      phoneNumber: "9876543210",
    });
  });

  it("3. rejects invalid profile update data", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await userRequest(app, auth.accessToken).updateProfile({
      firstName: "",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  it("4. rejects profile update for disabled user", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { status: "DISABLED" },
    });

    const res = await userRequest(app, auth.accessToken).updateProfile(
      profileUpdatePayload(),
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Account is disabled");
  });

  it("5. changes password successfully", async () => {
    const { auth, payload } = await registerBuyerViaApi(app);

    const res = await userRequest(app, auth.accessToken).changePassword({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: STRONG_NEW_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Password changed successfully");

    const loginRes = await authRequest(app).login({
      email: payload.email,
      password: STRONG_NEW_PASSWORD,
    });
    expect(loginRes.status).toBe(200);
  });

  it("6. rejects change password with wrong current password", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await userRequest(app, auth.accessToken).changePassword({
      currentPassword: "WrongCurrent1!",
      newPassword: STRONG_NEW_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Current password is incorrect");
  });

  it("7. rejects weak new password on change password", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await userRequest(app, auth.accessToken).changePassword({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: WEAK_PASSWORD,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  it("8. revokes all sessions after password change", async () => {
    const { auth, payload } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();

    const beforeCount = await countActiveSessionsForUser(prisma, auth.user.id);
    expect(beforeCount).toBeGreaterThan(0);

    const changeRes = await userRequest(app, auth.accessToken).changePassword({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: STRONG_NEW_PASSWORD,
    });
    expect(changeRes.status).toBe(200);

    const afterCount = await countActiveSessionsForUser(prisma, auth.user.id);
    expect(afterCount).toBe(0);

    const refreshRes = await authRequest(app).refreshToken(auth.refreshToken);
    expect(refreshRes.status).toBe(401);

    const loginRes = await authRequest(app).login({
      email: payload.email,
      password: STRONG_NEW_PASSWORD,
    });
    expect(loginRes.status).toBe(200);
  });

  it("9. returns only the authenticated user profile (no cross-user access)", async () => {
    const buyerA = await registerBuyerViaApi(app);
    const buyerB = await registerBuyerViaApi(app);

    const resA = await userRequest(app, buyerA.auth.accessToken).getProfile();
    const resB = await userRequest(app, buyerB.auth.accessToken).getProfile();

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.data.id).toBe(buyerA.auth.user.id);
    expect(resB.body.data.id).toBe(buyerB.auth.user.id);
    expect(resA.body.data.id).not.toBe(resB.body.data.id);
    expect(resA.body.data.email).toBe(buyerA.payload.email);
    expect(resB.body.data.email).toBe(buyerB.payload.email);
  });

  it("10. rejects profile access without authentication", async () => {
    const res = await userRequest(app, "").getProfile();

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Access token is required");
  });

  it("11. rejects invalid JWT on profile access", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const tampered = tamperAccessToken(auth.accessToken);
    const tamperedRes = await userRequest(app, tampered).getProfile();
    expect(tamperedRes.status).toBe(401);
    expect(tamperedRes.body.message).toBe("Invalid or expired access token");

    const forged = signInvalidAccessToken({
      sub: auth.user.id,
      email: auth.user.email,
      role: auth.user.role,
    });
    const forgedRes = await userRequest(app, forged).getProfile();
    expect(forgedRes.status).toBe(401);
    expect(forgedRes.body.message).toBe("Invalid or expired access token");
  });

  it("12. rejects disabled account on profile access", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { status: "DISABLED" },
    });

    const res = await userRequest(app, auth.accessToken).getProfile();

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Account is disabled");
  });

  it("13. rejects duplicate phone number on profile update", async () => {
    const prisma = getTestPrisma();
    const sharedPhone = "9123456789";

    await createUserWithPassword(prisma, {
      email: "existing-phone@example.com",
      phoneNumber: sharedPhone,
    });

    const { auth } = await registerBuyerViaApi(app);

    const res = await userRequest(app, auth.accessToken).updateProfile({
      phoneNumber: sharedPhone,
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Phone number is already in use");
  });

  it("14. rejects empty profile update payload", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await userRequest(app, auth.accessToken).updateProfile({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  it("15. blocks delivery partner with mustChangePassword from non-password routes", async () => {
    const prisma = getTestPrisma();
    const partner = await createDeliveryPartnerUser(prisma, {
      mustChangePassword: true,
    });
    const { auth } = await loginDeliveryPartnerViaApi(app, partner.email);

    const blocked = await userRequest(app, auth.accessToken).updateProfile(
      profileUpdatePayload(),
    );
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe(
      "Password change required before accessing this resource",
    );

    const allowed = await userRequest(app, auth.accessToken).changePassword({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: STRONG_NEW_PASSWORD,
    });
    expect(allowed.status).toBe(200);
  });
});

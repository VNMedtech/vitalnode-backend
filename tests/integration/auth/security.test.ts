import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD } from "../../fixtures/auth.payloads.js";
import {
  corruptSessionHash,
  countActiveSessionsForUser,
  getSessionForRefreshToken,
} from "../../factories/auth.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../../utils/db.js";
import { authRequest, userRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";
import { signInvalidAccessToken, tamperAccessToken } from "../../utils/jwt.helpers.js";

describe("Auth — Security", () => {
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

  it("20. revokes session on refresh token replay attack", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();
    const session = await getSessionForRefreshToken(prisma, auth.refreshToken);

    await corruptSessionHash(prisma, auth.refreshToken);

    const replay = await authRequest(app).refreshToken(auth.refreshToken);
    expect(replay.status).toBe(401);
    expect(replay.body.message).toBe("Invalid refresh token");

    const revoked = await prisma.authSession.findUnique({
      where: { id: session!.id },
    });
    expect(revoked?.revokedAt).not.toBeNull();
  });

  it("21. revokes all sessions after password change", async () => {
    const { auth, payload } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();

    const beforeCount = await countActiveSessionsForUser(
      prisma,
      auth.user.id,
    );
    expect(beforeCount).toBeGreaterThan(0);

    const changeRes = await userRequest(app, auth.accessToken).changePassword({
      currentPassword: DEFAULT_PASSWORD,
      newPassword: "ChangedPass6!",
    });
    expect(changeRes.status).toBe(200);

    const afterCount = await countActiveSessionsForUser(prisma, auth.user.id);
    expect(afterCount).toBe(0);

    const refreshRes = await authRequest(app).refreshToken(auth.refreshToken);
    expect(refreshRes.status).toBe(401);

    const loginRes = await authRequest(app).login({
      email: payload.email,
      password: "ChangedPass6!",
    });
    expect(loginRes.status).toBe(200);
  });

  it("22. rejects tampered JWT access tokens", async () => {
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
});

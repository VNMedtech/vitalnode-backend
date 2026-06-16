import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  corruptSessionHash,
  expireSession,
  getSessionForRefreshToken,
  revokeSession,
} from "../../factories/auth.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../../utils/db.js";
import { authRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Auth — Refresh Token", () => {
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

  it("7. refreshes tokens successfully", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await authRequest(app).refreshToken(auth.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Token refreshed successfully");
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).not.toBe(auth.refreshToken);
  });

  it("8. rejects expired refresh token", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();

    await expireSession(prisma, auth.refreshToken);

    const res = await authRequest(app).refreshToken(auth.refreshToken);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Refresh token expired");
  });

  it("9. rejects revoked refresh token", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();

    await revokeSession(prisma, auth.refreshToken);

    const res = await authRequest(app).refreshToken(auth.refreshToken);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Refresh token revoked");
  });

  it("10. rejects invalid refresh token", async () => {
    const res = await authRequest(app).refreshToken("not-a-valid-jwt");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid or expired refresh token");
  });

  it("11. rotates refresh token and revokes the previous session", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();
    const originalSession = await getSessionForRefreshToken(
      prisma,
      auth.refreshToken,
    );

    const refreshRes = await authRequest(app).refreshToken(auth.refreshToken);
    expect(refreshRes.status).toBe(200);

    const revokedOriginal = await prisma.authSession.findUnique({
      where: { id: originalSession!.id },
    });
    expect(revokedOriginal?.revokedAt).not.toBeNull();

    const newSession = await getSessionForRefreshToken(
      prisma,
      refreshRes.body.data.refreshToken,
    );
    expect(newSession).not.toBeNull();
    expect(newSession?.id).not.toBe(originalSession?.id);
  });
});

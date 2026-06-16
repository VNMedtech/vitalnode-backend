import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSessionForRefreshToken } from "../../factories/auth.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../../utils/db.js";
import { authRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Auth — Logout", () => {
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

  it("12. logs out successfully", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await authRequest(app).logout(auth.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Logout successful");
    expect(res.body.data.ok).toBe(true);
  });

  it("13. revokes the auth session on logout", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const prisma = getTestPrisma();
    const session = await getSessionForRefreshToken(prisma, auth.refreshToken);

    await authRequest(app).logout(auth.refreshToken);

    const updated = await prisma.authSession.findUnique({
      where: { id: session!.id },
    });
    expect(updated?.revokedAt).not.toBeNull();
  });

  it("14. rejects reuse of a logged-out refresh token", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const logoutRes = await authRequest(app).logout(auth.refreshToken);
    expect(logoutRes.status).toBe(200);

    const refreshRes = await authRequest(app).refreshToken(auth.refreshToken);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.message).toBe("Refresh token revoked");
  });
});

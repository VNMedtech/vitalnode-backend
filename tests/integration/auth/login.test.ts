import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD, loginPayload } from "../../fixtures/auth.payloads.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { disconnectTestPrisma, resetDatabase } from "../../utils/db.js";
import { authRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Auth — Login", () => {
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

  it("4. logs in with valid credentials", async () => {
    const { payload } = await registerBuyerViaApi(app);

    const res = await authRequest(app).login(loginPayload(payload.email));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.data.user.email).toBe(payload.email);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it("5. rejects login with invalid password", async () => {
    const { payload } = await registerBuyerViaApi(app);

    const res = await authRequest(app).login({
      email: payload.email,
      password: "WrongPassword1!",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials");
  });

  it("6. rejects login for nonexistent user", async () => {
    const res = await authRequest(app).login({
      email: "nobody@example.com",
      password: DEFAULT_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid credentials");
  });
});

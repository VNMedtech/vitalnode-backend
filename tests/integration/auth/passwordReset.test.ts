import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../../src/config/env.js";
import { emailClient } from "../../../src/infrastructure/email/index.js";
import { DEFAULT_PASSWORD, loginPayload } from "../../fixtures/auth.payloads.js";
import { expirePasswordResetToken } from "../../factories/auth.factory.js";
import { registerBuyerViaApi } from "../../factories/user.factory.js";
import { disconnectTestPrisma, getTestPrisma, resetDatabase } from "../../utils/db.js";
import {
  authRequest,
  extractResetTokenFromEmailPayload,
} from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Auth — Password Reset", () => {
  let app: Express;
  let sentEmails: Array<{
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
  }>;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    sentEmails = [];

    vi.spyOn(emailClient, "send").mockImplementation(async (input) => {
      sentEmails.push(input);
      return { messageId: "test-message-id" };
    });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("15. sends reset email for existing user", async () => {
    const { payload } = await registerBuyerViaApi(app);

    const res = await authRequest(app).forgotPassword(payload.email);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("If the email exists, a reset link has been sent");
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe(payload.email);

    const prisma = getTestPrisma();
    const tokens = await prisma.passwordResetToken.findMany({
      where: { user: { email: payload.email } },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.usedAt).toBeNull();
  });

  it("16. returns success for unknown user without leaking existence", async () => {
    const res = await authRequest(app).forgotPassword("unknown@example.com");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("If the email exists, a reset link has been sent");
    expect(sentEmails).toHaveLength(0);

    const prisma = getTestPrisma();
    const tokens = await prisma.passwordResetToken.count();
    expect(tokens).toBe(0);
  });

  it("17. resets password successfully", async () => {
    const { payload } = await registerBuyerViaApi(app);
    const newPassword = "NewSecurePass2!";

    await authRequest(app).forgotPassword(payload.email);
    const rawToken = extractResetTokenFromEmailPayload(sentEmails[0]!);

    const resetRes = await authRequest(app).resetPassword({
      token: rawToken,
      newPassword,
    });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.message).toBe("Password reset successful");

    const oldLogin = await authRequest(app).login(loginPayload(payload.email));
    expect(oldLogin.status).toBe(401);

    const newLogin = await authRequest(app).login({
      email: payload.email,
      password: newPassword,
    });
    expect(newLogin.status).toBe(200);
  });

  it("18. rejects expired reset token", async () => {
    const { payload } = await registerBuyerViaApi(app);

    await authRequest(app).forgotPassword(payload.email);
    const rawToken = extractResetTokenFromEmailPayload(sentEmails[0]!);

    const prisma = getTestPrisma();
    await expirePasswordResetToken(prisma, rawToken);

    const res = await authRequest(app).resetPassword({
      token: rawToken,
      newPassword: "AnotherPass3!",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Reset token expired");
  });

  it("19. rejects reused reset token", async () => {
    const { payload } = await registerBuyerViaApi(app);

    await authRequest(app).forgotPassword(payload.email);
    const rawToken = extractResetTokenFromEmailPayload(sentEmails[0]!);
    const newPassword = "AnotherPass4!";

    const first = await authRequest(app).resetPassword({
      token: rawToken,
      newPassword,
    });
    expect(first.status).toBe(200);

    const second = await authRequest(app).resetPassword({
      token: rawToken,
      newPassword: "YetAnotherPass5!",
    });

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
    expect(second.body.message).toBe("Reset token already used");

    const loginRes = await authRequest(app).login({
      email: payload.email,
      password: newPassword,
    });
    expect(loginRes.status).toBe(200);
  });

  describe("portal-aware reset links", () => {
    const savedUrls = { ...env.webAppUrls };

    beforeEach(() => {
      env.webAppUrls.store = "https://store.test.local";
      env.webAppUrls.seller = "https://seller.test.local";
      env.webAppUrls.admin = "https://admin.test.local";
      env.webAppUrls.delivery = "https://delivery.test.local";
      env.webAppUrls.fallback = "https://fallback.test.local";
      env.webAppBaseUrl = "https://fallback.test.local";
    });

    afterAll(() => {
      Object.assign(env.webAppUrls, savedUrls);
      env.webAppBaseUrl = savedUrls.fallback;
    });

    it("20. uses seller base URL when portal is SELLER", async () => {
      const { payload } = await registerBuyerViaApi(app);

      const res = await authRequest(app).forgotPassword({
        email: payload.email,
        portal: "SELLER",
      });

      expect(res.status).toBe(200);
      expect(sentEmails).toHaveLength(1);

      const html = sentEmails[0]?.html ?? "";
      const text = sentEmails[0]?.text ?? "";
      expect(html + text).toContain("https://seller.test.local/reset-password?token=");
      expect(html + text).not.toContain("https://fallback.test.local/reset-password");
    });

    it("21. uses WEB_APP_BASE_URL when portal is omitted", async () => {
      const { payload } = await registerBuyerViaApi(app);

      const res = await authRequest(app).forgotPassword(payload.email);

      expect(res.status).toBe(200);
      expect(sentEmails).toHaveLength(1);

      const html = sentEmails[0]?.html ?? "";
      const text = sentEmails[0]?.text ?? "";
      expect(html + text).toContain(
        "https://fallback.test.local/reset-password?token=",
      );
    });

    it("22. unknown email with portal still returns generic success", async () => {
      const res = await authRequest(app).forgotPassword({
        email: "unknown-portal@example.com",
        portal: "ADMIN",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe(
        "If the email exists, a reset link has been sent",
      );
      expect(sentEmails).toHaveLength(0);
    });

    it("23. reset-password still works after portal-aware forgot-password", async () => {
      const { payload } = await registerBuyerViaApi(app);
      const newPassword = "PortalAwarePass9!";

      await authRequest(app).forgotPassword({
        email: payload.email,
        portal: "SELLER",
      });
      const rawToken = extractResetTokenFromEmailPayload(sentEmails[0]!);

      const resetRes = await authRequest(app).resetPassword({
        token: rawToken,
        newPassword,
      });

      expect(resetRes.status).toBe(200);

      const loginRes = await authRequest(app).login({
        email: payload.email,
        password: newPassword,
      });
      expect(loginRes.status).toBe(200);
    });
  });
});

import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
});

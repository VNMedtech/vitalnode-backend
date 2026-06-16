import type { PrismaClient } from "../../generated/prisma/client.js";
import { sha256 } from "../../src/utils/crypto.util.js";
import { verifyRefreshToken } from "../../src/utils/jwt.util.js";

export async function getSessionForRefreshToken(
  prisma: PrismaClient,
  refreshToken: string,
) {
  const payload = verifyRefreshToken(refreshToken);
  return prisma.authSession.findFirst({
    where: { id: payload.tokenId },
  });
}

export async function expireSession(
  prisma: PrismaClient,
  refreshToken: string,
) {
  const session = await getSessionForRefreshToken(prisma, refreshToken);
  if (!session) {
    throw new Error("Session not found for refresh token");
  }

  return prisma.authSession.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
}

export async function revokeSession(
  prisma: PrismaClient,
  refreshToken: string,
) {
  const session = await getSessionForRefreshToken(prisma, refreshToken);
  if (!session) {
    throw new Error("Session not found for refresh token");
  }

  return prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
}

export async function corruptSessionHash(
  prisma: PrismaClient,
  refreshToken: string,
) {
  const session = await getSessionForRefreshToken(prisma, refreshToken);
  if (!session) {
    throw new Error("Session not found for refresh token");
  }

  return prisma.authSession.update({
    where: { id: session.id },
    data: { refreshTokenHash: sha256("corrupted-token-value") },
  });
}

export async function expirePasswordResetToken(
  prisma: PrismaClient,
  rawToken: string,
) {
  const tokenHash = sha256(rawToken);
  const row = await prisma.passwordResetToken.findFirst({
    where: { tokenHash },
  });

  if (!row) {
    throw new Error("Password reset token not found");
  }

  return prisma.passwordResetToken.update({
    where: { id: row.id },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
}

export async function countActiveSessionsForUser(
  prisma: PrismaClient,
  userId: string,
) {
  return prisma.authSession.count({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
  });
}

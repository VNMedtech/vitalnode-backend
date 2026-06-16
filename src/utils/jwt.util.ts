/**
 * JWT token generation and verification utilities.
 */
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../shared/errors/app.errors.js";
import type { AccessTokenPayload, RefreshTokenPayload } from "../types/jwt.types.js";

const JWT_ALGORITHM = "HS256" as const;

function getAccessTokenSignOptions(): SignOptions {
  return {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"],
  };
}

function getRefreshTokenSignOptions(): SignOptions {
  return {
    algorithm: JWT_ALGORITHM,
    expiresIn: env.jwtRefreshExpiresIn as SignOptions["expiresIn"],
  };
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, getAccessTokenSignOptions());
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, getRefreshTokenSignOptions());
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      algorithms: [JWT_ALGORITHM],
    });

    return decoded as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtRefreshSecret, {
      algorithms: [JWT_ALGORITHM],
    });

    return decoded as RefreshTokenPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}

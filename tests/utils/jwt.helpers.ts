import jwt from "jsonwebtoken";

export function tamperAccessToken(token: string): string {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const payload = JSON.parse(
    Buffer.from(parts[1]!, "base64url").toString("utf8"),
  ) as Record<string, unknown>;

  payload.email = "attacker@evil.com";

  const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${parts[0]}.${tamperedPayload}.${parts[2]}`;
}

export function signInvalidAccessToken(
  payload: Record<string, unknown>,
  secret = "wrong-secret-that-is-at-least-32-chars",
): string {
  return jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn: "15m",
  });
}

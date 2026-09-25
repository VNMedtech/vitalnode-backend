import { OAuth2Client } from "google-auth-library";
import { env } from "../../../config/env.js";
import { AppError, UnauthorizedError } from "../../../shared/errors/app.errors.js";

export type GoogleIdentity = {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
};

let client: OAuth2Client | null = null;
let cachedClientId = "";

function getClient(): OAuth2Client {
  if (!env.googleClientId) {
    throw new AppError(
      "Google sign-in is not configured.",
      503,
      "GOOGLE_NOT_CONFIGURED",
    );
  }

  if (!client || cachedClientId !== env.googleClientId) {
    client = new OAuth2Client(env.googleClientId);
    cachedClientId = env.googleClientId;
  }

  return client;
}

function safePicture(url: string | undefined): string | undefined {
  if (!url || url.length > 2048 || !url.startsWith("https://")) {
    return undefined;
  }
  return url;
}

function namesFromPayload(payload: {
  given_name?: string;
  family_name?: string;
  name?: string;
}): { firstName: string; lastName: string } {
  const given = payload.given_name?.trim() ?? "";
  const family = payload.family_name?.trim() ?? "";
  if (given || family) {
    return {
      firstName: given || "User",
      lastName: family || "Account",
    };
  }

  const parts = (payload.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "User", lastName: "Account" };
  }

  return {
    firstName: parts[0] ?? "User",
    lastName: parts.slice(1).join(" ") || "Account",
  };
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const oauth = getClient();

  let payload;
  try {
    const ticket = await oauth.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedError(
      "Google sign-in could not be verified. Please try again.",
    );
  }

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new UnauthorizedError(
      payload?.email_verified === false
        ? "Google email is not verified."
        : "Google sign-in could not be verified. Please try again.",
    );
  }

  const names = namesFromPayload(payload);
  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    firstName: names.firstName,
    lastName: names.lastName,
    picture: safePicture(payload.picture),
  };
}

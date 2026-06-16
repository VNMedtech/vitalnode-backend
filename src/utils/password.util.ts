import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.bcryptSaltRounds);
}

export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}

const TEMP_PASSWORD_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const TEMP_PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const TEMP_PASSWORD_DIGITS = "23456789";
const TEMP_PASSWORD_SPECIAL = "!@#$%^&*";
const TEMP_PASSWORD_ALL =
  TEMP_PASSWORD_UPPER +
  TEMP_PASSWORD_LOWER +
  TEMP_PASSWORD_DIGITS +
  TEMP_PASSWORD_SPECIAL;

function pickRandomChar(charset: string): string {
  return charset[crypto.randomInt(charset.length)]!;
}

/** Generates a random password that satisfies strong password policy. */
export function generateTemporaryPassword(length = 12): string {
  const required = [
    pickRandomChar(TEMP_PASSWORD_UPPER),
    pickRandomChar(TEMP_PASSWORD_LOWER),
    pickRandomChar(TEMP_PASSWORD_DIGITS),
    pickRandomChar(TEMP_PASSWORD_SPECIAL),
  ];

  const remaining = Array.from({ length: length - required.length }, () =>
    pickRandomChar(TEMP_PASSWORD_ALL),
  );

  const chars = [...required, ...remaining];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join("");
}

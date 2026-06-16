import { z } from "zod";

/** E.164-style phone numbers: optional leading +, 8–15 digits. */
const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(8, "Phone number is too short")
  .max(20, "Phone number is too long")
  .regex(PHONE_REGEX, "Invalid phone number format");

import { z } from "zod";

/** Alphanumeric postal codes with optional spaces or hyphens. */
const POSTAL_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/;

export const postalCodeSchema = z
  .string()
  .trim()
  .min(1, "Postal code is required")
  .max(20, "Postal code is too long")
  .regex(POSTAL_CODE_REGEX, "Invalid postal code format");

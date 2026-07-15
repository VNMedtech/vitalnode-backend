import { z } from "zod";

/** Alphanumeric NMC registration numbers (letters and digits only). */
const NMC_REGISTRATION_REGEX = /^[A-Za-z0-9]+$/;

export const nmcRegistrationNumberSchema = z
  .string()
  .trim()
  .min(1, "NMC registration number is required")
  .max(30, "NMC registration number is too long")
  .regex(NMC_REGISTRATION_REGEX, "NMC registration number must be alphanumeric");

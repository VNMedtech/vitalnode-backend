import { z } from "zod";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

const PASSWORD_STRENGTH_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "Password must be at least 8 characters")
  .max(
    PASSWORD_MAX_LENGTH,
    "Password must be at most 72 characters (bcrypt limit)",
  )
  .regex(
    PASSWORD_STRENGTH_REGEX,
    "Password must include uppercase, lowercase, number, and special character",
  );

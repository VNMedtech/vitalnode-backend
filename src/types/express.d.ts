/**
 * Express Request type augmentation — attaches authenticated user.
 */
import type { AuthenticatedUser } from "../shared/types/common.types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      rawBody?: string | Buffer;
      idempotencyKey?: string;
    }
  }
}

export {};

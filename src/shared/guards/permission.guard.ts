import { ForbiddenError } from "../errors/app.errors.js";
import {
  userHasPermission,
  type PermissionSubject,
} from "../permissions/seller.permissions.js";
import type { Permission } from "../permissions/rbac.permissions.js";

export function assertPermission(
  subject: PermissionSubject,
  permission: Permission,
): void {
  if (!userHasPermission(subject, permission)) {
    throw new ForbiddenError("Insufficient permissions");
  }
}

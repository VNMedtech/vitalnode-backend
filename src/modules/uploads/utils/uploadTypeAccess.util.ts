/**
 * uploads — uploadTypeAccess.util
 * Role-based access rules for upload types.
 */
import { ForbiddenError } from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import {
  UPLOAD_TYPE_ALLOWED_ROLES,
  UPLOAD_TYPE_CATEGORY,
} from "../constants/upload.constants.js";
import type { UploadCategoryType, UploadTypeValue } from "../types/upload.types.js";

export function resolveUploadCategory(
  uploadType: UploadTypeValue,
): UploadCategoryType {
  return UPLOAD_TYPE_CATEGORY[uploadType];
}

export function assertUploadTypeAllowedForRole(
  uploadType: UploadTypeValue,
  role: UserRole,
): void {
  const allowedRoles = UPLOAD_TYPE_ALLOWED_ROLES[uploadType];

  if (!allowedRoles.includes(role)) {
    throw new ForbiddenError(
      `Role ${role} is not allowed to upload ${uploadType}`,
    );
  }
}

/**
 * products — productUpload.middleware
 * Multer configuration for product image and document uploads.
 */
import type { RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../../../shared/errors/app.errors.js";
import {
  PRODUCT_DOCUMENT_FIELD_NAME,
  PRODUCT_IMAGE_FIELD_NAME,
  PRODUCT_MAX_DOCUMENTS,
  PRODUCT_MAX_MEDIA,
} from "../constants/product.constants.js";
import { UPLOAD_MAX_FILE_SIZE_BYTES } from "../../uploads/constants/upload.constants.js";

const productUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_MAX_FILE_SIZE_BYTES,
    files: PRODUCT_MAX_MEDIA + PRODUCT_MAX_DOCUMENTS,
  },
});

function handleMulterError(
  err: unknown,
  _req: Parameters<RequestHandler>[0],
  _res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      next(
        new ValidationError("Validation failed", [
          {
            field: "file",
            message: `File size must not exceed ${UPLOAD_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
          },
        ]),
      );
      return;
    }

    next(
      new ValidationError("Validation failed", [
        { field: "file", message: err.message },
      ]),
    );
    return;
  }

  next(err);
}

export const productFileUpload: RequestHandler = (req, res, next) => {
  productUpload.fields([
    { name: PRODUCT_IMAGE_FIELD_NAME, maxCount: PRODUCT_MAX_MEDIA },
    { name: PRODUCT_DOCUMENT_FIELD_NAME, maxCount: PRODUCT_MAX_DOCUMENTS },
  ])(req, res, (err) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }

    next();
  });
};

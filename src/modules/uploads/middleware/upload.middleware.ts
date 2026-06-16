/**
 * uploads — upload.middleware
 * Multer configuration for in-memory multipart file uploads.
 */
import type { RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../../../shared/errors/app.errors.js";
import {
  UPLOAD_FIELD_NAME,
  UPLOAD_MAX_FILE_SIZE_BYTES,
} from "../constants/upload.constants.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_MAX_FILE_SIZE_BYTES,
    files: 1,
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

export const singleFileUpload: RequestHandler = (req, res, next) => {
  upload.single(UPLOAD_FIELD_NAME)(req, res, (err) => {
    if (err) {
      handleMulterError(err, req, res, next);
      return;
    }

    next();
  });
};

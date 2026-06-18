import type { Request } from "express";
import { ValidationError } from "../../../shared/errors/app.errors.js";
import {
  PRODUCT_DOCUMENT_FIELD_NAME,
  PRODUCT_DOCUMENT_TYPES_FIELD_NAME,
  PRODUCT_IMAGE_FIELD_NAME,
  PRODUCT_MAX_DOCUMENTS,
  PRODUCT_MAX_MEDIA,
} from "../constants/product.constants.js";

export interface ProductUploadFiles {
  images: Express.Multer.File[];
  documents: Express.Multer.File[];
}

export function extractProductUploadFiles(req: Request): ProductUploadFiles {
  const files = req.files as
    | {
        [PRODUCT_IMAGE_FIELD_NAME]?: Express.Multer.File[];
        [PRODUCT_DOCUMENT_FIELD_NAME]?: Express.Multer.File[];
      }
    | undefined;

  return {
    images: files?.[PRODUCT_IMAGE_FIELD_NAME] ?? [],
    documents: files?.[PRODUCT_DOCUMENT_FIELD_NAME] ?? [],
  };
}

export function validateProductDocumentTypes(
  documents: Express.Multer.File[],
  documentTypes: string[] | undefined,
): string[] {
  if (documents.length === 0) {
    return [];
  }

  if (!documentTypes || documentTypes.length === 0) {
    throw new ValidationError("Validation failed", [
      {
        field: PRODUCT_DOCUMENT_TYPES_FIELD_NAME,
        message: "documentTypes is required when uploading documents",
      },
    ]);
  }

  if (documentTypes.length !== documents.length) {
    throw new ValidationError("Validation failed", [
      {
        field: PRODUCT_DOCUMENT_TYPES_FIELD_NAME,
        message: "documentTypes count must match documents count",
      },
    ]);
  }

  if (documents.length > PRODUCT_MAX_DOCUMENTS) {
    throw new ValidationError("Validation failed", [
      {
        field: PRODUCT_DOCUMENT_FIELD_NAME,
        message: `Maximum ${PRODUCT_MAX_DOCUMENTS} documents allowed`,
      },
    ]);
  }

  return documentTypes;
}

export function validateProductImageCount(images: Express.Multer.File[]): void {
  if (images.length > PRODUCT_MAX_MEDIA) {
    throw new ValidationError("Validation failed", [
      {
        field: PRODUCT_IMAGE_FIELD_NAME,
        message: `Maximum ${PRODUCT_MAX_MEDIA} images allowed`,
      },
    ]);
  }
}

/**
 * uploads — uploadBody.schema
 * Zod schemas for multipart upload form fields.
 */
import { z } from "zod";
import {
  DOCUMENT_UPLOAD_TYPES,
  IMAGE_UPLOAD_TYPES,
  UPLOAD_TYPES,
} from "../constants/upload.constants.js";

const uploadTypeEnum = z.enum([
  UPLOAD_TYPES.PRODUCT_IMAGE,
  UPLOAD_TYPES.PRODUCT_DOCUMENT,
  UPLOAD_TYPES.HANDOVER_PROOF,
  UPLOAD_TYPES.DELIVERY_PROOF,
  UPLOAD_TYPES.PROFILE_IMAGE,
]);

export const uploadImageBodySchema = z
  .object({
    uploadType: uploadTypeEnum.refine(
      (value) =>
        (IMAGE_UPLOAD_TYPES as readonly string[]).includes(value),
      "uploadType is not valid for image uploads",
    ),
  })
  .strict();

export const uploadDocumentBodySchema = z
  .object({
    uploadType: uploadTypeEnum.refine(
      (value) =>
        (DOCUMENT_UPLOAD_TYPES as readonly string[]).includes(value),
      "uploadType must be PRODUCT_DOCUMENT for document uploads",
    ),
  })
  .strict();

export type UploadImageBodyInput = z.infer<typeof uploadImageBodySchema>;
export type UploadDocumentBodyInput = z.infer<typeof uploadDocumentBodySchema>;

/**
 * uploads — upload.routes
 * Express router definitions and middleware wiring.
 */
/**
 * @openapi
 * tags:
 *   - name: Uploads
 *     description: File upload management (images and documents)
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as uploadController from "../controllers/upload.controller.js";
import { singleFileUpload } from "../middleware/upload.middleware.js";
import {
  uploadDocumentBodySchema,
  uploadImageBodySchema,
} from "../validators/uploadBody.schema.js";
import { signedUrlQuerySchema } from "../validators/signedUrlQuery.schema.js";
import { uploadIdParamSchema } from "../validators/uploadParams.schema.js";

export const uploadRouter = Router();

/**
 * @openapi
 * /api/v1/uploads/image:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload an image
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, uploadType]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               uploadType:
 *                 type: string
 *                 enum: [PRODUCT_IMAGE, HANDOVER_PROOF, DELIVERY_PROOF, PROFILE_IMAGE]
 *     responses:
 *       201:
 *         description: Image uploaded successfully
 */
uploadRouter.post(
  "/image",
  authenticate,
  authorizePermission(permissions.uploads.create),
  singleFileUpload,
  validate({ body: uploadImageBodySchema }),
  uploadController.uploadImage,
);

/**
 * @openapi
 * /api/v1/uploads/document:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload a document
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, uploadType]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               uploadType:
 *                 type: string
 *                 enum: [PRODUCT_DOCUMENT]
 *     responses:
 *       201:
 *         description: Document uploaded successfully
 */
uploadRouter.post(
  "/document",
  authenticate,
  authorizePermission(permissions.uploads.create),
  singleFileUpload,
  validate({ body: uploadDocumentBodySchema }),
  uploadController.uploadDocument,
);

/**
 * @openapi
 * /api/v1/uploads/{id}/replace:
 *   put:
 *     tags: [Uploads]
 *     summary: Replace an existing upload
 *     security:
 *       - bearerAuth: []
 */
uploadRouter.put(
  "/:id/replace",
  authenticate,
  authorizePermission(permissions.uploads.create),
  validate({ params: uploadIdParamSchema }),
  singleFileUpload,
  uploadController.replaceUpload,
);

/**
 * @openapi
 * /api/v1/uploads/{id}/signed-url:
 *   get:
 *     tags: [Uploads]
 *     summary: Generate a signed URL for an upload
 *     security:
 *       - bearerAuth: []
 */
uploadRouter.get(
  "/:id/signed-url",
  authenticate,
  authorizePermission(permissions.uploads.create),
  validate({ params: uploadIdParamSchema, query: signedUrlQuerySchema }),
  uploadController.getSignedUrl,
);

/**
 * @openapi
 * /api/v1/uploads/{id}:
 *   get:
 *     tags: [Uploads]
 *     summary: Get file metadata
 *     security:
 *       - bearerAuth: []
 */
uploadRouter.get(
  "/:id",
  authenticate,
  authorizePermission(permissions.uploads.create),
  validate({ params: uploadIdParamSchema }),
  uploadController.getFileMetadata,
);

/**
 * @openapi
 * /api/v1/uploads/{id}:
 *   delete:
 *     tags: [Uploads]
 *     summary: Delete an upload
 *     security:
 *       - bearerAuth: []
 */
uploadRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.uploads.delete),
  validate({ params: uploadIdParamSchema }),
  uploadController.deleteUpload,
);

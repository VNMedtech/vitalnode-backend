/**
 * uploads — upload.controller
 * HTTP request handlers — parse input, call service, return response.
 */
import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import { successResponse } from "../../../shared/responses/api.response.js";
import { UploadService } from "../services/upload.service.js";
import type { UploadDocumentBodyInput } from "../validators/uploadBody.schema.js";
import type { SignedUrlQueryInput } from "../validators/signedUrlQuery.schema.js";
import type { UploadIdParam } from "../validators/uploadParams.schema.js";

const uploadService = new UploadService();

function requireAuthenticatedUser(req: Parameters<RequestHandler>[0]): {
  id: string;
  role: UserRole;
} {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
}

export const uploadImage: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { uploadType } = req.body as { uploadType: string };
    const upload = await uploadService.uploadImage(
      actor.id,
      actor.role,
      uploadType as Parameters<UploadService["uploadImage"]>[2],
      req.file,
    );
    res
      .status(201)
      .json(successResponse(upload, "Image uploaded successfully"));
  } catch (err) {
    next(err);
  }
};

export const uploadDocument: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { uploadType } = req.body as UploadDocumentBodyInput;
    const upload = await uploadService.uploadDocument(
      actor.id,
      actor.role,
      uploadType,
      req.file,
    );
    res
      .status(201)
      .json(successResponse(upload, "Document uploaded successfully"));
  } catch (err) {
    next(err);
  }
};

export const getFileMetadata: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as UploadIdParam;
    const metadata = await uploadService.getFileMetadata(
      actor.id,
      actor.role,
      id,
    );
    res
      .status(200)
      .json(successResponse(metadata, "File metadata fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const replaceUpload: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as UploadIdParam;
    const upload = await uploadService.replaceUpload(
      actor.id,
      actor.role,
      id,
      req.file,
    );
    res
      .status(200)
      .json(successResponse(upload, "Upload replaced successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteUpload: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as UploadIdParam;
    const result = await uploadService.deleteUpload(actor.id, actor.role, id);
    res
      .status(200)
      .json(successResponse(result, "Upload deleted successfully"));
  } catch (err) {
    next(err);
  }
};

export const getSignedUrl: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as UploadIdParam;
    const query = req.query as unknown as SignedUrlQueryInput;
    const signedUrl = await uploadService.getSignedUrl(
      actor.id,
      actor.role,
      id,
      query.expiresIn,
    );
    res
      .status(200)
      .json(successResponse(signedUrl, "Signed URL generated successfully"));
  } catch (err) {
    next(err);
  }
};

import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { subAdminService } from "../services/subAdmin.service.js";
import type { CreateSubAdminBody } from "../validators/createSubAdmin.schema.js";
import type {
  DisableSubAdminBody,
  EnableSubAdminBody,
} from "../validators/disableEnableSubAdmin.schema.js";
import type { ListSubAdminsQueryInput } from "../validators/listSubAdminsQuery.schema.js";
import type { SubAdminIdParam } from "../validators/subAdminParams.schema.js";
import type { UpdateSubAdminBody } from "../validators/updateSubAdmin.schema.js";

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listModules: RequestHandler = async (_req, res, next) => {
  try {
    const modules = subAdminService.listModules();
    res
      .status(200)
      .json(successResponse(modules, "Admin modules fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const listSubAdmins: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListSubAdminsQueryInput;
    const result = await subAdminService.listSubAdmins(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Sub-admins fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const createSubAdmin: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateSubAdminBody;
    const subAdmin = await subAdminService.createSubAdmin(actorUserId, body);
    res.status(201).json(
      successResponse(subAdmin, "Sub-admin created successfully"),
    );
  } catch (err) {
    next(err);
  }
};

export const getSubAdminById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as SubAdminIdParam;
    const subAdmin = await subAdminService.getSubAdminById(id);
    res
      .status(200)
      .json(successResponse(subAdmin, "Sub-admin fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateSubAdmin: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SubAdminIdParam;
    const body = req.body as UpdateSubAdminBody;
    const subAdmin = await subAdminService.updateSubAdmin(actorUserId, id, body);
    res
      .status(200)
      .json(successResponse(subAdmin, "Sub-admin updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const disableSubAdmin: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SubAdminIdParam;
    const body = req.body as DisableSubAdminBody;
    const subAdmin = await subAdminService.disableSubAdmin(actorUserId, id, body);
    res
      .status(200)
      .json(successResponse(subAdmin, "Sub-admin disabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const enableSubAdmin: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SubAdminIdParam;
    const body = req.body as EnableSubAdminBody;
    const subAdmin = await subAdminService.enableSubAdmin(actorUserId, id, body);
    res
      .status(200)
      .json(successResponse(subAdmin, "Sub-admin enabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteSubAdmin: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SubAdminIdParam;
    const subAdmin = await subAdminService.deleteSubAdmin(actorUserId, id);
    res
      .status(200)
      .json(successResponse(subAdmin, "Sub-admin deleted successfully"));
  } catch (err) {
    next(err);
  }
};

import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { AdminUserService } from "../services/adminUser.service.js";
import type { AdminUserIdParam } from "../validators/adminUserParams.schema.js";
import type {
  DisableAdminUserBody,
  EnableAdminUserBody,
} from "../validators/disableEnableAdminUser.schema.js";
import type { ListAdminUsersQueryInput } from "../validators/listAdminUsersQuery.schema.js";
import type { UpdateAdminUserBody } from "../validators/updateAdminUser.schema.js";

const adminUserService = new AdminUserService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listAdminUsers: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListAdminUsersQueryInput;
    const result = await adminUserService.listUsers(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Users fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getAdminUserStats: RequestHandler = async (_req, res, next) => {
  try {
    const stats = await adminUserService.getUserStats();
    res
      .status(200)
      .json(successResponse(stats, "User statistics fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getAdminUserById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as AdminUserIdParam;
    const user = await adminUserService.getUserById(id);
    res
      .status(200)
      .json(successResponse(user, "User fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getAdminUserActivity: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as AdminUserIdParam;
    const activity = await adminUserService.getUserActivity(id);
    res
      .status(200)
      .json(successResponse(activity, "User activity fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateAdminUser: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AdminUserIdParam;
    const body = req.body as UpdateAdminUserBody;
    const user = await adminUserService.updateUser(actorUserId, id, body);
    res
      .status(200)
      .json(successResponse(user, "User updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const disableAdminUser: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AdminUserIdParam;
    const body = req.body as DisableAdminUserBody;
    const user = await adminUserService.disableUser(actorUserId, id, body);
    res
      .status(200)
      .json(successResponse(user, "User disabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const enableAdminUser: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AdminUserIdParam;
    const body = req.body as EnableAdminUserBody;
    const user = await adminUserService.enableUser(actorUserId, id, body);
    res
      .status(200)
      .json(successResponse(user, "User enabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteAdminUser: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AdminUserIdParam;
    const user = await adminUserService.softDeleteUser(actorUserId, id);
    res
      .status(200)
      .json(successResponse(user, "User deleted successfully"));
  } catch (err) {
    next(err);
  }
};

export const adminUserController = {
  listAdminUsers,
  getAdminUserStats,
  getAdminUserById,
  getAdminUserActivity,
  updateAdminUser,
  disableAdminUser,
  enableAdminUser,
  deleteAdminUser,
};

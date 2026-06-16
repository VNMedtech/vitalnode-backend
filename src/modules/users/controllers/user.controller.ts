import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import { successResponse } from "../../../shared/responses/api.response.js";
import { UserService } from "../services/user.service.js";

const userService = new UserService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const getCurrentProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const profile = await userService.getCurrentProfile(userId);
    res
      .status(200)
      .json(successResponse(profile, "Profile fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateCurrentProfile: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    const profile = await userService.updateProfile(userId, req.body);
    res
      .status(200)
      .json(successResponse(profile, "Profile updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUserId(req);
    await userService.changePassword(userId, req.body);
    res
      .status(200)
      .json(successResponse({ ok: true }, "Password changed successfully"));
  } catch (err) {
    next(err);
  }
};

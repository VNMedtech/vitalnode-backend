import type { RequestHandler } from "express";
import { successResponse } from "../../../shared/responses/api.response.js";
import { AuthService } from "../services/auth.service.js";

const authService = new AuthService();

function getRequestMeta(req: Parameters<RequestHandler>[0]) {
  const ipAddress =
    (typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]?.trim()
      : undefined) ?? req.ip;

  const userAgent = req.headers["user-agent"];

  return {
    ipAddress,
    userAgent: typeof userAgent === "string" ? userAgent : undefined,
  };
}

export const registerBuyer: RequestHandler = async (req, res, next) => {
  try {
    const meta = getRequestMeta(req);
    const result = await authService.registerBuyer({ ...req.body, ...meta });
    res.status(201).json(successResponse(result, "Buyer registered successfully"));
  } catch (err) {
    next(err);
  }
};

export const registerSeller: RequestHandler = async (req, res, next) => {
  try {
    const meta = getRequestMeta(req);
    const result = await authService.registerSeller({ ...req.body, ...meta });
    res
      .status(201)
      .json(successResponse(result, "Seller registered successfully"));
  } catch (err) {
    next(err);
  }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const meta = getRequestMeta(req);
    const result = await authService.login({ ...req.body, ...meta });
    res.status(200).json(successResponse(result, "Login successful"));
  } catch (err) {
    next(err);
  }
};

export const refreshToken: RequestHandler = async (req, res, next) => {
  try {
    const meta = getRequestMeta(req);
    const result = await authService.refreshToken({ ...req.body, ...meta });
    res.status(200).json(successResponse(result, "Token refreshed successfully"));
  } catch (err) {
    next(err);
  }
};

export const forgotPassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body);
    res
      .status(200)
      .json(
        successResponse(
          { sent: true },
          "If the email exists, a reset link has been sent",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
  try {
    await authService.resetPassword(req.body);
    res.status(200).json(successResponse({ ok: true }, "Password reset successful"));
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    await authService.logout(req.body);
    res.status(200).json(successResponse({ ok: true }, "Logout successful"));
  } catch (err) {
    next(err);
  }
};

/**
 * auth — auth.controller
 * HTTP request handlers — parse input, call service, return response.
 */

export const authController = {};

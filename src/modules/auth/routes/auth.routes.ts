/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Authentication endpoints
 */
import { Router } from "express";
import { authRateLimiter, validate } from "../../../middlewares/index.js";
import * as authController from "../controllers/auth.controller.js";
import { registerBuyerBodySchema } from "../validators/registerBuyer.schema.js";
import { registerSellerBodySchema } from "../validators/registerSeller.schema.js";
import { loginBodySchema } from "../validators/login.schema.js";
import { refreshTokenBodySchema } from "../validators/refreshToken.schema.js";
import { forgotPasswordBodySchema } from "../validators/forgotPassword.schema.js";
import { resetPasswordBodySchema } from "../validators/resetPassword.schema.js";
import { logoutBodySchema } from "../validators/logout.schema.js";

export const authRouter = Router();

/**
 * @openapi
 * /api/v1/auth/register-buyer:
 *   post:
 *     tags: [Auth]
 *     summary: Register a buyer account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName, buyerType]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phoneNumber: { type: string }
 *               buyerType: { type: string, enum: [DOCTOR, HOSPITAL] }
 *     responses:
 *       201:
 *         description: Buyer registered
 */
authRouter.post(
  "/register-buyer",
  authRateLimiter,
  validate({ body: registerBuyerBodySchema }),
  authController.registerBuyer,
);

/**
 * @openapi
 * /api/v1/auth/register-seller:
 *   post:
 *     tags: [Auth]
 *     summary: Register a seller account (pending admin approval)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - businessName
 *               - contactPerson
 *               - addressLine1
 *               - city
 *               - state
 *               - country
 *               - postalCode
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               phoneNumber: { type: string }
 *               businessName: { type: string }
 *               contactPerson: { type: string }
 *               addressLine1: { type: string }
 *               addressLine2: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               country: { type: string }
 *               postalCode: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *     responses:
 *       201:
 *         description: Seller registered
 */
authRouter.post(
  "/register-seller",
  authRateLimiter,
  validate({ body: registerSellerBodySchema }),
  authController.registerSeller,
);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and get access/refresh tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 */
authRouter.post(
  "/login",
  authRateLimiter,
  validate({ body: loginBodySchema }),
  authController.login,
);

/**
 * @openapi
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and issue new access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Token refreshed
 */
authRouter.post(
  "/refresh-token",
  authRateLimiter,
  validate({ body: refreshTokenBodySchema }),
  authController.refreshToken,
);

/**
 * @openapi
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset link
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Request accepted
 */
authRouter.post(
  "/forgot-password",
  authRateLimiter,
  validate({ body: forgotPasswordBodySchema }),
  authController.forgotPassword,
);

/**
 * @openapi
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successful
 */
authRouter.post(
  "/reset-password",
  authRateLimiter,
  validate({ body: resetPasswordBodySchema }),
  authController.resetPassword,
);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout (revoke refresh token session)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logout successful
 */
authRouter.post(
  "/logout",
  authRateLimiter,
  validate({ body: logoutBodySchema }),
  authController.logout,
);

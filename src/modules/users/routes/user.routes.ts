/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: Authenticated user profile management
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as userController from "../controllers/user.controller.js";
import { changePasswordBodySchema } from "../validators/changePassword.schema.js";
import { updateProfileBodySchema } from "../validators/updateProfile.schema.js";

export const userRouter = Router();

/**
 * @openapi
 * /api/v1/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Profile fetched successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     email: { type: string, format: email }
 *                     role: { type: string, enum: [ADMIN, BUYER, SELLER, DELIVERY_PARTNER] }
 *                     status: { type: string, enum: [ACTIVE, DISABLED] }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     phoneNumber: { type: string, nullable: true }
 *                     profileImage: { type: string, nullable: true }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     buyerProfile:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id: { type: string, format: uuid }
 *                         buyerType: { type: string, enum: [DOCTOR, HOSPITAL] }
 *                     sellerProfile:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id: { type: string, format: uuid }
 *                         businessName: { type: string }
 *                         approvalStatus: { type: string }
 *                     deliveryPartnerProfile:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id: { type: string, format: uuid }
 *                         city: { type: string }
 *                         state: { type: string }
 *                         country: { type: string }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
userRouter.get(
  "/me",
  authenticate,
  authorizePermission(permissions.users.readProfile),
  userController.getCurrentProfile,
);

/**
 * @openapi
 * /api/v1/users/me:
 *   patch:
 *     tags: [Users]
 *     summary: Update current user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               firstName: { type: string, minLength: 1, maxLength: 80 }
 *               lastName: { type: string, minLength: 1, maxLength: 80 }
 *               phoneNumber: { type: string, minLength: 8, maxLength: 20, nullable: true }
 *               profileImage: { type: string, format: uri, nullable: true }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Phone number already in use
 */
userRouter.patch(
  "/me",
  authenticate,
  authorizePermission(permissions.users.updateProfile),
  validate({ body: updateProfileBodySchema }),
  userController.updateCurrentProfile,
);

/**
 * @openapi
 * /api/v1/users/me/change-password:
 *   post:
 *     tags: [Users]
 *     summary: Change current user password
 *     description: Requires the current password. All active sessions are revoked after a successful change.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 72
 *                 description: Must include uppercase, lowercase, number, and special character
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Current password is incorrect
 *       403:
 *         description: Forbidden
 */
userRouter.post(
  "/me/change-password",
  authenticate,
  authorizePermission(permissions.users.changePassword),
  validate({ body: changePasswordBodySchema }),
  userController.changePassword,
);

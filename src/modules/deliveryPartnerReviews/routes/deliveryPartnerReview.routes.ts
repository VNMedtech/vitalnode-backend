/**
 * @openapi
 * tags:
 *   - name: Delivery Partner Reviews
 *     description: Buyer ratings and optional moderated comments for delivery partners
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as deliveryPartnerReviewController from "../controllers/deliveryPartnerReview.controller.js";
import { createDeliveryPartnerReviewBodySchema } from "../validators/createDeliveryPartnerReview.schema.js";
import { deliveryPartnerReviewIdParamSchema } from "../validators/deliveryPartnerReviewParams.schema.js";
import {
  listAdminDeliveryPartnerReviewsQuerySchema,
  listMineDeliveryPartnerReviewsQuerySchema,
} from "../validators/query.schema.js";
import { updateDeliveryPartnerReviewBodySchema } from "../validators/updateDeliveryPartnerReview.schema.js";

export const deliveryPartnerReviewRouter = Router();

/**
 * @openapi
 * /api/v1/delivery-partner-reviews:
 *   get:
 *     tags: [Delivery Partner Reviews]
 *     summary: List delivery partner reviews (admin)
 *     description: |
 *       Admin only. Paginated moderation list with optional filters by
 *       commentStatus, deliveryPartnerId, buyerId, and orderId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: commentStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DISABLED]
 *       - in: query
 *         name: deliveryPartnerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: buyerId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: orderId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated admin review list
 */
deliveryPartnerReviewRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.deliveryPartnerReviews.manage),
  validate({ query: listAdminDeliveryPartnerReviewsQuerySchema }),
  deliveryPartnerReviewController.listAdminDeliveryPartnerReviews,
);

/**
 * @openapi
 * /api/v1/delivery-partner-reviews/mine:
 *   get:
 *     tags: [Delivery Partner Reviews]
 *     summary: List own ratings for authenticated delivery partner
 *     description: |
 *       Delivery-partner only. Returns all non-DISABLED reviews for the authenticated
 *       partner (individual star ratings, newest first), with order summary.
 *       Comment text is included only when `commentStatus` is APPROVED; otherwise
 *       `comment` is null. Buyer identity is not included. DISABLED reviews are omitted.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated partner-visible ratings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required: [id, rating, comment, createdAt, order]
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *                       comment:
 *                         type: string
 *                         nullable: true
 *                         description: Present only when the comment is APPROVED
 *                         example: Delivery was careful with the package.
 *                       createdAt: { type: string, format: date-time }
 *                       order:
 *                         type: object
 *                         required: [id, orderNumber]
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           orderNumber: { type: string, example: ORD-1001 }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 20 }
 *                     total: { type: integer, example: 1 }
 *                     totalPages: { type: integer, example: 1 }
 *       403:
 *         description: Delivery partner profile required
 */
deliveryPartnerReviewRouter.get(
  "/mine",
  authenticate,
  authorizePermission(permissions.deliveryPartnerReviews.read),
  validate({ query: listMineDeliveryPartnerReviewsQuerySchema }),
  deliveryPartnerReviewController.listMineDeliveryPartnerReviews,
);

/**
 * @openapi
 * /api/v1/delivery-partner-reviews:
 *   post:
 *     tags: [Delivery Partner Reviews]
 *     summary: Create delivery partner review
 *     description: |
 *       Buyer only. Rates the final delivery partner on a delivered INTERNAL_DP order.
 *       One review per order. Stars are live immediately; optional comments start as PENDING.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, rating]
 *             properties:
 *               orderId: { type: string, format: uuid }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, maxLength: 2000 }
 *     responses:
 *       201:
 *         description: Review created successfully
 *       403:
 *         description: Not eligible (not delivered, no partner, or disabled)
 *       404:
 *         description: Order not found
 *       409:
 *         description: Duplicate review for this order
 */
deliveryPartnerReviewRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.deliveryPartnerReviews.create),
  validate({ body: createDeliveryPartnerReviewBodySchema }),
  deliveryPartnerReviewController.createDeliveryPartnerReview,
);

/**
 * @openapi
 * /api/v1/delivery-partner-reviews/{reviewId}:
 *   patch:
 *     tags: [Delivery Partner Reviews]
 *     summary: Update own delivery partner review
 *     description: |
 *       Buyer only. May edit rating and/or comment while the review is not DISABLED.
 *       Editing comment text after APPROVED re-sets commentStatus to PENDING.
 *       Clearing comment sets comment and commentStatus to null.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string, nullable: true, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       403:
 *         description: Not owner or review disabled
 *       404:
 *         description: Review not found
 */
deliveryPartnerReviewRouter.patch(
  "/:reviewId",
  authenticate,
  authorizePermission(permissions.deliveryPartnerReviews.update),
  validate({
    params: deliveryPartnerReviewIdParamSchema,
    body: updateDeliveryPartnerReviewBodySchema,
  }),
  deliveryPartnerReviewController.updateDeliveryPartnerReview,
);

/**
 * @openapi
 * /api/v1/delivery-partner-reviews/{reviewId}/approve:
 *   post:
 *     tags: [Delivery Partner Reviews]
 *     summary: Approve pending delivery partner review comment
 *     description: |
 *       Admin only. Transitions commentStatus from PENDING to APPROVED.
 *       Only reviews with a comment can be approved.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Comment approved
 *       404:
 *         description: Review not found
 *       409:
 *         description: Already approved, disabled, or no comment
 */
deliveryPartnerReviewRouter.post(
  "/:reviewId/approve",
  authenticate,
  authorizePermission(permissions.deliveryPartnerReviews.manage),
  validate({ params: deliveryPartnerReviewIdParamSchema }),
  deliveryPartnerReviewController.approveDeliveryPartnerReview,
);

/**
 * @openapi
 * /api/v1/delivery-partner-reviews/{reviewId}/disable:
 *   post:
 *     tags: [Delivery Partner Reviews]
 *     summary: Disable delivery partner review
 *     description: |
 *       Admin only. Sets commentStatus to DISABLED. Excludes the review from
 *       partner comment feeds and from rating aggregates. Buyer cannot edit afterward.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Review disabled
 *       404:
 *         description: Review not found
 *       409:
 *         description: Already disabled
 */
deliveryPartnerReviewRouter.post(
  "/:reviewId/disable",
  authenticate,
  authorizePermission(permissions.deliveryPartnerReviews.manage),
  validate({ params: deliveryPartnerReviewIdParamSchema }),
  deliveryPartnerReviewController.disableDeliveryPartnerReview,
);

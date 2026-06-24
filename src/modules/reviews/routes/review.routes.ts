/**
 * @openapi
 * tags:
 *   - name: Reviews
 *     description: Product reviews and ratings
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as reviewController from "../controllers/review.controller.js";
import { createReviewBodySchema } from "../validators/createReview.schema.js";
import {
  listAdminReviewsQuerySchema,
  listFeaturedReviewsQuerySchema,
} from "../validators/query.schema.js";
import { reviewIdParamSchema } from "../validators/reviewParams.schema.js";
import { updateReviewBodySchema } from "../validators/updateReview.schema.js";

export const reviewRouter = Router();

/**
 * @openapi
 * /api/v1/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Create product review
 *     description: |
 *       Buyer only. Creates a review for a purchased product from a delivered order.
 *       One review per buyer per product.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, rating, title, comment]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               title: { type: string, maxLength: 120 }
 *               comment: { type: string, maxLength: 2000 }
 *     responses:
 *       201:
 *         description: Review created successfully
 *       403:
 *         description: Product not purchased or order not delivered
 *       409:
 *         description: Duplicate review
 */
reviewRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.reviews.create),
  validate({ body: createReviewBodySchema }),
  reviewController.createReview,
);

/**
 * @openapi
 * /api/v1/reviews/featured:
 *   get:
 *     tags: [Reviews]
 *     summary: List featured reviews
 *     description: |
 *       Public endpoint. Returns top-rated active reviews from approved products
 *       plus platform-wide review statistics.
 */
reviewRouter.get(
  "/featured",
  validate({ query: listFeaturedReviewsQuerySchema }),
  reviewController.listFeaturedReviews,
);

/**
 * @openapi
 * /api/v1/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: List reviews (admin)
 *     description: Admin-only paginated review list with optional filters.
 *     security:
 *       - bearerAuth: []
 */
reviewRouter.get(
  "/",
  authenticate,
  authorizePermission(permissions.reviews.manage),
  validate({ query: listAdminReviewsQuerySchema }),
  reviewController.listAdminReviews,
);

/**
 * @openapi
 * /api/v1/reviews/{reviewId}:
 *   patch:
 *     tags: [Reviews]
 *     summary: Update own review
 *     security:
 *       - bearerAuth: []
 */
reviewRouter.patch(
  "/:reviewId",
  authenticate,
  authorizePermission(permissions.reviews.update),
  validate({
    params: reviewIdParamSchema,
    body: updateReviewBodySchema,
  }),
  reviewController.updateReview,
);

/**
 * @openapi
 * /api/v1/reviews/{reviewId}:
 *   delete:
 *     tags: [Reviews]
 *     summary: Delete own review
 *     security:
 *       - bearerAuth: []
 */
reviewRouter.delete(
  "/:reviewId",
  authenticate,
  authorizePermission(permissions.reviews.delete),
  validate({ params: reviewIdParamSchema }),
  reviewController.deleteReview,
);

/**
 * @openapi
 * /api/v1/reviews/{reviewId}/disable:
 *   post:
 *     tags: [Reviews]
 *     summary: Disable inappropriate review
 *     description: Admin only. Hides a review from public product listings.
 *     security:
 *       - bearerAuth: []
 */
reviewRouter.post(
  "/:reviewId/disable",
  authenticate,
  authorizePermission(permissions.reviews.manage),
  validate({ params: reviewIdParamSchema }),
  reviewController.disableReview,
);

import { describe, expect, it } from "vitest";
import {
  formatPartnerAverageRating,
  toPartnerDeliveryPartnerReviewDto,
} from "../../../src/modules/deliveryPartnerReviews/dto/deliveryPartnerReview.dto.js";
import { DeliveryPartnerCommentStatus } from "../../../src/shared/enums/deliveryPartnerCommentStatus.enum.js";

const baseRecord = {
  id: "rev-1",
  orderId: "ord-1",
  deliveryPartnerId: "dp-1",
  buyerId: "buyer-1",
  rating: 5,
  createdAt: new Date("2026-08-01T08:00:00.000Z"),
  updatedAt: new Date("2026-08-01T08:00:00.000Z"),
  order: {
    id: "ord-1",
    orderNumber: "ORD-1001",
  },
};

describe("Delivery partner review DTO helpers", () => {
  it("formats average rating to one decimal place", () => {
    expect(formatPartnerAverageRating(4.3333)).toBe(4.3);
    expect(formatPartnerAverageRating(4.55)).toBe(4.6);
  });

  it("returns null when there is no average", () => {
    expect(formatPartnerAverageRating(null)).toBeNull();
  });

  it("includes comment text only when approved and omits buyer", () => {
    const approved = toPartnerDeliveryPartnerReviewDto({
      ...baseRecord,
      comment: "Great delivery",
      commentStatus: DeliveryPartnerCommentStatus.APPROVED,
    });
    expect(approved.comment).toBe("Great delivery");
    expect(approved.order.orderNumber).toBe("ORD-1001");
    expect(approved).not.toHaveProperty("buyer");

    const pending = toPartnerDeliveryPartnerReviewDto({
      ...baseRecord,
      comment: "Still pending",
      commentStatus: DeliveryPartnerCommentStatus.PENDING,
    });
    expect(pending.comment).toBeNull();
    expect(pending.rating).toBe(5);

    const ratingOnly = toPartnerDeliveryPartnerReviewDto({
      ...baseRecord,
      comment: null,
      commentStatus: null,
    });
    expect(ratingOnly.comment).toBeNull();
  });
});

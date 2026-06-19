import { describe, expect, it } from "vitest";
import { toProductReviewStats } from "../../../src/modules/reviews/dto/review.dto.js";

describe("Review DTO helpers", () => {
  it("formats average rating to one decimal place", () => {
    expect(
      toProductReviewStats({ averageRating: 4.3333, reviewCount: 3 }),
    ).toEqual({
      averageRating: "4.3",
      reviewCount: 3,
    });
  });

  it("returns null average when there are no reviews", () => {
    expect(
      toProductReviewStats({ averageRating: null, reviewCount: 0 }),
    ).toEqual({
      averageRating: null,
      reviewCount: 0,
    });
  });
});

export const deliveryPartnerReviewCreationPayload = (
  orderId: string,
  overrides: Record<string, unknown> = {},
) => ({
  orderId,
  rating: 5,
  comment: "Delivery was on time and careful with the package.",
  ...overrides,
});

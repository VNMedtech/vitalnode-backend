export const reviewCreationPayload = (
  productId: string,
  overrides: Record<string, unknown> = {},
) => ({
  productId,
  rating: 5,
  title: "Excellent product",
  comment: "Works as expected and arrived on time.",
  ...overrides,
});

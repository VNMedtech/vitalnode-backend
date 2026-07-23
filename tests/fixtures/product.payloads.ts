export function productCreationPayload(
  categoryId: string,
  overrides: Record<string, unknown> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    categoryIds: [categoryId],
    productName: `Portable Ultrasound Scanner ${unique}`,
    brand: "Siemens",
    model: "ACUSON P500",
    pricing: "125000.00",
    moq: 1,
    description:
      "High-quality portable ultrasound for point-of-care imaging.",
    ...overrides,
  };
}

export function productCreationPayload(
  categoryId: string,
  overrides: Record<string, unknown> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    categoryId,
    productName: `Portable Ultrasound Scanner ${unique}`,
    brand: "Siemens",
    model: "ACUSON P500",
    productType: "Diagnostic Device",
    pricing: "125000.00",
    moq: 1,
    description:
      "High-quality portable ultrasound for point-of-care imaging.",
    deliveryTime: 7,
    ...overrides,
  };
}

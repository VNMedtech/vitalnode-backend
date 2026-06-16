export function categoryCreationPayload(
  overrides: Record<string, unknown> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `Diagnostic Imaging ${unique}`,
    description: "MRI, CT, and ultrasound equipment",
    ...overrides,
  };
}

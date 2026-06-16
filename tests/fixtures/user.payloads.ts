export const WEAK_PASSWORD = "short";
export const STRONG_NEW_PASSWORD = "ChangedPass6!";

export function profileUpdatePayload(
  overrides: Record<string, unknown> = {},
) {
  return {
    firstName: "Updated",
    lastName: "Name",
    ...overrides,
  };
}

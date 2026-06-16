export function addressCreationPayload(
  overrides: Record<string, unknown> = {},
) {
  const unique = Math.random().toString(36).slice(2, 6);
  return {
    recipientName: "Dr. Jane Smith",
    phoneNumber: "+919876543210",
    addressLine1: `42 Medical Lane ${unique}`,
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    postalCode: "400001",
    ...overrides,
  };
}

export function sellerAddressCreationPayload(
  overrides: Record<string, unknown> = {},
) {
  const unique = Math.random().toString(36).slice(2, 6);
  return {
    label: `Warehouse ${unique}`,
    contactPerson: "Warehouse Manager",
    phone: "+919876543210",
    addressLine1: `88 Depot Road ${unique}`,
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    postalCode: "400069",
    ...overrides,
  };
}

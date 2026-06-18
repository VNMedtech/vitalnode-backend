export function deliveryPartnerCreationPayload(
  overrides: Record<string, unknown> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `dp-${unique}@logistics.example`,
    firstName: "Ravi",
    lastName: "Kumar",
    phoneNumber: `+9198765${unique.replace(/\D/g, "").slice(-5).padStart(5, "0")}`,
    addressLine1: "12 Transport Nagar",
    addressLine2: "Block B",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    postalCode: "400001",
    ...overrides,
  };
}

export function cancelOrderPayload(
  orderId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    orderId,
    reason: "Test cancellation",
    ...overrides,
  };
}

export function assignDeliveryPartnerPayload(
  deliveryPartnerId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    deliveryPartnerId,
    ...overrides,
  };
}

export function invalidOrderUuid(): string {
  return "00000000-0000-4000-8000-000000000099";
}

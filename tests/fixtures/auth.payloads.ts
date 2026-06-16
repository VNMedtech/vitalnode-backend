import { BuyerType } from "../../generated/prisma/client.js";

export const DEFAULT_PASSWORD = "SecurePass1!";

export function buyerRegistrationPayload(
  overrides: Record<string, unknown> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `buyer-${unique}@example.com`,
    password: DEFAULT_PASSWORD,
    firstName: "Test",
    lastName: "Buyer",
    buyerType: BuyerType.DOCTOR,
    ...overrides,
  };
}

export function sellerRegistrationPayload(
  overrides: Record<string, unknown> = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `seller-${unique}@example.com`,
    password: DEFAULT_PASSWORD,
    firstName: "Test",
    lastName: "Seller",
    businessName: "MedEquip Co",
    contactPerson: "Test Seller",
    addressLine1: "123 Medical Ave",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    postalCode: "400001",
    ...overrides,
  };
}

export function loginPayload(email: string, password = DEFAULT_PASSWORD) {
  return { email, password };
}

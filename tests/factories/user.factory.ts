import type { PrismaClient } from "../../generated/prisma/client.js";
import { SellerApprovalStatus } from "../../src/shared/enums/sellerApprovalStatus.enum.js";
import { UserRole } from "../../src/shared/enums/userRole.enum.js";
import { UserStatus } from "../../src/shared/enums/userStatus.enum.js";
import { hashPassword } from "../../src/utils/password.util.js";
import {
  buyerRegistrationPayload,
  DEFAULT_PASSWORD,
  sellerRegistrationPayload,
} from "../fixtures/auth.payloads.js";
import { authRequest, extractAuthData } from "../utils/request.helpers.js";
import type { Express } from "express";

export async function registerBuyerViaApi(
  app: Express,
  overrides: Record<string, unknown> = {},
) {
  const payload = buyerRegistrationPayload(overrides);
  const res = await authRequest(app).registerBuyer(payload);

  return {
    response: res,
    payload,
    auth: extractAuthData(res.body),
  };
}

export async function registerSellerViaApi(
  app: Express,
  overrides: Record<string, unknown> = {},
) {
  const payload = sellerRegistrationPayload(overrides);
  const res = await authRequest(app).registerSeller(payload);

  return {
    response: res,
    payload,
    auth: extractAuthData(res.body),
  };
}

export async function createAdminViaApi(
  app: Express,
  prisma: PrismaClient,
  overrides: { email?: string; password?: string } = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = overrides.email ?? `admin-${unique}@example.com`;

  const user = await createUserWithPassword(prisma, {
    email,
    password: overrides.password ?? DEFAULT_PASSWORD,
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });

  const login = await loginViaApi(app, email, overrides.password);
  return { user, login };
}

export async function loginViaApi(
  app: Express,
  email: string,
  password = DEFAULT_PASSWORD,
) {
  const res = await authRequest(app).login({ email, password });
  return {
    response: res,
    auth: extractAuthData(res.body),
  };
}

export async function setSellerApprovalStatus(
  prisma: PrismaClient,
  userId: string,
  approvalStatus: SellerApprovalStatus,
) {
  return prisma.sellerProfile.update({
    where: { userId },
    data: { approvalStatus },
  });
}

export async function setUserStatus(
  prisma: PrismaClient,
  userId: string,
  status: UserStatus,
) {
  return prisma.user.update({
    where: { id: userId },
    data: { status },
  });
}

export async function createApprovedSeller(
  app: Express,
  prisma: PrismaClient,
  overrides: Record<string, unknown> = {},
) {
  const registered = await registerSellerViaApi(app, overrides);
  await setSellerApprovalStatus(
    prisma,
    registered.auth.user.id,
    SellerApprovalStatus.ACTIVE,
  );

  const login = await loginViaApi(app, registered.payload.email as string);
  return { ...registered, login };
}

export async function createDisabledSeller(
  app: Express,
  prisma: PrismaClient,
  overrides: Record<string, unknown> = {},
) {
  const registered = await registerSellerViaApi(app, overrides);
  await setSellerApprovalStatus(
    prisma,
    registered.auth.user.id,
    SellerApprovalStatus.DISABLED,
  );

  const login = await loginViaApi(app, registered.payload.email as string);
  return { ...registered, login };
}

export async function createUserWithPassword(
  prisma: PrismaClient,
  input: {
    email: string;
    password?: string;
    role?: UserRole;
    status?: UserStatus;
    phoneNumber?: string;
    mustChangePassword?: boolean;
  },
) {
  const passwordHash = await hashPassword(input.password ?? DEFAULT_PASSWORD);

  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role ?? UserRole.BUYER,
      status: input.status ?? UserStatus.ACTIVE,
      firstName: "Factory",
      lastName: "User",
      phoneNumber: input.phoneNumber,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });
}

export async function createDeliveryPartnerUser(
  prisma: PrismaClient,
  overrides: {
    email?: string;
    password?: string;
    mustChangePassword?: boolean;
  } = {},
) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = overrides.email ?? `dp-${unique}@example.com`;
  const passwordHash = await hashPassword(
    overrides.password ?? DEFAULT_PASSWORD,
  );

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.DELIVERY_PARTNER,
      status: UserStatus.ACTIVE,
      mustChangePassword: overrides.mustChangePassword ?? true,
      firstName: "Delivery",
      lastName: "Partner",
      deliveryPartnerProfile: {
        create: {
          addressLine1: "1 Logistics Way",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          postalCode: "400001",
        },
      },
    },
    include: { deliveryPartnerProfile: true },
  });
}

export async function loginDeliveryPartnerViaApi(
  app: Express,
  email: string,
  password = DEFAULT_PASSWORD,
) {
  return loginViaApi(app, email, password);
}

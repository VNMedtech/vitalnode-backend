import { beforeEach, describe, expect, it, vi } from "vitest";
import { NOTIFICATION_EVENTS, NOTIFICATION_TYPES } from "../../../src/modules/notifications/constants/notification.constants.js";
import { emitProductDecisionNotification } from "../../../src/modules/products/services/productApproval.service.js";
import type { SellerRepository } from "../../../src/modules/sellers/repositories/seller.repository.js";

const emitMock = vi.fn();
const createInAppMock = vi.fn();

vi.mock("../../../src/modules/notifications/index.js", () => ({
  NOTIFICATION_EVENTS: {
    PRODUCT_APPROVED: "PRODUCT_APPROVED",
    PRODUCT_REJECTED: "PRODUCT_REJECTED",
  },
  NOTIFICATION_TYPES: {
    PRODUCT_APPROVED: "PRODUCT_APPROVED",
    PRODUCT_REJECTED: "PRODUCT_REJECTED",
  },
  notificationDispatcher: {
    emit: (...args: unknown[]) => emitMock(...args),
    createInApp: (...args: unknown[]) => createInAppMock(...args),
  },
}));

function buildSellerRepo(
  result: Awaited<ReturnType<SellerRepository["findById"]>>,
): SellerRepository {
  return {
    findById: vi.fn().mockResolvedValue(result),
  } as unknown as SellerRepository;
}

describe("emitProductDecisionNotification", () => {
  beforeEach(() => {
    emitMock.mockClear();
    createInAppMock.mockClear();
  });

  it("emits in-app and email notifications when seller email is available", async () => {
    const sellerRepo = buildSellerRepo({
      id: "seller-1",
      userId: "user-1",
      businessName: "Acme Medical",
      contactPerson: "Jane Doe",
      city: "Mumbai",
      state: "MH",
      country: "IN",
      approvalStatus: "ACTIVE",
      commissionPercentage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      addressLine1: "123 Main St",
      addressLine2: null,
      postalCode: "400001",
      latitude: null,
      longitude: null,
      documents: [],
      user: {
        id: "user-1",
        email: "seller@example.com",
        firstName: "Jane",
        lastName: "Doe",
        phoneNumber: null,
        status: "ACTIVE",
      },
    });

    await emitProductDecisionNotification(
      "product-1",
      "seller-1",
      "Portable Ultrasound",
      "approve",
      undefined,
      sellerRepo,
    );

    expect(emitMock).toHaveBeenCalledOnce();
    expect(createInAppMock).not.toHaveBeenCalled();
    expect(emitMock.mock.calls[0]![0]).toMatchObject({
      eventType: NOTIFICATION_EVENTS.PRODUCT_APPROVED,
      correlationId: "product-1",
      inApp: {
        userId: "user-1",
        type: NOTIFICATION_TYPES.PRODUCT_APPROVED,
      },
      email: {
        to: "seller@example.com",
        productName: "Portable Ultrasound",
      },
    });
  });

  it("creates in-app notification only when seller email is unavailable", async () => {
    const sellerRepo = buildSellerRepo({
      id: "seller-1",
      userId: "user-1",
      businessName: "Acme Medical",
      contactPerson: "Jane Doe",
      city: "Mumbai",
      state: "MH",
      country: "IN",
      approvalStatus: "ACTIVE",
      commissionPercentage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      addressLine1: "123 Main St",
      addressLine2: null,
      postalCode: "400001",
      latitude: null,
      longitude: null,
      documents: [],
      user: {
        id: "user-1",
        email: "",
        firstName: "Jane",
        lastName: "Doe",
        phoneNumber: null,
        status: "ACTIVE",
      },
    });

    await emitProductDecisionNotification(
      "product-1",
      "seller-1",
      "Portable Ultrasound",
      "reject",
      "Incomplete documentation",
      sellerRepo,
    );

    expect(createInAppMock).toHaveBeenCalledOnce();
    expect(emitMock).not.toHaveBeenCalled();
    expect(createInAppMock.mock.calls[0]![0]).toMatchObject({
      userId: "user-1",
      type: NOTIFICATION_TYPES.PRODUCT_REJECTED,
      message: expect.stringContaining("Incomplete documentation"),
    });
  });

  it("skips notifications when seller profile cannot be resolved", async () => {
    const sellerRepo = buildSellerRepo(null);

    await emitProductDecisionNotification(
      "product-1",
      "seller-1",
      "Portable Ultrasound",
      "approve",
      undefined,
      sellerRepo,
    );

    expect(emitMock).not.toHaveBeenCalled();
    expect(createInAppMock).not.toHaveBeenCalled();
  });
});

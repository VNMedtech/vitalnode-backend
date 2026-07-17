import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sellerAddressCreationPayload } from "../../fixtures/sellerAddress.payloads.js";
import {
  createAdminViaApi,
  createApprovedSeller,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import {
  sellerAddressRequest,
  sellerRequest,
} from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("SellerAddresses — Warehouse pickup addresses", () => {
  let app: Express;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("lists the default warehouse created at seller registration", async () => {
    const seller = await createApprovedSeller(app, getTestPrisma());

    const res = await sellerAddressRequest(
      app,
      seller.login.auth.accessToken,
    ).list();

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.some((a: { isDefault: boolean }) => a.isDefault)).toBe(
      true,
    );
  });

  it("creates an additional warehouse and can set it as default", async () => {
    const seller = await createApprovedSeller(app, getTestPrisma());
    const token = seller.login.auth.accessToken;

    const createRes = await sellerAddressRequest(app, token).create(
      sellerAddressCreationPayload({ label: "Secondary depot" }),
    );
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.label).toBe("Secondary depot");

    const setDefaultRes = await sellerAddressRequest(app, token).setDefault(
      createRes.body.data.id,
    );
    expect(setDefaultRes.status).toBe(200);
    expect(setDefaultRes.body.data.isDefault).toBe(true);

    const listRes = await sellerAddressRequest(app, token).list();
    const defaults = listRes.body.data.filter(
      (a: { isDefault: boolean }) => a.isDefault,
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(createRes.body.data.id);
  });

  it("prevents accessing another seller's warehouse", async () => {
    const prisma = getTestPrisma();
    const sellerA = await createApprovedSeller(app, prisma);
    const sellerB = await createApprovedSeller(app, prisma);

    const listA = await sellerAddressRequest(
      app,
      sellerA.login.auth.accessToken,
    ).list();
    const addressId = listA.body.data[0].id as string;

    const res = await sellerAddressRequest(
      app,
      sellerB.login.auth.accessToken,
    ).getById(addressId);

    expect(res.status).toBe(404);
  });

  it("rejects disabling the last active warehouse", async () => {
    const seller = await createApprovedSeller(app, getTestPrisma());
    const token = seller.login.auth.accessToken;
    const listRes = await sellerAddressRequest(app, token).list({
      isActive: "true",
    });
    expect(listRes.body.data).toHaveLength(1);

    const res = await sellerAddressRequest(app, token).disable(
      listRes.body.data[0].id,
    );
    expect(res.status).toBe(409);
  });

  it("allows admin to list seller warehouses", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);
    const admin = await createAdminViaApi(app, prisma);

    const profile = await prisma.sellerProfile.findUniqueOrThrow({
      where: { userId: seller.auth.user.id },
      select: { id: true },
    });

    const res = await sellerRequest(
      app,
      admin.login.auth.accessToken,
    ).listAddresses(profile.id);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });
});

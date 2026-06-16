import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addressCreationPayload } from "../../fixtures/address.payloads.js";
import {
  createApprovedSeller,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { addressRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Addresses — Buyer Shipping Addresses", () => {
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

  it("1. creates an address with first as default", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const payload = addressCreationPayload();

    const res = await addressRequest(app, auth.accessToken).create(payload);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Address created successfully");
    expect(res.body.data.isDefault).toBe(true);
    expect(res.body.data.recipientName).toBe(payload.recipientName);
  });

  it("2. lists buyer addresses", async () => {
    const { auth } = await registerBuyerViaApi(app);
    await addressRequest(app, auth.accessToken).create(
      addressCreationPayload({ addressLine1: "1 Clinic Road" }),
    );
    await addressRequest(app, auth.accessToken).create(
      addressCreationPayload({ addressLine1: "2 Hospital Ave" }),
    );

    const res = await addressRequest(app, auth.accessToken).list();

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it("3. returns address details by id", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const createRes = await addressRequest(app, auth.accessToken).create(
      addressCreationPayload(),
    );
    const addressId = createRes.body.data.id;

    const res = await addressRequest(app, auth.accessToken).getById(addressId);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(addressId);
  });

  it("4. updates an address", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const createRes = await addressRequest(app, auth.accessToken).create(
      addressCreationPayload(),
    );

    const res = await addressRequest(app, auth.accessToken).update(
      createRes.body.data.id,
      { city: "Pune", state: "Maharashtra" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe("Pune");
  });

  it("5. sets a different address as default", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const first = await addressRequest(app, auth.accessToken).create(
      addressCreationPayload({ addressLine1: "First Address" }),
    );
    const second = await addressRequest(app, auth.accessToken).create(
      addressCreationPayload({ addressLine1: "Second Address", isDefault: false }),
    );

    const res = await addressRequest(app, auth.accessToken).setDefault(
      second.body.data.id,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.isDefault).toBe(true);

    const firstRes = await addressRequest(app, auth.accessToken).getById(
      first.body.data.id,
    );
    expect(firstRes.body.data.isDefault).toBe(false);
  });

  it("6. deletes an address", async () => {
    const { auth } = await registerBuyerViaApi(app);
    const createRes = await addressRequest(app, auth.accessToken).create(
      addressCreationPayload(),
    );

    const deleteRes = await addressRequest(app, auth.accessToken).delete(
      createRes.body.data.id,
    );

    expect(deleteRes.status).toBe(200);

    const getRes = await addressRequest(app, auth.accessToken).getById(
      createRes.body.data.id,
    );
    expect(getRes.status).toBe(404);
  });

  it("7. denies seller access with 403", async () => {
    const prisma = getTestPrisma();
    const seller = await createApprovedSeller(app, prisma);

    const res = await addressRequest(app, seller.login.auth.accessToken).list();

    expect(res.status).toBe(403);
  });

  it("8. prevents cross-buyer address access", async () => {
    const buyerA = await registerBuyerViaApi(app);
    const buyerB = await registerBuyerViaApi(app);
    const createRes = await addressRequest(
      app,
      buyerA.auth.accessToken,
    ).create(addressCreationPayload());

    const res = await addressRequest(
      app,
      buyerB.auth.accessToken,
    ).getById(createRes.body.data.id);

    expect(res.status).toBe(404);
  });
});

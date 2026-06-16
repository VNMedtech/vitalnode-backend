import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { categoryCreationPayload } from "../../fixtures/category.payloads.js";
import { createCategoryViaApi } from "../../factories/commerce.factory.js";
import {
  createAdminViaApi,
  registerBuyerViaApi,
} from "../../factories/user.factory.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { categoryRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Categories — CRUD & Access Control", () => {
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

  it("1. lists active categories publicly", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    await createCategoryViaApi(app, adminLogin.auth.accessToken, {
      name: "Surgical Instruments",
    });
    await createCategoryViaApi(app, adminLogin.auth.accessToken, {
      name: "Patient Monitoring",
    });

    const res = await categoryRequest(app).list({ sortBy: "name", sortOrder: "asc" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it("2. returns category details by id", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );

    const res = await categoryRequest(app).getById(category.id);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: category.id,
      name: category.name,
      isActive: true,
    });
  });

  it("3. allows admin to create a category", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const payload = categoryCreationPayload();

    const res = await categoryRequest(app, adminLogin.auth.accessToken).create(
      payload,
    );

    expect(res.status).toBe(201);
    expect(res.body.message).toBe("Category created successfully");
    expect(res.body.data.name).toBe(payload.name);
  });

  it("4. allows admin to update a category", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );

    const res = await categoryRequest(app, adminLogin.auth.accessToken).update(
      category.id,
      { name: "Updated Category Name", description: "Updated description" },
    );

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Category Name");
    expect(res.body.data.description).toBe("Updated description");
  });

  it("5. soft-deletes a category via disable", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );

    const disableRes = await categoryRequest(
      app,
      adminLogin.auth.accessToken,
    ).disable(category.id);

    expect(disableRes.status).toBe(200);
    expect(disableRes.body.data.isActive).toBe(false);

    const listRes = await categoryRequest(app).list();
    expect(listRes.body.data).toHaveLength(0);

    const getRes = await categoryRequest(app).getById(category.id);
    expect(getRes.status).toBe(404);
  });

  it("6. rejects duplicate category names with 409", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const payload = categoryCreationPayload({ name: "Unique Category" });
    await categoryRequest(app, adminLogin.auth.accessToken).create(payload);

    const res = await categoryRequest(app, adminLogin.auth.accessToken).create(
      payload,
    );

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("7. denies non-admin create with 403", async () => {
    const { auth } = await registerBuyerViaApi(app);

    const res = await categoryRequest(app, auth.accessToken).create(
      categoryCreationPayload(),
    );

    expect(res.status).toBe(403);
  });

  it("8. returns 404 for unknown category id", async () => {
    const res = await categoryRequest(app).getById(
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(res.status).toBe(404);
  });
});

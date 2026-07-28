import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCategoryViaApi,
  createTemplateViaApi,
} from "../../factories/commerce.factory.js";
import {
  createAdminViaApi,
  createApprovedSeller,
} from "../../factories/user.factory.js";
import {
  productTemplateCreationPayload,
  sampleBaseDefaults,
} from "../../fixtures/productTemplate.payloads.js";
import {
  disconnectTestPrisma,
  getTestPrisma,
  resetDatabase,
} from "../../utils/db.js";
import { productTemplateRequest } from "../../utils/request.helpers.js";
import { getTestApp } from "../../utils/testApp.js";

describe("Product Templates", () => {
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

  it("creates, lists, searches, and updates templates", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);

    const createRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(productTemplateCreationPayload([category.id]));

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.fields.length).toBeGreaterThan(0);
    expect(createRes.body.data.categories[0].id).toBe(category.id);
    expect(createRes.body.data.baseDefaults).toBeNull();

    const templateId = createRes.body.data.id as string;

    const listRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ categoryId: category.id });
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].baseDefaults).toBeNull();

    const searchRes = await productTemplateRequest(
      app,
      seller.login.auth.accessToken,
    ).search({ categoryIds: [category.id] });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data).toHaveLength(1);
    expect(searchRes.body.data[0].id).toBe(templateId);
    expect(searchRes.body.data[0]).toHaveProperty("baseDefaults");

    const updateRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).update(templateId, { description: "Updated blueprint" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.description).toBe("Updated blueprint");

    const replaceFields = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).replaceFields(templateId, {
      fields: [
        {
          key: "warrantyPeriod",
          label: "Warranty (months)",
          fieldType: "NUMBER",
          defaultValue: 12,
          sortOrder: 0,
        },
      ],
    });
    expect(replaceFields.status).toBe(200);
    expect(replaceFields.body.data.fields).toHaveLength(1);
    expect(replaceFields.body.data.fields[0].key).toBe("warrantyPeriod");
  });

  it("persists and returns baseDefaults on create, get, and search", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);

    const createRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(
      productTemplateCreationPayload([category.id], {
        baseDefaults: sampleBaseDefaults,
      }),
    );

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.baseDefaults).toEqual(sampleBaseDefaults);

    const templateId = createRes.body.data.id as string;

    const getRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).getById(templateId);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.baseDefaults).toEqual(sampleBaseDefaults);

    const searchRes = await productTemplateRequest(
      app,
      seller.login.auth.accessToken,
    ).search({ categoryIds: [category.id] });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data).toHaveLength(1);
    expect(searchRes.body.data[0].baseDefaults).toEqual(sampleBaseDefaults);
  });

  it("updates and clears baseDefaults", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );

    const createRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(
      productTemplateCreationPayload([category.id], {
        baseDefaults: sampleBaseDefaults,
      }),
    );
    expect(createRes.status).toBe(201);
    const templateId = createRes.body.data.id as string;

    const updatedDefaults = {
      ...sampleBaseDefaults,
      productName: "Pediatric Stethoscope",
      pricing: "7499.50",
      moq: 2,
    };

    const updateRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).update(templateId, { baseDefaults: updatedDefaults });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.baseDefaults).toEqual(updatedDefaults);

    const clearRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).update(templateId, { baseDefaults: null });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.baseDefaults).toBeNull();
  });

  it("rejects invalid baseDefaults", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );

    const unknownKeyRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(
      productTemplateCreationPayload([category.id], {
        baseDefaults: { ...sampleBaseDefaults, imageUrl: "https://x" },
      }),
    );
    expect(unknownKeyRes.status).toBe(400);

    const badTypeRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(
      productTemplateCreationPayload([category.id], {
        baseDefaults: { ...sampleBaseDefaults, moq: "1" },
      }),
    );
    expect(badTypeRes.status).toBe(400);
  });

  it("fieldCount counts only active fields on create, list, and search", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
    );
    const seller = await createApprovedSeller(app, prisma);

    const createRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).create(
      productTemplateCreationPayload([category.id], {
        fields: [
          {
            key: "color",
            label: "Color",
            fieldType: "SELECT",
            options: ["White", "Black"],
            defaultValue: "White",
            sortOrder: 0,
            isActive: true,
          },
          {
            key: "weight",
            label: "Weight",
            fieldType: "NUMBER",
            unit: "kg",
            defaultValue: 1.5,
            sortOrder: 1,
            isActive: true,
          },
          {
            key: "legacySku",
            label: "Legacy SKU",
            fieldType: "TEXT",
            sortOrder: 2,
            isActive: false,
          },
        ],
      }),
    );

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.fields).toHaveLength(3);
    expect(createRes.body.data.fieldCount).toBe(2);

    const templateId = createRes.body.data.id as string;

    const listRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ categoryId: category.id });
    expect(listRes.status).toBe(200);
    expect(listRes.body.data[0].fieldCount).toBe(2);

    const searchRes = await productTemplateRequest(
      app,
      seller.login.auth.accessToken,
    ).search({ categoryIds: [category.id] });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data[0].id).toBe(templateId);
    expect(searchRes.body.data[0].fieldCount).toBe(2);
  });

  it("supports OR category search semantics", async () => {
    const prisma = getTestPrisma();
    const { login: adminLogin } = await createAdminViaApi(app, prisma);
    const { category: catA } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
      { name: `Cat A ${Date.now()}` },
    );
    const { category: catB } = await createCategoryViaApi(
      app,
      adminLogin.auth.accessToken,
      { name: `Cat B ${Date.now()}` },
    );
    const { template } = await createTemplateViaApi(
      app,
      adminLogin.auth.accessToken,
      [catA.id],
    );

    const seller = await createApprovedSeller(app, prisma);
    const searchRes = await productTemplateRequest(
      app,
      seller.login.auth.accessToken,
    ).search({ categoryIds: [catB.id, catA.id] });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.map((t: { id: string }) => t.id)).toContain(
      template.id,
    );
  });
});

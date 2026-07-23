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
import { productTemplateCreationPayload } from "../../fixtures/productTemplate.payloads.js";
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

    const templateId = createRes.body.data.id as string;

    const listRes = await productTemplateRequest(
      app,
      adminLogin.auth.accessToken,
    ).list({ categoryId: category.id });
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);

    const searchRes = await productTemplateRequest(
      app,
      seller.login.auth.accessToken,
    ).search({ categoryIds: [category.id] });
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data).toHaveLength(1);
    expect(searchRes.body.data[0].id).toBe(templateId);

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

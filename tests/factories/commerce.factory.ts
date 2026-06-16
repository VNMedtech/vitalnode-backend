import type { Express } from "express";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { categoryCreationPayload } from "../fixtures/category.payloads.js";
import { productCreationPayload } from "../fixtures/product.payloads.js";
import {
  categoryRequest,
  inventoryRequest,
  productRequest,
} from "../utils/request.helpers.js";
import {
  createAdminViaApi,
  createApprovedSeller,
} from "./user.factory.js";

export interface MarketplaceProductSetup {
  adminToken: string;
  categoryId: string;
  sellerToken: string;
  sellerUserId: string;
  productId: string;
}

export async function createCategoryViaApi(
  app: Express,
  adminToken: string,
  overrides: Record<string, unknown> = {},
) {
  const payload = categoryCreationPayload(overrides);
  const res = await categoryRequest(app, adminToken).create(payload);
  return { response: res, payload, category: res.body.data };
}

export async function setupMarketplaceProduct(
  app: Express,
  prisma: PrismaClient,
  overrides: {
    product?: Record<string, unknown>;
    category?: Record<string, unknown>;
    inventoryQuantity?: number;
  } = {},
): Promise<MarketplaceProductSetup> {
  const { login: adminLogin } = await createAdminViaApi(app, prisma);
  const { category } = await createCategoryViaApi(
    app,
    adminLogin.auth.accessToken,
    overrides.category,
  );
  const seller = await createApprovedSeller(app, prisma);

  const productPayload = productCreationPayload(
    category.id,
    overrides.product,
  );
  const createRes = await productRequest(
    app,
    seller.login.auth.accessToken,
  ).create(productPayload);

  const productId = createRes.body.data.id as string;

  await productRequest(app, adminLogin.auth.accessToken).approve(productId);

  const quantity = overrides.inventoryQuantity ?? 50;
  await inventoryRequest(app, seller.login.auth.accessToken).update(
    productId,
    { availableQuantity: quantity, reason: "Initial stock" },
    `setup-stock-${productId}`,
  );

  return {
    adminToken: adminLogin.auth.accessToken,
    categoryId: category.id,
    sellerToken: seller.login.auth.accessToken,
    sellerUserId: seller.auth.user.id,
    productId,
  };
}

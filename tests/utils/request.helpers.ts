import request, { type Test } from "supertest";
import type { Express } from "express";

const AUTH_BASE = "/api/v1/auth";
const USERS_BASE = "/api/v1/users";
const SELLERS_BASE = "/api/v1/sellers";
const DELIVERY_PARTNERS_BASE = "/api/v1/delivery-partners";
const CATEGORIES_BASE = "/api/v1/categories";
const PRODUCTS_BASE = "/api/v1/products";
const INVENTORY_BASE = "/api/v1/inventory";
const ADDRESSES_BASE = "/api/v1/addresses";
const CART_BASE = "/api/v1/cart";
const ORDERS_BASE = "/api/v1/orders";
const PAYMENTS_BASE = "/api/v1/payments";
const REVIEWS_BASE = "/api/v1/reviews";
const ANALYTICS_BASE = "/api/v1/analytics";
const SALES_REPORTS_BASE = "/api/v1/sales-reports";
const UPLOADS_BASE = "/api/v1/uploads";
const IDEMPOTENCY_HEADER = "idempotency-key";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisteredUserResponse {
  user: {
    id: string;
    email: string;
    role: string;
    sellerApprovalStatus?: string;
  };
  accessToken: string;
  refreshToken: string;
}

export function authRequest(app: Express) {
  return {
    registerBuyer: (body: Record<string, unknown>) =>
      request(app).post(`${AUTH_BASE}/register-buyer`).send(body),

    registerSeller: (body: Record<string, unknown>) =>
      request(app).post(`${AUTH_BASE}/register-seller`).send(body),

    login: (body: { email: string; password: string }) =>
      request(app).post(`${AUTH_BASE}/login`).send(body),

    refreshToken: (refreshToken: string) =>
      request(app).post(`${AUTH_BASE}/refresh-token`).send({ refreshToken }),

    logout: (refreshToken: string) =>
      request(app).post(`${AUTH_BASE}/logout`).send({ refreshToken }),

    forgotPassword: (email: string) =>
      request(app).post(`${AUTH_BASE}/forgot-password`).send({ email }),

    resetPassword: (body: { token: string; newPassword: string }) =>
      request(app).post(`${AUTH_BASE}/reset-password`).send(body),
  };
}

export function userRequest(app: Express, accessToken: string) {
  return {
    getProfile: () =>
      request(app)
        .get(`${USERS_BASE}/me`)
        .set("Authorization", `Bearer ${accessToken}`),

    updateProfile: (body: Record<string, unknown>) =>
      request(app)
        .patch(`${USERS_BASE}/me`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),

    changePassword: (body: {
      currentPassword: string;
      newPassword: string;
    }) =>
      request(app)
        .post(`${USERS_BASE}/me/change-password`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),
  };
}

export function sellerRequest(app: Express, accessToken: string) {
  return {
    list: (query: Record<string, string | number | undefined> = {}) =>
      request(app)
        .get(SELLERS_BASE)
        .query(query)
        .set("Authorization", `Bearer ${accessToken}`),

    getById: (id: string) =>
      request(app)
        .get(`${SELLERS_BASE}/${id}`)
        .set("Authorization", `Bearer ${accessToken}`),

    approve: (id: string) =>
      request(app)
        .post(`${SELLERS_BASE}/${id}/approve`)
        .set("Authorization", `Bearer ${accessToken}`),

    reject: (id: string, body: Record<string, unknown> = {}) =>
      request(app)
        .post(`${SELLERS_BASE}/${id}/reject`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),

    disable: (id: string, body: Record<string, unknown> = {}) =>
      request(app)
        .patch(`${SELLERS_BASE}/${id}/disable`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),

    enable: (id: string, body: Record<string, unknown> = {}) =>
      request(app)
        .patch(`${SELLERS_BASE}/${id}/enable`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),
  };
}

export function deliveryPartnerRequest(app: Express, accessToken: string) {
  return {
    list: (query: Record<string, string | number | undefined> = {}) =>
      request(app)
        .get(DELIVERY_PARTNERS_BASE)
        .query(query)
        .set("Authorization", `Bearer ${accessToken}`),

    getById: (id: string) =>
      request(app)
        .get(`${DELIVERY_PARTNERS_BASE}/${id}`)
        .set("Authorization", `Bearer ${accessToken}`),

    create: (body: Record<string, unknown>) =>
      request(app)
        .post(DELIVERY_PARTNERS_BASE)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),

    update: (id: string, body: Record<string, unknown>) =>
      request(app)
        .patch(`${DELIVERY_PARTNERS_BASE}/${id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),

    disable: (id: string, body: Record<string, unknown> = {}) =>
      request(app)
        .patch(`${DELIVERY_PARTNERS_BASE}/${id}/disable`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),

    enable: (id: string, body: Record<string, unknown> = {}) =>
      request(app)
        .patch(`${DELIVERY_PARTNERS_BASE}/${id}/enable`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body),
  };
}

export function categoryRequest(app: Express, accessToken = "") {
  const auth = (req: Test) =>
    accessToken ? req.set("Authorization", `Bearer ${accessToken}`) : req;

  return {
    list: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(CATEGORIES_BASE)).query(query),

    getById: (id: string) => auth(request(app).get(`${CATEGORIES_BASE}/${id}`)),

    create: (body: Record<string, unknown>) =>
      auth(request(app).post(CATEGORIES_BASE)).send(body),

    update: (id: string, body: Record<string, unknown>) =>
      auth(request(app).patch(`${CATEGORIES_BASE}/${id}`)).send(body),

    disable: (id: string) =>
      auth(request(app).delete(`${CATEGORIES_BASE}/${id}`)),
  };
}

export function productRequest(app: Express, accessToken = "") {
  const auth = (req: Test) =>
    accessToken ? req.set("Authorization", `Bearer ${accessToken}`) : req;

  return {
    listMarketplace: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(PRODUCTS_BASE)).query(query),

    listOwn: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(`${PRODUCTS_BASE}/mine`)).query(query),

    listPending: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(`${PRODUCTS_BASE}/pending`)).query(query),

    getMarketplaceById: (id: string) =>
      auth(request(app).get(`${PRODUCTS_BASE}/${id}`)),

    compare: (productIds: string[]) =>
      auth(request(app).get(`${PRODUCTS_BASE}/compare`)).query({ productIds }),

    getOwnById: (id: string) =>
      auth(request(app).get(`${PRODUCTS_BASE}/mine/${id}`)),

    create: (body: Record<string, unknown>) =>
      auth(request(app).post(PRODUCTS_BASE)).send(body),

    createMultipart: (
      fields: Record<string, string>,
      files?: {
        images?: Array<{ buffer: Buffer; filename: string }>;
        documents?: Array<{ buffer: Buffer; filename: string }>;
      },
    ) => {
      let req = auth(request(app).post(PRODUCTS_BASE));
      for (const [key, value] of Object.entries(fields)) {
        req = req.field(key, value);
      }
      for (const image of files?.images ?? []) {
        req = req.attach("images", image.buffer, image.filename);
      }
      for (const document of files?.documents ?? []) {
        req = req.attach("documents", document.buffer, document.filename);
      }
      return req;
    },

    update: (id: string, body: Record<string, unknown>) =>
      auth(request(app).patch(`${PRODUCTS_BASE}/${id}`)).send(body),

    updateMultipart: (
      id: string,
      fields: Record<string, string>,
      files?: {
        images?: Array<{ buffer: Buffer; filename: string }>;
        documents?: Array<{ buffer: Buffer; filename: string }>;
      },
    ) => {
      let req = auth(request(app).patch(`${PRODUCTS_BASE}/${id}`));
      for (const [key, value] of Object.entries(fields)) {
        req = req.field(key, value);
      }
      for (const image of files?.images ?? []) {
        req = req.attach("images", image.buffer, image.filename);
      }
      for (const document of files?.documents ?? []) {
        req = req.attach("documents", document.buffer, document.filename);
      }
      return req;
    },

    disable: (id: string) =>
      auth(request(app).delete(`${PRODUCTS_BASE}/${id}`)),

    approve: (id: string) =>
      auth(request(app).post(`${PRODUCTS_BASE}/${id}/approve`)),

    reject: (id: string, body: Record<string, unknown> = {}) =>
      auth(request(app).post(`${PRODUCTS_BASE}/${id}/reject`)).send(body),

    listReviews: (
      productId: string,
      query: Record<string, string | number | undefined> = {},
    ) =>
      auth(request(app).get(`${PRODUCTS_BASE}/${productId}/reviews`)).query(
        query,
      ),
  };
}

export function reviewRequest(app: Express, accessToken = "") {
  const auth = (req: Test) =>
    accessToken ? req.set("Authorization", `Bearer ${accessToken}`) : req;

  return {
    create: (body: Record<string, unknown>) =>
      auth(request(app).post(REVIEWS_BASE)).send(body),

    update: (reviewId: string, body: Record<string, unknown>) =>
      auth(request(app).patch(`${REVIEWS_BASE}/${reviewId}`)).send(body),

    delete: (reviewId: string) =>
      auth(request(app).delete(`${REVIEWS_BASE}/${reviewId}`)),

    listAdmin: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(REVIEWS_BASE)).query(query),

    disable: (reviewId: string) =>
      auth(request(app).post(`${REVIEWS_BASE}/${reviewId}/disable`)),
  };
}

export function inventoryRequest(app: Express, accessToken: string) {
  const auth = (req: Test) =>
    req.set("Authorization", `Bearer ${accessToken}`);

  return {
    get: (productId: string) =>
      auth(request(app).get(`${INVENTORY_BASE}/${productId}`)),

    update: (
      productId: string,
      body: Record<string, unknown>,
      idempotencyKey: string,
    ) =>
      auth(request(app).patch(`${INVENTORY_BASE}/${productId}`))
        .set(IDEMPOTENCY_HEADER, idempotencyKey)
        .send(body),

    listMovements: (
      productId: string,
      query: Record<string, string | number | undefined> = {},
    ) =>
      auth(request(app).get(`${INVENTORY_BASE}/${productId}/movements`)).query(
        query,
      ),

    listLowStockAlerts: (
      query: Record<string, string | number | undefined> = {},
    ) =>
      auth(request(app).get(`${INVENTORY_BASE}/alerts/low-stock`)).query(query),
  };
}

export function addressRequest(app: Express, accessToken: string) {
  const auth = (req: Test) =>
    req.set("Authorization", `Bearer ${accessToken}`);

  return {
    list: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(ADDRESSES_BASE)).query(query),

    create: (body: Record<string, unknown>) =>
      auth(request(app).post(ADDRESSES_BASE)).send(body),

    getById: (id: string) =>
      auth(request(app).get(`${ADDRESSES_BASE}/${id}`)),

    update: (id: string, body: Record<string, unknown>) =>
      auth(request(app).patch(`${ADDRESSES_BASE}/${id}`)).send(body),

    setDefault: (id: string) =>
      auth(request(app).patch(`${ADDRESSES_BASE}/${id}/default`)),

    delete: (id: string) =>
      auth(request(app).delete(`${ADDRESSES_BASE}/${id}`)),
  };
}

export function cartRequest(app: Express, accessToken: string) {
  const auth = (req: Test) =>
    req.set("Authorization", `Bearer ${accessToken}`);

  return {
    get: () => auth(request(app).get(CART_BASE)),

    addItem: (body: { productId: string; quantity: number }) =>
      auth(request(app).post(`${CART_BASE}/items`)).send(body),

    updateItem: (itemId: string, body: { quantity: number }) =>
      auth(request(app).patch(`${CART_BASE}/items/${itemId}`)).send(body),

    removeItem: (itemId: string) =>
      auth(request(app).delete(`${CART_BASE}/items/${itemId}`)),

    clear: () => auth(request(app).delete(CART_BASE)),
  };
}

export function uploadRequest(app: Express, accessToken: string) {
  const auth = (req: Test) =>
    req.set("Authorization", `Bearer ${accessToken}`);

  return {
    uploadImage: (uploadType: string, fileBuffer: Buffer, filename: string) =>
      auth(request(app).post(`${UPLOADS_BASE}/image`))
        .field("uploadType", uploadType)
        .attach("file", fileBuffer, filename),

    uploadDocument: (
      uploadType: string,
      fileBuffer: Buffer,
      filename: string,
    ) =>
      auth(request(app).post(`${UPLOADS_BASE}/document`))
        .field("uploadType", uploadType)
        .attach("file", fileBuffer, filename),

    getMetadata: (id: string) =>
      auth(request(app).get(`${UPLOADS_BASE}/${id}`)),

    getSignedUrl: (id: string, query: Record<string, string> = {}) =>
      auth(request(app).get(`${UPLOADS_BASE}/${id}/signed-url`)).query(query),

    replace: (id: string, fileBuffer: Buffer, filename: string) =>
      auth(request(app).put(`${UPLOADS_BASE}/${id}/replace`)).attach(
        "file",
        fileBuffer,
        filename,
      ),

    delete: (id: string) =>
      auth(request(app).delete(`${UPLOADS_BASE}/${id}`)),
  };
}

export function orderRequest(app: Express, accessToken = "") {
  const auth = (req: Test) =>
    accessToken ? req.set("Authorization", `Bearer ${accessToken}`) : req;

  return {
    checkout: (
      body: { shippingAddressId: string },
      idempotencyKey: string,
    ) =>
      auth(request(app).post(`${ORDERS_BASE}/checkout`))
        .set(IDEMPOTENCY_HEADER, idempotencyKey)
        .send(body),

    list: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(ORDERS_BASE)).query(query),

    listAssigned: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(`${ORDERS_BASE}/assigned`)).query(query),

    getById: (id: string) =>
      auth(request(app).get(`${ORDERS_BASE}/${id}`)),

    cancel: (
      body: { orderId: string; reason?: string },
      idempotencyKey: string,
    ) =>
      auth(request(app).post(`${ORDERS_BASE}/cancel`))
        .set(IDEMPOTENCY_HEADER, idempotencyKey)
        .send(body),

    cancelById: (
      id: string,
      body: { reason?: string } = {},
      idempotencyKey: string,
    ) =>
      auth(request(app).post(`${ORDERS_BASE}/${id}/cancel`))
        .set(IDEMPOTENCY_HEADER, idempotencyKey)
        .send(body),

    process: (id: string) =>
      auth(request(app).post(`${ORDERS_BASE}/${id}/process`)),

    uploadHandoverProof: (
      id: string,
      file: { buffer: Buffer; filename: string },
    ) =>
      auth(request(app).post(`${ORDERS_BASE}/${id}/handover-proof`)).attach(
        "file",
        file.buffer,
        file.filename,
      ),

    markOutForDelivery: (
      id: string,
      file?: { buffer: Buffer; filename: string },
    ) => {
      let req = auth(request(app).post(`${ORDERS_BASE}/${id}/out-for-delivery`));
      if (file) {
        req = req.attach("file", file.buffer, file.filename);
      }
      return req;
    },

    uploadDeliveryProof: (
      id: string,
      file: { buffer: Buffer; filename: string },
    ) =>
      auth(request(app).post(`${ORDERS_BASE}/${id}/delivery-proof`)).attach(
        "file",
        file.buffer,
        file.filename,
      ),

    markDelivered: (
      id: string,
      file?: { buffer: Buffer; filename: string },
    ) => {
      let req = auth(request(app).post(`${ORDERS_BASE}/${id}/delivered`));
      if (file) {
        req = req.attach("file", file.buffer, file.filename);
      }
      return req;
    },

    markDeliveryFailed: (id: string, body: { reason?: string } = {}) =>
      auth(request(app).post(`${ORDERS_BASE}/${id}/delivery-failed`)).send(body),

    assignDeliveryPartner: (
      id: string,
      body: { deliveryPartnerId: string },
    ) =>
      auth(request(app).post(`${ORDERS_BASE}/${id}/assign-delivery-partner`)).send(
        body,
      ),

    reassignDeliveryPartner: (
      id: string,
      body: { deliveryPartnerId: string },
    ) =>
      auth(
        request(app).post(`${ORDERS_BASE}/${id}/reassign-delivery-partner`),
      ).send(body),
  };
}

export function paymentRequest(app: Express, accessToken = "") {
  const auth = (req: Test) =>
    accessToken ? req.set("Authorization", `Bearer ${accessToken}`) : req;

  return {
    getDetails: (orderId: string) =>
      auth(request(app).get(`${PAYMENTS_BASE}/${orderId}`)),

    createOrder: (
      body: { orderId: string },
      idempotencyKey: string,
    ) =>
      auth(request(app).post(`${PAYMENTS_BASE}/create-order`))
        .set(IDEMPOTENCY_HEADER, idempotencyKey)
        .send(body),

    createOrderWithoutIdempotency: (body: { orderId: string }) =>
      auth(request(app).post(`${PAYMENTS_BASE}/create-order`)).send(body),

    verify: (
      body: {
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
      },
      idempotencyKey: string,
    ) =>
      auth(request(app).post(`${PAYMENTS_BASE}/verify`))
        .set(IDEMPOTENCY_HEADER, idempotencyKey)
        .send(body),

    refund: (body: { orderId: string }, idempotencyKey: string) =>
      auth(request(app).post(`${PAYMENTS_BASE}/refund`))
        .set(IDEMPOTENCY_HEADER, idempotencyKey)
        .send(body),
  };
}

export function analyticsRequest(app: Express, accessToken: string) {
  const auth = (req: Test) => req.set("Authorization", `Bearer ${accessToken}`);

  return {
    getPlatformSalesReport: (
      query: Record<string, string | number | undefined> = {},
    ) =>
      auth(request(app).get(`${ANALYTICS_BASE}/sales`)).query(query),

    listSellerSalesReport: (
      query: Record<string, string | number | undefined> = {},
    ) =>
      auth(request(app).get(`${ANALYTICS_BASE}/sales/sellers`)).query(query),
  };
}

export function salesReportsRequest(app: Express, accessToken: string) {
  const auth = (req: Test) => req.set("Authorization", `Bearer ${accessToken}`);

  return {
    getSummary: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(`${SALES_REPORTS_BASE}/summary`)).query(query),

    getOrders: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(`${SALES_REPORTS_BASE}/orders`)).query(query),

    getRevenue: (query: Record<string, string | number | undefined> = {}) =>
      auth(request(app).get(`${SALES_REPORTS_BASE}/revenue`)).query(query),
  };
}

export function sellerProbeRequest(app: Express, accessToken: string): Test {
  return request(app)
    .post("/api/v1/test/seller-operational")
    .set("Authorization", `Bearer ${accessToken}`);
}

export function extractAuthData(body: {
  success: boolean;
  data?: RegisteredUserResponse;
}): RegisteredUserResponse {
  if (!body.success || !body.data) {
    throw new Error("Expected successful auth response with data");
  }
  return body.data;
}

export function extractResetTokenFromEmailPayload(input: {
  html: string;
  text?: string;
}): string {
  const tokenPattern = /([a-f0-9]{64})/i;

  const fromTextToken = input.text?.match(/Reset token[^:]*:\s*([a-f0-9]+)/i)?.[1];
  if (fromTextToken) {
    return fromTextToken;
  }

  const fromTextLink = input.text?.match(/reset-password\?token=([a-f0-9]+)/i)?.[1];
  if (fromTextLink) {
    return fromTextLink;
  }

  const fromHtmlLink = input.html.match(/reset-password\?token=([a-f0-9]+)/i)?.[1];
  if (fromHtmlLink) {
    return fromHtmlLink;
  }

  const fromHtmlToken = input.html.match(tokenPattern)?.[1];
  if (fromHtmlToken) {
    return fromHtmlToken;
  }

  const fromLegacyHtml = input.html.match(/<b>([a-f0-9]+)<\/b>/i)?.[1];
  if (fromLegacyHtml) {
    return fromLegacyHtml;
  }

  throw new Error("Could not extract password reset token from email payload");
}

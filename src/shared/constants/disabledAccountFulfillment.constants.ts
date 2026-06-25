/**
 * Routes disabled sellers and delivery partners may still access to complete
 * in-flight orders assigned before account disable.
 */
const ORDER_BASE = "/api/v1/orders";

function orderPath(suffix: string): string {
  return `${ORDER_BASE}${suffix}`;
}

/** Seller may fulfill existing orders while approvalStatus is DISABLED. */
export const DISABLED_SELLER_FULFILLMENT_PATHS = new Set([
  orderPath(""),
  orderPath("/assigned"),
]);

export const DISABLED_SELLER_FULFILLMENT_PREFIXES = [
  orderPath("/"), // GET /:id, POST /:id/process, etc.
] as const;

/** Delivery partner may complete assigned deliveries while user.status is DISABLED. */
export const DISABLED_DELIVERY_PARTNER_FULFILLMENT_PATHS = new Set([
  orderPath("/assigned"),
]);

export const DISABLED_DELIVERY_PARTNER_FULFILLMENT_PREFIXES = [
  orderPath("/"),
] as const;

export function normalizeRequestPath(originalUrl: string): string {
  return originalUrl.split("?")[0] ?? originalUrl;
}

function matchesPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

export function isDisabledSellerFulfillmentRoute(
  originalUrl: string,
  method: string,
): boolean {
  const path = normalizeRequestPath(originalUrl);

  if (path === orderPath("") && method === "GET") {
    return true;
  }

  if (DISABLED_SELLER_FULFILLMENT_PATHS.has(path)) {
    return true;
  }

  if (!matchesPrefix(path, DISABLED_SELLER_FULFILLMENT_PREFIXES)) {
    return false;
  }

  if (method === "GET") {
    return true;
  }

  return (
    path.endsWith("/process") ||
    path.endsWith("/handover-proof") ||
    path.endsWith("/out-for-delivery")
  );
}

export function isDisabledDeliveryPartnerFulfillmentRoute(
  originalUrl: string,
  method: string,
): boolean {
  const path = normalizeRequestPath(originalUrl);

  if (path === orderPath("/assigned") && method === "GET") {
    return true;
  }

  if (DISABLED_DELIVERY_PARTNER_FULFILLMENT_PATHS.has(path)) {
    return true;
  }

  if (!matchesPrefix(path, DISABLED_DELIVERY_PARTNER_FULFILLMENT_PREFIXES)) {
    return false;
  }

  if (method === "GET") {
    return true;
  }

  return (
    path.endsWith("/delivery-proof") ||
    path.endsWith("/delivered") ||
    path.endsWith("/delivery-failed")
  );
}

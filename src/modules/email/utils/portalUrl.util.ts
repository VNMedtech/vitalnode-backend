import { env } from "../../../config/env.js";
import { AuthPortal } from "../../../shared/enums/authPortal.enum.js";

export type WebAppUrls = {
  store: string;
  seller: string;
  admin: string;
  delivery: string;
  fallback: string;
};

/**
 * Resolve the base URL for a portal.
 * Portal-specific URL → WEB_APP_BASE_URL fallback → empty string.
 */
export function resolvePortalBaseUrl(
  portal: AuthPortal | undefined,
  urls: WebAppUrls = env.webAppUrls,
): string {
  if (portal) {
    const portalUrl = (() => {
      switch (portal) {
        case AuthPortal.STORE:
          return urls.store;
        case AuthPortal.SELLER:
          return urls.seller;
        case AuthPortal.ADMIN:
          return urls.admin;
        case AuthPortal.DELIVERY:
          return urls.delivery;
        default:
          return "";
      }
    })();

    if (portalUrl) {
      return portalUrl;
    }
  }

  return urls.fallback || "";
}

/**
 * Build an absolute URL on the chosen portal base.
 * Returns undefined when no base URL is configured.
 *
 * TODO: other buildAppUrl call sites (order notifications, seller/product approval)
 * still use a single WEB_APP_BASE_URL — only password-reset links are portal-aware.
 */
export function buildPortalUrl(
  portal: AuthPortal | undefined,
  pathname: string,
  urls?: WebAppUrls,
): string | undefined {
  const base = resolvePortalBaseUrl(portal, urls ?? env.webAppUrls);
  if (!base) {
    return undefined;
  }

  return new URL(pathname, base).toString();
}

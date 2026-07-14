import { describe, expect, it } from "vitest";
import { AuthPortal } from "../../../src/shared/enums/authPortal.enum.js";
import {
  buildPortalUrl,
  resolvePortalBaseUrl,
  type WebAppUrls,
} from "../../../src/modules/email/utils/portalUrl.util.js";

const FULL_URLS: WebAppUrls = {
  store: "https://store.example.com",
  seller: "https://seller.example.com",
  admin: "https://admin.example.com",
  delivery: "https://delivery.example.com",
  fallback: "https://fallback.example.com",
};

describe("resolvePortalBaseUrl", () => {
  it("selects the portal-specific base URL", () => {
    expect(resolvePortalBaseUrl(AuthPortal.STORE, FULL_URLS)).toBe(
      FULL_URLS.store,
    );
    expect(resolvePortalBaseUrl(AuthPortal.SELLER, FULL_URLS)).toBe(
      FULL_URLS.seller,
    );
    expect(resolvePortalBaseUrl(AuthPortal.ADMIN, FULL_URLS)).toBe(
      FULL_URLS.admin,
    );
    expect(resolvePortalBaseUrl(AuthPortal.DELIVERY, FULL_URLS)).toBe(
      FULL_URLS.delivery,
    );
  });

  it("falls back to WEB_APP_BASE_URL when portal is omitted", () => {
    expect(resolvePortalBaseUrl(undefined, FULL_URLS)).toBe(FULL_URLS.fallback);
  });

  it("falls back to WEB_APP_BASE_URL when portal URL is unset", () => {
    const urls: WebAppUrls = {
      ...FULL_URLS,
      seller: "",
    };

    expect(resolvePortalBaseUrl(AuthPortal.SELLER, urls)).toBe(
      FULL_URLS.fallback,
    );
  });

  it("returns empty string when no portal URL and no fallback", () => {
    const urls: WebAppUrls = {
      store: "",
      seller: "",
      admin: "",
      delivery: "",
      fallback: "",
    };

    expect(resolvePortalBaseUrl(AuthPortal.STORE, urls)).toBe("");
    expect(resolvePortalBaseUrl(undefined, urls)).toBe("");
  });
});

describe("buildPortalUrl", () => {
  it("builds an absolute path on the portal base", () => {
    expect(buildPortalUrl(AuthPortal.SELLER, "/reset-password", FULL_URLS)).toBe(
      "https://seller.example.com/reset-password",
    );
  });

  it("returns undefined when no base URL is available", () => {
    const urls: WebAppUrls = {
      store: "",
      seller: "",
      admin: "",
      delivery: "",
      fallback: "",
    };

    expect(buildPortalUrl(AuthPortal.ADMIN, "/reset-password", urls)).toBeUndefined();
  });

  it("uses fallback base when portal is omitted", () => {
    expect(buildPortalUrl(undefined, "/reset-password", FULL_URLS)).toBe(
      "https://fallback.example.com/reset-password",
    );
  });
});

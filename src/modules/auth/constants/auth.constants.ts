export const AUTH_AUDIT_ENTITY_TYPE = "AUTH" as const;

export const AUTH_ACTIONS = {
  REGISTER_BUYER: "AUTH_REGISTER_BUYER",
  REGISTER_SELLER: "AUTH_REGISTER_SELLER",
  LOGIN: "AUTH_LOGIN",
  REFRESH: "AUTH_REFRESH_TOKEN",
  LOGOUT: "AUTH_LOGOUT",
  FORGOT_PASSWORD: "AUTH_FORGOT_PASSWORD",
  RESET_PASSWORD: "AUTH_RESET_PASSWORD",
} as const;

/**
 * auth — auth.constants
 * Module-specific constants and configuration values.
 */

export const authConstants = {} as const;

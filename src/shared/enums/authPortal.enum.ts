/**
 * Frontend portal identifiers for portal-aware links (e.g. password reset).
 * Distinct from UserRole — requested portal wins over DB role.
 */
export enum AuthPortal {
  STORE = "STORE",
  SELLER = "SELLER",
  ADMIN = "ADMIN",
  DELIVERY = "DELIVERY",
}

export const INVOICE_NUMBER_PREFIX = "VN-INV";

export const INVOICE_DEFAULT_CURRENCY = "INR";

export const INVOICE_S3_PREFIX = "invoices";

export const PLATFORM_NAME = "VitalNode";

export const INVOICE_DEFAULT_PAGE = 1;

export const INVOICE_DEFAULT_LIMIT = 20;

export const INVOICE_MAX_LIMIT = 100;

export const INVOICE_SORT_FIELDS = [
  "generatedAt",
  "invoiceNumber",
  "createdAt",
] as const;

export const INVOICE_ACTIONS = {
  GENERATED: "INVOICE_GENERATED",
} as const;

export const INVOICE_AUDIT_ENTITY_TYPE = "Invoice";

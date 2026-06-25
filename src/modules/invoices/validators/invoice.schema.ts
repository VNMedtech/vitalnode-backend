import { z } from "zod";
import {
  INVOICE_DEFAULT_LIMIT,
  INVOICE_DEFAULT_PAGE,
  INVOICE_MAX_LIMIT,
  INVOICE_SORT_FIELDS,
} from "../constants/invoice.constants.js";

export const invoiceSortFields = INVOICE_SORT_FIELDS;

export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export const invoiceIdParamSchema = z.object({
  id: z.string().uuid("Invalid invoice ID"),
});

export type InvoiceIdParam = z.infer<typeof invoiceIdParamSchema>;

export const orderIdInvoiceParamSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
});

export type OrderIdInvoiceParam = z.infer<typeof orderIdInvoiceParamSchema>;

export const listInvoicesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(INVOICE_DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(INVOICE_MAX_LIMIT)
      .default(INVOICE_DEFAULT_LIMIT),
    sortBy: z.enum(INVOICE_SORT_FIELDS).default("generatedAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type ListInvoicesQueryInput = z.infer<typeof listInvoicesQuerySchema>;

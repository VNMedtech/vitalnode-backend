import { describe, expect, it } from "vitest";
import {
  INVOICE_NUMBER_PREFIX,
  INVOICE_S3_PREFIX,
} from "../../../src/modules/invoices/constants/invoice.constants.js";
import { buildInvoiceS3Key } from "../../../src/modules/invoices/services/invoicePdf.service.js";

describe("Invoice utilities", () => {
  it("builds S3 keys under the invoices folder", () => {
    const invoiceNumber = `${INVOICE_NUMBER_PREFIX}-20260625-000001`;
    expect(buildInvoiceS3Key(invoiceNumber)).toBe(
      `${INVOICE_S3_PREFIX}/${invoiceNumber}.pdf`,
    );
  });

  it("uses the VN-INV invoice number prefix", () => {
    expect(INVOICE_NUMBER_PREFIX).toBe("VN-INV");
  });
});

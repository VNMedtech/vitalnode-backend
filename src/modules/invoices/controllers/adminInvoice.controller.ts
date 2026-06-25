import type { RequestHandler } from "express";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { InvoiceService } from "../services/invoice.service.js";
import type {
  InvoiceIdParam,
  ListInvoicesQueryInput,
} from "../validators/invoice.schema.js";

const invoiceService = new InvoiceService();

export const listAdminInvoices: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListInvoicesQueryInput;
    const result = await invoiceService.listAdminInvoices(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Invoices fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getAdminInvoiceById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as InvoiceIdParam;
    const invoice = await invoiceService.getAdminInvoiceById(id);
    res
      .status(200)
      .json(successResponse(invoice, "Invoice fetched successfully"));
  } catch (err) {
    next(err);
  }
};

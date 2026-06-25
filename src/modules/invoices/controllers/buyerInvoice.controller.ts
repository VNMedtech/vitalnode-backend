import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { InvoiceService } from "../services/invoice.service.js";
import type {
  InvoiceIdParam,
  ListInvoicesQueryInput,
  OrderIdInvoiceParam,
} from "../validators/invoice.schema.js";

const invoiceService = new InvoiceService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listBuyerInvoices: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const query = req.query as unknown as ListInvoicesQueryInput;
    const result = await invoiceService.listBuyerInvoices(actorUserId, query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Buyer invoices fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getBuyerInvoiceById: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as InvoiceIdParam;
    const invoice = await invoiceService.getBuyerInvoiceById(actorUserId, id);
    res
      .status(200)
      .json(successResponse(invoice, "Invoice fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getBuyerInvoiceByOrderId: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { orderId } = req.params as OrderIdInvoiceParam;
    const invoice = await invoiceService.getBuyerInvoiceByOrderId(
      actorUserId,
      orderId,
    );
    res
      .status(200)
      .json(successResponse(invoice, "Order invoice fetched successfully"));
  } catch (err) {
    next(err);
  }
};

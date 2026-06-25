/**
 * buyers — buyer.routes
 * Express router definitions and middleware wiring.
 */
import { Router } from "express";
import { buyerInvoiceRouter } from "../../invoices/routes/buyerInvoice.routes.js";

export const buyerRouter = Router();

buyerRouter.use(buyerInvoiceRouter);

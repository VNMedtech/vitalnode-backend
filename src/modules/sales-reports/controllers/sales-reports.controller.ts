import type { RequestHandler } from "express";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { SalesReportsService } from "../services/sales-reports.service.js";
import type {
  PlatformSalesReportQueryInput,
  SellerOrdersSummaryQueryInput,
  SellerRevenueSummaryQueryInput,
  SellerSalesReportQueryInput,
  SellerSalesSummaryQueryInput,
} from "../validators/query.schema.js";

const salesReportsService = new SalesReportsService();

export const getSellerSalesSummary: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as SellerSalesSummaryQueryInput;
    const summary = await salesReportsService.getSellerSalesSummary(
      req.user!.id,
      query,
    );
    res
      .status(200)
      .json(successResponse(summary, "Sales summary fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getSellerOrdersSummary: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as SellerOrdersSummaryQueryInput;
    const summary = await salesReportsService.getSellerOrdersSummary(
      req.user!.id,
      query,
    );
    res
      .status(200)
      .json(successResponse(summary, "Orders summary fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getSellerRevenueSummary: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const query = req.query as unknown as SellerRevenueSummaryQueryInput;
    const summary = await salesReportsService.getSellerRevenueSummary(
      req.user!.id,
      query,
    );
    res
      .status(200)
      .json(successResponse(summary, "Revenue summary fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getPlatformSalesReport: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as PlatformSalesReportQueryInput;
    const report = await salesReportsService.getPlatformSalesReport(query);
    res
      .status(200)
      .json(successResponse(report, "Platform sales report fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const listSellerSalesReport: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as SellerSalesReportQueryInput;
    const result = await salesReportsService.listSellerSalesReport(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Seller sales report fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const salesReportsController = {
  getSellerSalesSummary,
  getSellerOrdersSummary,
  getSellerRevenueSummary,
  getPlatformSalesReport,
  listSellerSalesReport,
};

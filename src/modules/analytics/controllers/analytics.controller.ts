import type { RequestHandler } from "express";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { AnalyticsService } from "../services/analytics.service.js";
import type {
  InventoryAlertsQueryInput,
  OrderStatisticsQueryInput,
  ProductStatisticsQueryInput,
  RevenueStatisticsQueryInput,
  SellerStatisticsQueryInput,
  UserStatisticsQueryInput,
} from "../validators/query.schema.js";

const analyticsService = new AnalyticsService();

export const getDashboardSummary: RequestHandler = async (_req, res, next) => {
  try {
    const summary = await analyticsService.getDashboardSummary();
    res
      .status(200)
      .json(successResponse(summary, "Dashboard summary fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getUserStatistics: RequestHandler = async (req, res, next) => {
  try {
    const { from, to } = req.query as unknown as UserStatisticsQueryInput;
    const statistics = await analyticsService.getUserStatistics(from, to);
    res
      .status(200)
      .json(successResponse(statistics, "User statistics fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getSellerStatistics: RequestHandler = async (req, res, next) => {
  try {
    const { from, to } = req.query as unknown as SellerStatisticsQueryInput;
    const statistics = await analyticsService.getSellerStatistics(from, to);
    res
      .status(200)
      .json(
        successResponse(statistics, "Seller statistics fetched successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const getProductStatistics: RequestHandler = async (req, res, next) => {
  try {
    const { from, to } = req.query as unknown as ProductStatisticsQueryInput;
    const statistics = await analyticsService.getProductStatistics(from, to);
    res
      .status(200)
      .json(
        successResponse(statistics, "Product statistics fetched successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const getOrderStatistics: RequestHandler = async (req, res, next) => {
  try {
    const { from, to } = req.query as unknown as OrderStatisticsQueryInput;
    const statistics = await analyticsService.getOrderStatistics(from, to);
    res
      .status(200)
      .json(
        successResponse(statistics, "Order statistics fetched successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const getRevenueStatistics: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as RevenueStatisticsQueryInput;
    const statistics = await analyticsService.getRevenueStatistics(query);
    res
      .status(200)
      .json(
        successResponse(statistics, "Revenue statistics fetched successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const listInventoryAlerts: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as InventoryAlertsQueryInput;
    const result = await analyticsService.listInventoryAlerts(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Inventory alerts fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const analyticsController = {
  getDashboardSummary,
  getUserStatistics,
  getSellerStatistics,
  getProductStatistics,
  getOrderStatistics,
  getRevenueStatistics,
  listInventoryAlerts,
};

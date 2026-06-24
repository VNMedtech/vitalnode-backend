import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { toSellerDetailDto } from "../../sellers/dto/seller.dto.js";
import { SellerCommissionService } from "../services/sellerCommission.service.js";
import { SettlementService } from "../services/settlement.service.js";
import type {
  CreateSettlementBatchBody,
  DisburseSettlementBatchBody,
  ListSettlementsQueryInput,
  SettlementIdParam,
  SettlementSellerIdParam,
} from "../validators/settlement.schema.js";
import type { SellerIdParam } from "../../sellers/validators/sellerParams.schema.js";

const settlementService = new SettlementService();
const sellerCommissionService = new SellerCommissionService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listPendingSettlements: RequestHandler = async (req, res, next) => {
  try {
    const items = await settlementService.listPendingSettlements();
    res
      .status(200)
      .json(successResponse(items, "Pending settlements fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getSellerPendingSettlementDetail: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { sellerId } = req.params as SettlementSellerIdParam;
    const detail =
      await settlementService.getSellerPendingSettlementDetail(sellerId);
    res
      .status(200)
      .json(
        successResponse(
          detail,
          "Seller pending settlement details fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const listSettlementHistory: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListSettlementsQueryInput;
    const result = await settlementService.listSettlementHistory(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Settlement history fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getSettlementBatchById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as SettlementIdParam;
    const batch = await settlementService.getSettlementBatchById(id);
    res
      .status(200)
      .json(successResponse(batch, "Settlement batch fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const createSettlementBatch: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateSettlementBatchBody;
    const batch = await settlementService.createSettlementBatch(
      actorUserId,
      body,
    );
    res
      .status(201)
      .json(successResponse(batch, "Settlement batch created successfully"));
  } catch (err) {
    next(err);
  }
};

export const disburseSettlementBatch: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SettlementIdParam;
    const body = req.body as DisburseSettlementBatchBody;
    const batch = await settlementService.disburseSettlementBatch(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(batch, "Settlement batch disbursed successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateSellerCommission: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerIdParam;
    const { commissionPercentage } = req.body as { commissionPercentage: number };
    const seller = await sellerCommissionService.updateSellerCommission(
      actorUserId,
      id,
      commissionPercentage,
    );
    res
      .status(200)
      .json(successResponse(toSellerDetailDto(seller), "Seller commission updated successfully"));
  } catch (err) {
    next(err);
  }
};

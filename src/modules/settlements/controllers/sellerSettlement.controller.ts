import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { SettlementService } from "../services/settlement.service.js";
import type {
  ListSettlementsQueryInput,
  SettlementIdParam,
} from "../validators/settlement.schema.js";

const settlementService = new SettlementService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const getSellerEarningsSummary: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const summary = await settlementService.getSellerEarningsSummary(actorUserId);
    res
      .status(200)
      .json(successResponse(summary, "Earnings summary fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const listSellerSettlements: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const query = req.query as unknown as ListSettlementsQueryInput;
    const result = await settlementService.listSellerSettlements(
      actorUserId,
      query,
    );
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

export const getSellerSettlementById: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SettlementIdParam;
    const batch = await settlementService.getSellerSettlementById(actorUserId, id);
    res
      .status(200)
      .json(successResponse(batch, "Settlement batch fetched successfully"));
  } catch (err) {
    next(err);
  }
};

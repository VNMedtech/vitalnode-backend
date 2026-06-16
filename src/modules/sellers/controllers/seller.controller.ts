import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { SellerApprovalService } from "../services/sellerApproval.service.js";
import { SellerService } from "../services/seller.service.js";
import type { DisableSellerBody } from "../validators/disableSeller.schema.js";
import type { EnableSellerBody } from "../validators/enableSeller.schema.js";
import type { ListSellersQueryInput } from "../validators/query.schema.js";
import type { RejectSellerBody } from "../validators/rejectSeller.schema.js";
import type { SellerIdParam } from "../validators/sellerParams.schema.js";

const sellerService = new SellerService();
const sellerApprovalService = new SellerApprovalService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listSellers: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListSellersQueryInput;
    const result = await sellerService.listSellers(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Sellers fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getSellerById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as SellerIdParam;
    const seller = await sellerService.getSellerById(id);
    res
      .status(200)
      .json(successResponse(seller, "Seller fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const approveSeller: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerIdParam;
    const seller = await sellerApprovalService.approveSeller(actorUserId, id);
    res
      .status(200)
      .json(successResponse(seller, "Seller approved successfully"));
  } catch (err) {
    next(err);
  }
};

export const rejectSeller: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerIdParam;
    const body = req.body as RejectSellerBody;
    const seller = await sellerApprovalService.rejectSeller(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(seller, "Seller rejected successfully"));
  } catch (err) {
    next(err);
  }
};

export const disableSeller: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerIdParam;
    const body = req.body as DisableSellerBody;
    const seller = await sellerApprovalService.disableSeller(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(seller, "Seller disabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const enableSeller: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerIdParam;
    const body = req.body as EnableSellerBody;
    const seller = await sellerApprovalService.enableSeller(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(seller, "Seller re-enabled successfully"));
  } catch (err) {
    next(err);
  }
};

import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { SellerAddressService } from "../services/sellerAddress.service.js";
import type { CreateSellerAddressBody } from "../validators/createSellerAddress.schema.js";
import type { ListSellerAddressesQueryInput } from "../validators/query.schema.js";
import type {
  SellerAddressIdParam,
  SellerIdAddressesParam,
} from "../validators/sellerAddressParams.schema.js";
import type { UpdateSellerAddressBody } from "../validators/updateSellerAddress.schema.js";

const sellerAddressService = new SellerAddressService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const createAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateSellerAddressBody;
    const address = await sellerAddressService.createAddress(actorUserId, body);
    res
      .status(201)
      .json(successResponse(address, "Warehouse address created successfully"));
  } catch (err) {
    next(err);
  }
};

export const getAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerAddressIdParam;
    const address = await sellerAddressService.getAddress(actorUserId, id);
    res
      .status(200)
      .json(successResponse(address, "Warehouse address fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerAddressIdParam;
    const body = req.body as UpdateSellerAddressBody;
    const address = await sellerAddressService.updateAddress(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(address, "Warehouse address updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerAddressIdParam;
    const address = await sellerAddressService.deleteAddress(actorUserId, id);
    res
      .status(200)
      .json(successResponse(address, "Warehouse address deleted successfully"));
  } catch (err) {
    next(err);
  }
};

export const disableAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerAddressIdParam;
    const address = await sellerAddressService.disableAddress(actorUserId, id);
    res
      .status(200)
      .json(successResponse(address, "Warehouse address disabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const setDefaultAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as SellerAddressIdParam;
    const address = await sellerAddressService.setDefaultAddress(
      actorUserId,
      id,
    );
    res
      .status(200)
      .json(
        successResponse(address, "Default warehouse address set successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const listAddresses: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const query = req.query as unknown as ListSellerAddressesQueryInput;
    const result = await sellerAddressService.listAddresses(actorUserId, query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Warehouse addresses fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const listAddressesForSeller: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    requireAuthenticatedUserId(req);
    const { id: sellerId } = req.params as SellerIdAddressesParam;
    const query = req.query as unknown as ListSellerAddressesQueryInput;
    const result = await sellerAddressService.listAddressesForSeller(
      sellerId,
      query,
    );
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Warehouse addresses fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

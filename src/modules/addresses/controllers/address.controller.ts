import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { AddressService } from "../services/address.service.js";
import type { AddressIdParam } from "../validators/addressParams.schema.js";
import type { CreateAddressBody } from "../validators/createAddress.schema.js";
import type { ListAddressesQueryInput } from "../validators/query.schema.js";
import type { UpdateAddressBody } from "../validators/updateAddress.schema.js";

const addressService = new AddressService();

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
    const body = req.body as CreateAddressBody;
    const address = await addressService.createAddress(actorUserId, body);
    res
      .status(201)
      .json(successResponse(address, "Address created successfully"));
  } catch (err) {
    next(err);
  }
};

export const getAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AddressIdParam;
    const address = await addressService.getAddress(actorUserId, id);
    res
      .status(200)
      .json(successResponse(address, "Address fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AddressIdParam;
    const body = req.body as UpdateAddressBody;
    const address = await addressService.updateAddress(actorUserId, id, body);
    res
      .status(200)
      .json(successResponse(address, "Address updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AddressIdParam;
    const address = await addressService.deleteAddress(actorUserId, id);
    res
      .status(200)
      .json(successResponse(address, "Address deleted successfully"));
  } catch (err) {
    next(err);
  }
};

export const setDefaultAddress: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as AddressIdParam;
    const address = await addressService.setDefaultAddress(actorUserId, id);
    res
      .status(200)
      .json(successResponse(address, "Default address set successfully"));
  } catch (err) {
    next(err);
  }
};

export const listAddresses: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const query = req.query as unknown as ListAddressesQueryInput;
    const result = await addressService.listAddresses(actorUserId, query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Addresses fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

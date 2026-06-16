import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { DeliveryPartnerService } from "../services/deliveryPartner.service.js";
import type { CreateDeliveryPartnerBody } from "../validators/createDeliveryPartner.schema.js";
import type { DeliveryPartnerIdParam } from "../validators/deliveryPartnerParams.schema.js";
import type { DisableDeliveryPartnerBody } from "../validators/disableDeliveryPartner.schema.js";
import type { EnableDeliveryPartnerBody } from "../validators/enableDeliveryPartner.schema.js";
import type { ListDeliveryPartnersQueryInput } from "../validators/query.schema.js";
import type { UpdateDeliveryPartnerBody } from "../validators/updateDeliveryPartner.schema.js";

const deliveryPartnerService = new DeliveryPartnerService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const createDeliveryPartner: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateDeliveryPartnerBody;
    const result = await deliveryPartnerService.createDeliveryPartner(
      actorUserId,
      body,
    );
    res.status(201).json(
      successResponse(
        {
          deliveryPartner: result.deliveryPartner,
          temporaryPassword: result.temporaryPassword,
        },
        "Delivery partner created successfully",
      ),
    );
  } catch (err) {
    next(err);
  }
};

export const updateDeliveryPartner: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as DeliveryPartnerIdParam;
    const body = req.body as UpdateDeliveryPartnerBody;
    const partner = await deliveryPartnerService.updateDeliveryPartner(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(partner, "Delivery partner updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const disableDeliveryPartner: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as DeliveryPartnerIdParam;
    const body = req.body as DisableDeliveryPartnerBody;
    const partner = await deliveryPartnerService.disableDeliveryPartner(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(partner, "Delivery partner disabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const enableDeliveryPartner: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as DeliveryPartnerIdParam;
    const body = req.body as EnableDeliveryPartnerBody;
    const partner = await deliveryPartnerService.enableDeliveryPartner(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(
        successResponse(partner, "Delivery partner re-enabled successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const listDeliveryPartners: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListDeliveryPartnersQueryInput;
    const result = await deliveryPartnerService.listDeliveryPartners(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Delivery partners fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getDeliveryPartnerById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as DeliveryPartnerIdParam;
    const partner = await deliveryPartnerService.getDeliveryPartnerById(id);
    res
      .status(200)
      .json(successResponse(partner, "Delivery partner fetched successfully"));
  } catch (err) {
    next(err);
  }
};

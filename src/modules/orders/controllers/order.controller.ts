import type { RequestHandler } from "express";
import { getIdempotencyKey } from "../../../middlewares/idempotency.middleware.js";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import { UserRole } from "../../../shared/enums/userRole.enum.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import type { AssignDeliveryPartnerBody } from "../validators/assignDeliveryPartner.schema.js";
import type {
  CancelOrderBody,
  CancelOrderByIdBody,
} from "../validators/cancelOrder.schema.js";
import type { CreateOrderBody } from "../validators/createOrder.schema.js";
import type { OrderIdParam } from "../validators/orderParams.schema.js";
import type { ListOrdersQueryInput } from "../validators/query.schema.js";
import type { DeliveryFailedBody } from "../validators/updateOrderStatus.schema.js";
import { CheckoutService } from "../services/checkout.service.js";
import { DeliveryAssignmentService } from "../services/deliveryAssignment.service.js";
import { OrderCancellationService } from "../services/orderCancellation.service.js";
import { OrderService } from "../services/order.service.js";
import { OrderStatusService } from "../services/orderStatus.service.js";

const checkoutService = new CheckoutService();
const orderService = new OrderService();
const orderStatusService = new OrderStatusService();
const orderCancellationService = new OrderCancellationService();
const deliveryAssignmentService = new DeliveryAssignmentService();

function requireAuthenticatedUser(req: Parameters<RequestHandler>[0]): {
  id: string;
  role: UserRole;
} {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }

  return {
    id: req.user.id,
    role: req.user.role,
  };
}

export const checkout: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const body = req.body as CreateOrderBody;
    const result = await checkoutService.checkout(
      actor.id,
      body,
      getIdempotencyKey(req),
    );
    res
      .status(201)
      .json(successResponse(result, "Order created successfully"));
  } catch (err) {
    next(err);
  }
};

export const listOrders: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const query = req.query as unknown as ListOrdersQueryInput;
    const result = await orderService.listOrders(actor.id, actor.role, query);
    res
      .status(200)
      .json(
        paginatedResponse(result.items, result.meta, "Orders fetched successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const listAssignedOrders: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const query = req.query as unknown as ListOrdersQueryInput;
    const result = await orderService.listAssignedOrders(actor.id, query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Assigned orders fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getOrderDetails: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const order = await orderService.getOrderDetails(actor.id, actor.role, id);
    res
      .status(200)
      .json(successResponse(order, "Order fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const cancelOrder: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const body = req.body as CancelOrderBody;
    const order = await orderCancellationService.cancelOrderByBuyer(
      actor.id,
      body,
      getIdempotencyKey(req),
    );
    res
      .status(200)
      .json(successResponse(order, "Order cancelled successfully"));
  } catch (err) {
    next(err);
  }
};

export const cancelOrderById: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const body = req.body as CancelOrderByIdBody;
    const order = await orderCancellationService.cancelOrder(
      actor.id,
      actor.role,
      id,
      body.reason,
      getIdempotencyKey(req),
    );
    res
      .status(200)
      .json(successResponse(order, "Order cancelled successfully"));
  } catch (err) {
    next(err);
  }
};

export const processOrder: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const order = await orderStatusService.processOrder(actor.id, id);
    res
      .status(200)
      .json(successResponse(order, "Order processing started successfully"));
  } catch (err) {
    next(err);
  }
};

export const uploadHandoverProof: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const order = await orderStatusService.uploadHandoverProof(
      actor.id,
      id,
      req.file,
    );
    res
      .status(200)
      .json(successResponse(order, "Handover proof uploaded successfully"));
  } catch (err) {
    next(err);
  }
};

export const markOutForDelivery: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const order = await orderStatusService.markOutForDelivery(
      actor.id,
      id,
      req.file,
    );
    res
      .status(200)
      .json(successResponse(order, "Order marked out for delivery successfully"));
  } catch (err) {
    next(err);
  }
};

export const uploadDeliveryProof: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const order = await orderStatusService.uploadDeliveryProof(
      actor.id,
      id,
      req.file,
    );
    res
      .status(200)
      .json(successResponse(order, "Delivery proof uploaded successfully"));
  } catch (err) {
    next(err);
  }
};

export const markDelivered: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const order = await orderStatusService.markDelivered(actor.id, id, req.file);
    res
      .status(200)
      .json(successResponse(order, "Order marked delivered successfully"));
  } catch (err) {
    next(err);
  }
};

export const markDeliveryFailed: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const body = req.body as DeliveryFailedBody;
    const order = await orderStatusService.markDeliveryFailed(actor.id, id, body);
    res
      .status(200)
      .json(successResponse(order, "Order marked delivery failed successfully"));
  } catch (err) {
    next(err);
  }
};

export const assignDeliveryPartner: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const body = req.body as AssignDeliveryPartnerBody;
    const order = await deliveryAssignmentService.assignDeliveryPartner(
      actor.id,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(order, "Delivery partner assigned successfully"));
  } catch (err) {
    next(err);
  }
};

export const reassignDeliveryPartner: RequestHandler = async (req, res, next) => {
  try {
    const actor = requireAuthenticatedUser(req);
    const { id } = req.params as OrderIdParam;
    const body = req.body as AssignDeliveryPartnerBody;
    const order = await deliveryAssignmentService.reassignDeliveryPartner(
      actor.id,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(order, "Delivery partner reassigned successfully"));
  } catch (err) {
    next(err);
  }
};

import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import { successResponse } from "../../../shared/responses/api.response.js";
import type { AddCartItemBody } from "../validators/addCartItem.schema.js";
import type { CartItemIdParam } from "../validators/cartItemParams.schema.js";
import type { UpdateCartItemBody } from "../validators/updateCartItem.schema.js";
import { CartService } from "../services/cart.service.js";

const cartService = new CartService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const getCart: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const cart = await cartService.getCart(actorUserId);
    res.status(200).json(successResponse(cart, "Cart fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const addCartItem: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as AddCartItemBody;
    const cart = await cartService.addItem(actorUserId, body);
    res.status(200).json(successResponse(cart, "Item added to cart successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateCartItem: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { itemId } = req.params as CartItemIdParam;
    const body = req.body as UpdateCartItemBody;
    const cart = await cartService.updateItemQuantity(actorUserId, itemId, body);
    res
      .status(200)
      .json(successResponse(cart, "Cart item updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const removeCartItem: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { itemId } = req.params as CartItemIdParam;
    const cart = await cartService.removeItem(actorUserId, itemId);
    res
      .status(200)
      .json(successResponse(cart, "Cart item removed successfully"));
  } catch (err) {
    next(err);
  }
};

export const clearCart: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const cart = await cartService.clearCart(actorUserId);
    res.status(200).json(successResponse(cart, "Cart cleared successfully"));
  } catch (err) {
    next(err);
  }
};

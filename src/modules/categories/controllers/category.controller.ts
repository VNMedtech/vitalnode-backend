import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import type { CategoryIdParam } from "../validators/categoryParams.schema.js";
import type { CreateCategoryBody } from "../validators/createCategory.schema.js";
import type { ListCategoriesQueryInput } from "../validators/query.schema.js";
import type { UpdateCategoryBody } from "../validators/updateCategory.schema.js";
import { CategoryService } from "../services/category.service.js";

const categoryService = new CategoryService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const createCategory: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateCategoryBody;
    const category = await categoryService.createCategory(actorUserId, body);
    res
      .status(201)
      .json(successResponse(category, "Category created successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateCategory: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as CategoryIdParam;
    const body = req.body as UpdateCategoryBody;
    const category = await categoryService.updateCategory(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(category, "Category updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const disableCategory: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as CategoryIdParam;
    const category = await categoryService.disableCategory(actorUserId, id);
    res
      .status(200)
      .json(successResponse(category, "Category disabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const listCategories: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListCategoriesQueryInput;
    const result = await categoryService.listCategories(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Categories fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getCategoryById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as CategoryIdParam;
    const category = await categoryService.getCategoryById(id);
    res
      .status(200)
      .json(successResponse(category, "Category fetched successfully"));
  } catch (err) {
    next(err);
  }
};

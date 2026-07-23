import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { ProductTemplateService } from "../services/productTemplate.service.js";
import type {
  CreateProductTemplateBody,
  ReplaceProductTemplateCategoriesBody,
  ReplaceProductTemplateFieldsBody,
  UpdateProductTemplateBody,
} from "../validators/createProductTemplate.schema.js";
import type {
  ListProductTemplatesQueryInput,
  ProductTemplateIdParam,
  SearchProductTemplatesQueryInput,
} from "../validators/query.schema.js";

const productTemplateService = new ProductTemplateService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listTemplates: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListProductTemplatesQueryInput;
    const result = await productTemplateService.listTemplates(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Product templates fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const searchTemplates: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as SearchProductTemplatesQueryInput;
    const items = await productTemplateService.searchTemplates(query);
    res
      .status(200)
      .json(
        successResponse(items, "Product templates fetched successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const getTemplateById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as ProductTemplateIdParam;
    const template = await productTemplateService.getTemplateById(id);
    res
      .status(200)
      .json(
        successResponse(template, "Product template fetched successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const createTemplate: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateProductTemplateBody;
    const template = await productTemplateService.createTemplate(
      actorUserId,
      body,
    );
    res
      .status(201)
      .json(
        successResponse(template, "Product template created successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const updateTemplate: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductTemplateIdParam;
    const body = req.body as UpdateProductTemplateBody;
    const template = await productTemplateService.updateTemplate(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(
        successResponse(template, "Product template updated successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const disableTemplate: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductTemplateIdParam;
    const template = await productTemplateService.disableTemplate(
      actorUserId,
      id,
    );
    res
      .status(200)
      .json(
        successResponse(template, "Product template disabled successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const replaceFields: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductTemplateIdParam;
    const body = req.body as ReplaceProductTemplateFieldsBody;
    const template = await productTemplateService.replaceFields(
      actorUserId,
      id,
      body.fields,
    );
    res
      .status(200)
      .json(
        successResponse(
          template,
          "Product template fields updated successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const replaceCategories: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductTemplateIdParam;
    const body = req.body as ReplaceProductTemplateCategoriesBody;
    const template = await productTemplateService.replaceCategories(
      actorUserId,
      id,
      body.categoryIds,
    );
    res
      .status(200)
      .json(
        successResponse(
          template,
          "Product template categories updated successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

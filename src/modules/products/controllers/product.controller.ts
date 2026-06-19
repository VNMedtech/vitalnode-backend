import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { ProductApprovalService } from "../services/productApproval.service.js";
import { ProductService } from "../services/product.service.js";
import { extractProductUploadFiles } from "../utils/productUpload.util.js";
import type { CreateProductMultipartBody } from "../validators/productMultipart.schema.js";
import type { ProductIdParam } from "../validators/productParams.schema.js";
import type {
  ListMarketplaceProductsQueryInput,
  ListOwnProductsQueryInput,
  ListPendingProductsQueryInput,
} from "../validators/query.schema.js";
import type { RejectProductBody } from "../validators/rejectProduct.schema.js";
import type { UpdateProductMultipartBody } from "../validators/productMultipart.schema.js";
import type { CompareProductsQueryInput } from "../validators/compareProducts.schema.js";

const productService = new ProductService();
const productApprovalService = new ProductApprovalService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const listMarketplaceProducts: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListMarketplaceProductsQueryInput;
    const result = await productService.listMarketplaceProducts(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Products fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getMarketplaceProductById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as ProductIdParam;
    const product = await productService.getMarketplaceProductById(id);
    res
      .status(200)
      .json(successResponse(product, "Product fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const compareMarketplaceProducts: RequestHandler = async (req, res, next) => {
  try {
    const { productIds } = req.query as unknown as CompareProductsQueryInput;
    const comparison = await productService.compareMarketplaceProducts(productIds);
    res
      .status(200)
      .json(
        successResponse(comparison, "Products compared successfully"),
      );
  } catch (err) {
    next(err);
  }
};

export const listOwnProducts: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const query = req.query as unknown as ListOwnProductsQueryInput;
    const result = await productService.listOwnProducts(actorUserId, query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Your products fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getOwnProductById: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductIdParam;
    const product = await productService.getOwnProductById(actorUserId, id);
    res
      .status(200)
      .json(successResponse(product, "Product fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const createProduct: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateProductMultipartBody;
    const files = extractProductUploadFiles(req);
    const product = await productService.createProduct(actorUserId, body, files);
    res
      .status(201)
      .json(successResponse(product, "Product created successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateProduct: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductIdParam;
    const body = req.body as UpdateProductMultipartBody;
    const files = extractProductUploadFiles(req);
    const product = await productService.updateProduct(
      actorUserId,
      id,
      body,
      files,
    );
    res
      .status(200)
      .json(successResponse(product, "Product updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const disableProduct: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductIdParam;
    const product = await productService.disableProduct(actorUserId, id);
    res
      .status(200)
      .json(successResponse(product, "Product disabled successfully"));
  } catch (err) {
    next(err);
  }
};

export const approveProduct: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductIdParam;
    const product = await productApprovalService.approveProduct(
      actorUserId,
      id,
    );
    res
      .status(200)
      .json(successResponse(product, "Product approved successfully"));
  } catch (err) {
    next(err);
  }
};

export const rejectProduct: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as ProductIdParam;
    const body = req.body as RejectProductBody;
    const product = await productApprovalService.rejectProduct(
      actorUserId,
      id,
      body,
    );
    res
      .status(200)
      .json(successResponse(product, "Product rejected successfully"));
  } catch (err) {
    next(err);
  }
};

export const listPendingProducts: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListPendingProductsQueryInput;
    const result = await productApprovalService.listPendingProducts(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Pending products fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

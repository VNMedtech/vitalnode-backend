import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { MarketplaceTeaserService } from "../services/marketplaceTeaser.service.js";
import type {
  CreateTeaserBody,
  ListPublicTeasersQuery,
  ListTeasersQuery,
  TeaserIdParam,
  UpdateTeaserBody,
} from "../validators/marketplaceTeaser.schemas.js";

const service = new MarketplaceTeaserService();

function requireUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.user?.id) throw new UnauthorizedError("Authentication required");
  return req.user.id;
}

export const listPublicTeasers: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListPublicTeasersQuery;
    const result = await service.list({
      page: query.page,
      limit: query.limit,
      type: query.type,
      search: query.search,
      publicOnly: true,
    });
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Teasers fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const listAdminTeasers: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListTeasersQuery;
    const result = await service.list({
      page: query.page,
      limit: query.limit,
      type: query.type,
      search: query.search,
      isPublished: query.isPublished,
      publicOnly: false,
    });
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Teasers fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getAdminTeaser: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as TeaserIdParam;
    const data = await service.getById(id, false);
    res.status(200).json(successResponse(data, "Teaser fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const createTeaser: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const body = req.body as CreateTeaserBody;
    const data = await service.create(actorUserId, body);
    res.status(201).json(successResponse(data, "Teaser created successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateTeaser: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as TeaserIdParam;
    const body = req.body as UpdateTeaserBody;
    const data = await service.update(actorUserId, id, body);
    res.status(200).json(successResponse(data, "Teaser updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteTeaser: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireUserId(req);
    const { id } = req.params as TeaserIdParam;
    const data = await service.delete(actorUserId, id);
    res.status(200).json(successResponse(data, "Teaser deleted successfully"));
  } catch (err) {
    next(err);
  }
};

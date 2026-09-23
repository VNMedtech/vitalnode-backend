import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/app.errors.js";
import {
  paginatedResponse,
  successResponse,
} from "../../../shared/responses/api.response.js";
import { TechBlogService } from "../services/techBlog.service.js";
import type {
  CreateTechBlogBody,
  ListTechBlogsQueryInput,
  TechBlogIdParam,
  TechBlogSlugParam,
  UpdateTechBlogBody,
} from "../validators/techBlog.schemas.js";

const techBlogService = new TechBlogService();

function requireAuthenticatedUserId(
  req: Parameters<RequestHandler>[0],
): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Authentication required");
  }
  return req.user.id;
}

export const createTechBlog: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const body = req.body as CreateTechBlogBody;
    const blog = await techBlogService.createBlog(actorUserId, body);
    res.status(201).json(successResponse(blog, "Blog created successfully"));
  } catch (err) {
    next(err);
  }
};

export const updateTechBlog: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as TechBlogIdParam;
    const body = req.body as UpdateTechBlogBody;
    const blog = await techBlogService.updateBlog(actorUserId, id, body);
    res.status(200).json(successResponse(blog, "Blog updated successfully"));
  } catch (err) {
    next(err);
  }
};

export const publishTechBlog: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as TechBlogIdParam;
    const blog = await techBlogService.publishBlog(actorUserId, id);
    res.status(200).json(successResponse(blog, "Blog published successfully"));
  } catch (err) {
    next(err);
  }
};

export const unpublishTechBlog: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as TechBlogIdParam;
    const blog = await techBlogService.unpublishBlog(actorUserId, id);
    res
      .status(200)
      .json(successResponse(blog, "Blog unpublished successfully"));
  } catch (err) {
    next(err);
  }
};

export const deleteTechBlog: RequestHandler = async (req, res, next) => {
  try {
    const actorUserId = requireAuthenticatedUserId(req);
    const { id } = req.params as TechBlogIdParam;
    const blog = await techBlogService.deleteBlog(actorUserId, id);
    res.status(200).json(successResponse(blog, "Blog deleted successfully"));
  } catch (err) {
    next(err);
  }
};

export const listPublicTechBlogs: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListTechBlogsQueryInput;
    const result = await techBlogService.listPublicBlogs(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Blogs fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const listAdminTechBlogs: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as ListTechBlogsQueryInput;
    const result = await techBlogService.listAdminBlogs(query);
    res
      .status(200)
      .json(
        paginatedResponse(
          result.items,
          result.meta,
          "Blogs fetched successfully",
        ),
      );
  } catch (err) {
    next(err);
  }
};

export const getFeaturedTechBlog: RequestHandler = async (_req, res, next) => {
  try {
    const blog = await techBlogService.getFeaturedBlog();
    res
      .status(200)
      .json(successResponse(blog, "Featured blog fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const listTechBlogCategories: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const publicOnly = req.query.admin !== "true";
    const categories = await techBlogService.listCategories(publicOnly);
    res
      .status(200)
      .json(successResponse(categories, "Categories fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getPublicTechBlogBySlug: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const { slug } = req.params as TechBlogSlugParam;
    const blog = await techBlogService.getPublicBlogBySlug(slug);
    res.status(200).json(successResponse(blog, "Blog fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getAdminTechBlogById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as TechBlogIdParam;
    const blog = await techBlogService.getAdminBlogById(id);
    res.status(200).json(successResponse(blog, "Blog fetched successfully"));
  } catch (err) {
    next(err);
  }
};

export const getPublicTechBlogById: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as TechBlogIdParam;
    const blog = await techBlogService.getPublicBlogById(id);
    res.status(200).json(successResponse(blog, "Blog fetched successfully"));
  } catch (err) {
    next(err);
  }
};

/**
 * @openapi
 * tags:
 *   - name: Tech Blogs
 *     description: Tech Blog CMS and public blog endpoints
 */
import { Router } from "express";
import {
  authenticate,
  authorizePermission,
  validate,
} from "../../../middlewares/index.js";
import { permissions } from "../../../shared/permissions/rbac.permissions.js";
import * as techBlogController from "../controllers/techBlog.controller.js";
import {
  createTechBlogBodySchema,
  listTechBlogsQuerySchema,
  techBlogIdParamSchema,
  techBlogSlugParamSchema,
  updateTechBlogBodySchema,
} from "../validators/techBlog.schemas.js";

export const techBlogRouter = Router();

techBlogRouter.get(
  "/",
  validate({ query: listTechBlogsQuerySchema }),
  techBlogController.listPublicTechBlogs,
);

techBlogRouter.get("/featured", techBlogController.getFeaturedTechBlog);

techBlogRouter.get("/categories", techBlogController.listTechBlogCategories);

techBlogRouter.get(
  "/slug/:slug",
  validate({ params: techBlogSlugParamSchema }),
  techBlogController.getPublicTechBlogBySlug,
);

techBlogRouter.get(
  "/admin",
  authenticate,
  authorizePermission(permissions.techBlogs.read),
  validate({ query: listTechBlogsQuerySchema }),
  techBlogController.listAdminTechBlogs,
);

techBlogRouter.get(
  "/admin/:id",
  authenticate,
  authorizePermission(permissions.techBlogs.read),
  validate({ params: techBlogIdParamSchema }),
  techBlogController.getAdminTechBlogById,
);

techBlogRouter.get(
  "/:id",
  validate({ params: techBlogIdParamSchema }),
  techBlogController.getPublicTechBlogById,
);

techBlogRouter.post(
  "/",
  authenticate,
  authorizePermission(permissions.techBlogs.create),
  validate({ body: createTechBlogBodySchema }),
  techBlogController.createTechBlog,
);

techBlogRouter.patch(
  "/:id",
  authenticate,
  authorizePermission(permissions.techBlogs.update),
  validate({
    params: techBlogIdParamSchema,
    body: updateTechBlogBodySchema,
  }),
  techBlogController.updateTechBlog,
);

techBlogRouter.post(
  "/:id/publish",
  authenticate,
  authorizePermission(permissions.techBlogs.publish),
  validate({ params: techBlogIdParamSchema }),
  techBlogController.publishTechBlog,
);

techBlogRouter.post(
  "/:id/unpublish",
  authenticate,
  authorizePermission(permissions.techBlogs.publish),
  validate({ params: techBlogIdParamSchema }),
  techBlogController.unpublishTechBlog,
);

techBlogRouter.delete(
  "/:id",
  authenticate,
  authorizePermission(permissions.techBlogs.delete),
  validate({ params: techBlogIdParamSchema }),
  techBlogController.deleteTechBlog,
);

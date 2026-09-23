import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { buildPaginationMeta } from "../../../shared/responses/api.response.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  TECH_BLOG_ACTIONS,
  TECH_BLOG_AUDIT_ENTITY_TYPE,
} from "../constants/techBlog.constants.js";
import {
  toSignedTechBlogDto,
  toSignedTechBlogListItemDto,
} from "../dto/techBlog.dto.js";
import { TechBlogRepository } from "../repositories/techBlog.repository.js";
import type {
  CreateTechBlogInput,
  ListTechBlogsQuery,
  TechBlogDto,
  TechBlogListItemDto,
  UpdateTechBlogInput,
} from "../types/techBlog.types.js";
import {
  normalizeBlogHtmlMediaUrls,
  toPermanentS3ObjectUrl,
} from "../utils/blogMediaUrl.util.js";

function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 220);
}

function parsePublishDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Validation failed", [
      { field: "publishDate", message: "Invalid publish date" },
    ]);
  }
  return date;
}

function normalizeMediaFields(input: {
  featuredImageUrl?: string | null;
  content?: string;
}) {
  return {
    ...(input.featuredImageUrl !== undefined
      ? {
          featuredImageUrl: toPermanentS3ObjectUrl(input.featuredImageUrl),
        }
      : {}),
    ...(input.content !== undefined
      ? { content: normalizeBlogHtmlMediaUrls(input.content) }
      : {}),
  };
}

function buildUpdateMetadata(
  before: {
    title: string;
    slug: string;
    shortDescription: string;
    category: string;
    tags: string[];
    featuredImageUrl: string | null;
    content: string;
    publishDate: Date | null;
    isFeatured: boolean;
    status: string;
  },
  input: UpdateTechBlogInput,
): Record<string, unknown> {
  const changedFields: string[] = [];
  const keys: (keyof UpdateTechBlogInput)[] = [
    "title",
    "slug",
    "shortDescription",
    "category",
    "tags",
    "featuredImageUrl",
    "featuredImageUploadId",
    "content",
    "publishDate",
    "isFeatured",
    "status",
  ];

  for (const key of keys) {
    if (input[key] !== undefined) {
      changedFields.push(key);
    }
  }

  return {
    changedFields,
    previousStatus: before.status,
    previousTitle: before.title,
  };
}

export class TechBlogService {
  private readonly repo = new TechBlogRepository(prisma);

  private async resolveUniqueSlug(baseSlug: string, excludeId?: string) {
    let candidate = baseSlug || "blog-post";
    let suffix = 0;

    while (await this.repo.findBySlug(candidate, excludeId)) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`.slice(0, 220);
    }

    return candidate;
  }

  async createBlog(
    actorUserId: string,
    input: CreateTechBlogInput,
  ): Promise<TechBlogDto> {
    const baseSlug = slugifyTitle(input.slug || input.title);
    if (!baseSlug) {
      throw new ValidationError("Validation failed", [
        { field: "slug", message: "A valid slug is required" },
      ]);
    }

    const slug = await this.resolveUniqueSlug(baseSlug);
    const status = input.status ?? "DRAFT";
    const publishDate =
      parsePublishDate(input.publishDate) ??
      (status === "PUBLISHED" ? new Date() : null);
    const isFeatured = Boolean(input.isFeatured);

    const media = normalizeMediaFields({
      featuredImageUrl: input.featuredImageUrl,
      content: input.content,
    });

    try {
      const created = await prisma.$transaction(async (tx) => {
        const txRepo = new TechBlogRepository(tx);
        const blog = await txRepo.create({
          title: input.title,
          slug,
          shortDescription: input.shortDescription,
          category: input.category,
          tags: input.tags ?? [],
          featuredImageUrl: media.featuredImageUrl,
          featuredImageUploadId: input.featuredImageUploadId,
          content: media.content ?? input.content,
          publishDate,
          isFeatured,
          status,
          authorUserId: actorUserId,
        });

        if (isFeatured) {
          await txRepo.clearFeaturedExcept(blog.id);
        }

        return blog;
      });

      auditLogger.log({
        actorUserId,
        action: TECH_BLOG_ACTIONS.CREATE,
        entityType: TECH_BLOG_AUDIT_ENTITY_TYPE,
        entityId: created.id,
        metadata: {
          title: created.title,
          slug: created.slug,
          status: created.status,
        },
      });

      if (created.status === "PUBLISHED") {
        auditLogger.log({
          actorUserId,
          action: TECH_BLOG_ACTIONS.PUBLISH,
          entityType: TECH_BLOG_AUDIT_ENTITY_TYPE,
          entityId: created.id,
          metadata: { title: created.title, slug: created.slug },
        });
      }

      return toSignedTechBlogDto(created);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Blog slug already exists");
      }
      throw error;
    }
  }

  async updateBlog(
    actorUserId: string,
    id: string,
    input: UpdateTechBlogInput,
  ): Promise<TechBlogDto> {
    const existing = await this.repo.findByIdNotDeleted(id);
    if (!existing) {
      throw new NotFoundError("Blog not found");
    }

    let nextSlug: string | undefined;
    if (input.slug !== undefined) {
      const baseSlug = slugifyTitle(input.slug);
      if (!baseSlug) {
        throw new ValidationError("Validation failed", [
          { field: "slug", message: "A valid slug is required" },
        ]);
      }
      nextSlug = await this.resolveUniqueSlug(baseSlug, id);
    }

    const nextStatus = input.status ?? existing.status;
    const parsedPublishDate = parsePublishDate(input.publishDate);
    let publishDate = parsedPublishDate;
    if (
      publishDate === undefined &&
      nextStatus === "PUBLISHED" &&
      !existing.publishDate
    ) {
      publishDate = new Date();
    }

    const isFeatured =
      input.isFeatured !== undefined ? input.isFeatured : existing.isFeatured;
    const media = normalizeMediaFields({
      featuredImageUrl: input.featuredImageUrl,
      content: input.content,
    });

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const txRepo = new TechBlogRepository(tx);
        const blog = await txRepo.update(id, {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(nextSlug !== undefined ? { slug: nextSlug } : {}),
          ...(input.shortDescription !== undefined
            ? { shortDescription: input.shortDescription }
            : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.featuredImageUrl !== undefined
            ? { featuredImageUrl: media.featuredImageUrl }
            : {}),
          ...(input.featuredImageUploadId !== undefined
            ? { featuredImageUploadId: input.featuredImageUploadId }
            : {}),
          ...(input.content !== undefined
            ? { content: media.content ?? input.content }
            : {}),
          ...(publishDate !== undefined ? { publishDate } : {}),
          ...(input.isFeatured !== undefined
            ? { isFeatured: input.isFeatured }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        });

        if (isFeatured) {
          await txRepo.clearFeaturedExcept(id);
        }

        return blog;
      });

      auditLogger.log({
        actorUserId,
        action: TECH_BLOG_ACTIONS.UPDATE,
        entityType: TECH_BLOG_AUDIT_ENTITY_TYPE,
        entityId: id,
        metadata: buildUpdateMetadata(existing, input),
      });

      if (existing.status !== updated.status) {
        auditLogger.log({
          actorUserId,
          action:
            updated.status === "PUBLISHED"
              ? TECH_BLOG_ACTIONS.PUBLISH
              : TECH_BLOG_ACTIONS.UNPUBLISH,
          entityType: TECH_BLOG_AUDIT_ENTITY_TYPE,
          entityId: id,
          metadata: {
            title: updated.title,
            slug: updated.slug,
            previousStatus: existing.status,
            status: updated.status,
          },
        });
      }

      return toSignedTechBlogDto(updated);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictError("Blog slug already exists");
      }
      throw error;
    }
  }

  async publishBlog(actorUserId: string, id: string): Promise<TechBlogDto> {
    return this.updateBlog(actorUserId, id, {
      status: "PUBLISHED",
      publishDate: new Date().toISOString(),
    });
  }

  async unpublishBlog(actorUserId: string, id: string): Promise<TechBlogDto> {
    return this.updateBlog(actorUserId, id, { status: "DRAFT" });
  }

  async deleteBlog(actorUserId: string, id: string): Promise<TechBlogDto> {
    const existing = await this.repo.findByIdNotDeleted(id);
    if (!existing) {
      throw new NotFoundError("Blog not found");
    }

    const deleted = await this.repo.softDelete(id);

    auditLogger.log({
      actorUserId,
      action: TECH_BLOG_ACTIONS.DELETE,
      entityType: TECH_BLOG_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        title: existing.title,
        slug: existing.slug,
        previousStatus: existing.status,
      },
    });

    return toSignedTechBlogDto(deleted);
  }

  async listPublicBlogs(query: ListTechBlogsQuery): Promise<{
    items: TechBlogListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const options = {
      ...query,
      publicOnly: true as const,
      status: undefined,
    };

    const [records, total] = await Promise.all([
      this.repo.findManyPaginated(options),
      this.repo.count(options),
    ]);

    return {
      items: await Promise.all(records.map(toSignedTechBlogListItemDto)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async listAdminBlogs(query: ListTechBlogsQuery): Promise<{
    items: TechBlogListItemDto[];
    meta: ReturnType<typeof buildPaginationMeta>;
  }> {
    const options = {
      ...query,
      publicOnly: false as const,
    };

    const [records, total] = await Promise.all([
      this.repo.findManyPaginated(options),
      this.repo.count(options),
    ]);

    return {
      items: await Promise.all(records.map(toSignedTechBlogListItemDto)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async getPublicBlogBySlug(slug: string): Promise<TechBlogDto> {
    const blog = await this.repo.findPublishedBySlug(slug);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    return toSignedTechBlogDto(blog);
  }

  async getPublicBlogById(id: string): Promise<TechBlogDto> {
    const blog = await this.repo.findPublishedById(id);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    return toSignedTechBlogDto(blog);
  }

  async getAdminBlogById(id: string): Promise<TechBlogDto> {
    const blog = await this.repo.findByIdNotDeleted(id);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    return toSignedTechBlogDto(blog);
  }

  async getFeaturedBlog(): Promise<TechBlogDto | null> {
    const blog = await this.repo.findFeaturedPublished();
    return blog ? toSignedTechBlogDto(blog) : null;
  }

  async listCategories(publicOnly: boolean): Promise<string[]> {
    const rows = await this.repo.listDistinctCategories(publicOnly);
    return rows.map((row) => row.category);
  }
}

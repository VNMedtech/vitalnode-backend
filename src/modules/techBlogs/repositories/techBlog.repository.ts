import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type {
  TechBlogSortField,
  TechBlogStatusValue,
} from "../constants/techBlog.constants.js";

const techBlogSelect = {
  id: true,
  title: true,
  slug: true,
  shortDescription: true,
  category: true,
  tags: true,
  featuredImageUrl: true,
  featuredImageUploadId: true,
  content: true,
  publishDate: true,
  isFeatured: true,
  status: true,
  authorUserId: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.TechBlogSelect;

export type TechBlogRecord = Prisma.TechBlogGetPayload<{
  select: typeof techBlogSelect;
}>;

export interface FindTechBlogsOptions {
  page: number;
  limit: number;
  sortBy: TechBlogSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  category?: string;
  tag?: string;
  status?: TechBlogStatusValue;
  featuredOnly?: boolean;
  publicOnly: boolean;
}

function buildWhere(
  options: Omit<FindTechBlogsOptions, "page" | "limit" | "sortBy" | "sortOrder">,
): Prisma.TechBlogWhereInput {
  const { search, category, tag, status, featuredOnly, publicOnly } = options;

  const andFilters: Prisma.TechBlogWhereInput[] = [];

  if (publicOnly) {
    andFilters.push({
      status: "PUBLISHED",
      OR: [{ publishDate: null }, { publishDate: { lte: new Date() } }],
    });
  } else if (status) {
    andFilters.push({ status });
  }

  if (category) {
    andFilters.push({
      category: { equals: category, mode: "insensitive" },
    });
  }

  if (tag) {
    andFilters.push({ tags: { has: tag } });
  }

  if (featuredOnly) {
    andFilters.push({ isFeatured: true });
  }

  if (search) {
    andFilters.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { shortDescription: { contains: search, mode: "insensitive" } },
        { category: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  return {
    deletedAt: null,
    ...(andFilters.length ? { AND: andFilters } : {}),
  };
}

export class TechBlogRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  create(data: {
    title: string;
    slug: string;
    shortDescription: string;
    category: string;
    tags: string[];
    featuredImageUrl?: string | null;
    featuredImageUploadId?: string | null;
    content: string;
    publishDate?: Date | null;
    isFeatured: boolean;
    status: TechBlogStatusValue;
    authorUserId: string;
  }) {
    return this.prisma.techBlog.create({
      data: {
        title: data.title,
        slug: data.slug,
        shortDescription: data.shortDescription,
        category: data.category,
        tags: data.tags,
        featuredImageUrl: data.featuredImageUrl ?? null,
        featuredImageUploadId: data.featuredImageUploadId ?? null,
        content: data.content,
        publishDate: data.publishDate ?? null,
        isFeatured: data.isFeatured,
        status: data.status,
        authorUserId: data.authorUserId,
      },
      select: techBlogSelect,
    });
  }

  findByIdNotDeleted(id: string) {
    return this.prisma.techBlog.findFirst({
      where: { id, deletedAt: null },
      select: techBlogSelect,
    });
  }

  findPublishedById(id: string) {
    return this.prisma.techBlog.findFirst({
      where: {
        id,
        deletedAt: null,
        status: "PUBLISHED",
        OR: [{ publishDate: null }, { publishDate: { lte: new Date() } }],
      },
      select: techBlogSelect,
    });
  }

  findPublishedBySlug(slug: string) {
    return this.prisma.techBlog.findFirst({
      where: {
        slug,
        deletedAt: null,
        status: "PUBLISHED",
        OR: [{ publishDate: null }, { publishDate: { lte: new Date() } }],
      },
      select: techBlogSelect,
    });
  }

  findBySlug(slug: string, excludeId?: string) {
    return this.prisma.techBlog.findFirst({
      where: {
        slug,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  }

  findFeaturedPublished() {
    return this.prisma.techBlog.findFirst({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        isFeatured: true,
        OR: [{ publishDate: null }, { publishDate: { lte: new Date() } }],
      },
      select: techBlogSelect,
      orderBy: { publishDate: "desc" },
    });
  }

  findManyPaginated(options: FindTechBlogsOptions) {
    const { page, limit, sortBy, sortOrder } = options;
    const skip = (page - 1) * limit;

    return this.prisma.techBlog.findMany({
      where: buildWhere(options),
      select: techBlogSelect,
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });
  }

  count(
    options: Omit<
      FindTechBlogsOptions,
      "page" | "limit" | "sortBy" | "sortOrder"
    >,
  ) {
    return this.prisma.techBlog.count({
      where: buildWhere(options),
    });
  }

  listDistinctCategories(publicOnly: boolean) {
    return this.prisma.techBlog.findMany({
      where: {
        deletedAt: null,
        ...(publicOnly
          ? {
              status: "PUBLISHED",
              OR: [{ publishDate: null }, { publishDate: { lte: new Date() } }],
            }
          : {}),
      },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
  }

  update(
    id: string,
    data: {
      title?: string;
      slug?: string;
      shortDescription?: string;
      category?: string;
      tags?: string[];
      featuredImageUrl?: string | null;
      featuredImageUploadId?: string | null;
      content?: string;
      publishDate?: Date | null;
      isFeatured?: boolean;
      status?: TechBlogStatusValue;
    },
  ) {
    return this.prisma.techBlog.update({
      where: { id },
      data,
      select: techBlogSelect,
    });
  }

  clearFeaturedExcept(excludeId: string) {
    return this.prisma.techBlog.updateMany({
      where: {
        deletedAt: null,
        isFeatured: true,
        id: { not: excludeId },
      },
      data: { isFeatured: false },
    });
  }

  softDelete(id: string, deletedAt = new Date()) {
    return this.prisma.techBlog.update({
      where: { id },
      data: {
        deletedAt,
        isFeatured: false,
        status: "DRAFT",
      },
      select: techBlogSelect,
    });
  }
}

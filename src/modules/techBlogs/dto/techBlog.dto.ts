import type { TechBlogRecord } from "../repositories/techBlog.repository.js";
import type {
  TechBlogDto,
  TechBlogListItemDto,
} from "../types/techBlog.types.js";
import {
  signBlogHtmlMediaUrls,
  signFeaturedImageUrl,
} from "../utils/blogMediaUrl.util.js";

function authorName(
  author: TechBlogRecord["author"] | null | undefined,
): string | null {
  if (!author) return null;
  return `${author.firstName} ${author.lastName}`.trim() || null;
}

export function toTechBlogDto(record: TechBlogRecord): TechBlogDto {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    shortDescription: record.shortDescription,
    category: record.category,
    tags: record.tags,
    featuredImageUrl: record.featuredImageUrl,
    featuredImageUploadId: record.featuredImageUploadId,
    content: record.content,
    publishDate: record.publishDate,
    isFeatured: record.isFeatured,
    status: record.status,
    authorUserId: record.authorUserId,
    authorName: authorName(record.author),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toTechBlogListItemDto(
  record: TechBlogRecord,
): TechBlogListItemDto {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    shortDescription: record.shortDescription,
    category: record.category,
    tags: record.tags,
    featuredImageUrl: record.featuredImageUrl,
    publishDate: record.publishDate,
    isFeatured: record.isFeatured,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function toSignedTechBlogDto(
  record: TechBlogRecord,
): Promise<TechBlogDto> {
  const dto = toTechBlogDto(record);
  const [featuredImageUrl, content] = await Promise.all([
    signFeaturedImageUrl(dto.featuredImageUrl),
    signBlogHtmlMediaUrls(dto.content),
  ]);
  return {
    ...dto,
    featuredImageUrl,
    content,
  };
}

export async function toSignedTechBlogListItemDto(
  record: TechBlogRecord,
): Promise<TechBlogListItemDto> {
  const dto = toTechBlogListItemDto(record);
  return {
    ...dto,
    featuredImageUrl: await signFeaturedImageUrl(dto.featuredImageUrl),
  };
}

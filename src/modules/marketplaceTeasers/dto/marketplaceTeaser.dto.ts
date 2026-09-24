import {
  signFeaturedImageUrl,
  toPermanentS3ObjectUrl,
} from "../../techBlogs/utils/blogMediaUrl.util.js";
import type { MarketplaceTeaserRecord } from "../repositories/marketplaceTeaser.repository.js";
import type { MarketplaceTeaserDto } from "../types/marketplaceTeaser.types.js";

export function toTeaserDto(
  record: MarketplaceTeaserRecord,
): MarketplaceTeaserDto {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    summary: record.summary,
    imageUrl: record.imageUrl,
    imageUploadId: record.imageUploadId,
    expectedAt: record.expectedAt,
    ctaLabel: record.ctaLabel,
    ctaUrl: record.ctaUrl,
    isPublished: record.isPublished,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function toSignedTeaserDto(
  record: MarketplaceTeaserRecord,
): Promise<MarketplaceTeaserDto> {
  const dto = toTeaserDto(record);
  dto.imageUrl = await signFeaturedImageUrl(record.imageUrl);
  return dto;
}

export function normalizeTeaserImageUrl(
  imageUrl: string | null | undefined,
): string | null | undefined {
  if (imageUrl === undefined) return undefined;
  if (imageUrl === null || imageUrl === "") return null;
  return toPermanentS3ObjectUrl(imageUrl) ?? imageUrl;
}

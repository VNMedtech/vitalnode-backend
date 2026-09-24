import type { MarketplaceTeaserTypeValue } from "../constants/marketplaceTeaser.constants.js";

export interface MarketplaceTeaserDto {
  id: string;
  type: MarketplaceTeaserTypeValue;
  title: string;
  summary: string;
  imageUrl: string | null;
  imageUploadId: string | null;
  expectedAt: Date | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMarketplaceTeaserInput {
  type: MarketplaceTeaserTypeValue;
  title: string;
  summary: string;
  imageUrl?: string | null;
  imageUploadId?: string | null;
  expectedAt?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}

export interface UpdateMarketplaceTeaserInput {
  type?: MarketplaceTeaserTypeValue;
  title?: string;
  summary?: string;
  imageUrl?: string | null;
  imageUploadId?: string | null;
  expectedAt?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}

export interface ListMarketplaceTeasersOptions {
  page: number;
  limit: number;
  type?: MarketplaceTeaserTypeValue;
  search?: string;
  isPublished?: boolean;
  publicOnly: boolean;
}

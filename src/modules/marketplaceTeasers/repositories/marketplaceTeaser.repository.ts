import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { MarketplaceTeaserTypeValue } from "../constants/marketplaceTeaser.constants.js";

const teaserSelect = {
  id: true,
  type: true,
  title: true,
  summary: true,
  imageUrl: true,
  imageUploadId: true,
  expectedAt: true,
  ctaLabel: true,
  ctaUrl: true,
  isPublished: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MarketplaceTeaserSelect;

export type MarketplaceTeaserRecord = Prisma.MarketplaceTeaserGetPayload<{
  select: typeof teaserSelect;
}>;

export class MarketplaceTeaserRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findById(id: string) {
    return this.prisma.marketplaceTeaser.findUnique({
      where: { id },
      select: teaserSelect,
    });
  }

  create(data: {
    type: MarketplaceTeaserTypeValue;
    title: string;
    summary: string;
    imageUrl?: string | null;
    imageUploadId?: string | null;
    expectedAt?: Date | null;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    isPublished: boolean;
    sortOrder: number;
  }) {
    return this.prisma.marketplaceTeaser.create({
      data: {
        type: data.type,
        title: data.title,
        summary: data.summary,
        imageUrl: data.imageUrl ?? null,
        imageUploadId: data.imageUploadId ?? null,
        expectedAt: data.expectedAt ?? null,
        ctaLabel: data.ctaLabel ?? null,
        ctaUrl: data.ctaUrl ?? null,
        isPublished: data.isPublished,
        sortOrder: data.sortOrder,
      },
      select: teaserSelect,
    });
  }

  update(
    id: string,
    data: {
      type?: MarketplaceTeaserTypeValue;
      title?: string;
      summary?: string;
      imageUrl?: string | null;
      imageUploadId?: string | null;
      expectedAt?: Date | null;
      ctaLabel?: string | null;
      ctaUrl?: string | null;
      isPublished?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.prisma.marketplaceTeaser.update({
      where: { id },
      data,
      select: teaserSelect,
    });
  }

  delete(id: string) {
    return this.prisma.marketplaceTeaser.delete({
      where: { id },
      select: teaserSelect,
    });
  }

  async list(options: {
    page: number;
    limit: number;
    type?: MarketplaceTeaserTypeValue;
    search?: string;
    isPublished?: boolean;
  }) {
    const where: Prisma.MarketplaceTeaserWhereInput = {
      ...(options.type ? { type: options.type } : {}),
      ...(options.isPublished !== undefined
        ? { isPublished: options.isPublished }
        : {}),
      ...(options.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              { summary: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.marketplaceTeaser.findMany({
        where,
        select: teaserSelect,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (options.page - 1) * options.limit,
        take: options.limit,
      }),
      this.prisma.marketplaceTeaser.count({ where }),
    ]);

    return { items, total };
  }
}

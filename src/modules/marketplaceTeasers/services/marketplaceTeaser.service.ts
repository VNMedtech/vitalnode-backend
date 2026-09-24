import { prisma } from "../../../infrastructure/prisma/client.js";
import { NotFoundError } from "../../../shared/errors/app.errors.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import {
  MARKETPLACE_TEASER_ACTIONS,
  MARKETPLACE_TEASER_AUDIT_ENTITY,
} from "../constants/marketplaceTeaser.constants.js";
import {
  normalizeTeaserImageUrl,
  toSignedTeaserDto,
  toTeaserDto,
} from "../dto/marketplaceTeaser.dto.js";
import { MarketplaceTeaserRepository } from "../repositories/marketplaceTeaser.repository.js";
import type {
  CreateMarketplaceTeaserInput,
  ListMarketplaceTeasersOptions,
  UpdateMarketplaceTeaserInput,
} from "../types/marketplaceTeaser.types.js";

function parseOptionalDate(
  value: string | null | undefined,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export class MarketplaceTeaserService {
  private readonly repo = new MarketplaceTeaserRepository(prisma);

  async list(options: ListMarketplaceTeasersOptions) {
    const { items, total } = await this.repo.list({
      page: options.page,
      limit: options.limit,
      type: options.type,
      search: options.search,
      isPublished: options.publicOnly ? true : options.isPublished,
    });

    const mapped = await Promise.all(items.map(toSignedTeaserDto));
    return {
      items: mapped,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / options.limit)),
      },
    };
  }

  async getById(id: string, publicOnly: boolean) {
    const record = await this.repo.findById(id);
    if (!record || (publicOnly && !record.isPublished)) {
      throw new NotFoundError("Teaser not found");
    }
    return toSignedTeaserDto(record);
  }

  async create(actorUserId: string, input: CreateMarketplaceTeaserInput) {
    const created = await this.repo.create({
      type: input.type,
      title: input.title,
      summary: input.summary,
      imageUrl: normalizeTeaserImageUrl(input.imageUrl) ?? null,
      imageUploadId: input.imageUploadId ?? null,
      expectedAt: parseOptionalDate(input.expectedAt) ?? null,
      ctaLabel: input.ctaLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      isPublished: input.isPublished ?? false,
      sortOrder: input.sortOrder ?? 0,
    });

    auditLogger.log({
      actorUserId,
      action: MARKETPLACE_TEASER_ACTIONS.CREATE,
      entityType: MARKETPLACE_TEASER_AUDIT_ENTITY,
      entityId: created.id,
      metadata: { type: created.type, title: created.title },
    });

    return toSignedTeaserDto(created);
  }

  async update(
    actorUserId: string,
    id: string,
    input: UpdateMarketplaceTeaserInput,
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Teaser not found");

    const updated = await this.repo.update(id, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: normalizeTeaserImageUrl(input.imageUrl) ?? null }
        : {}),
      ...(input.imageUploadId !== undefined
        ? { imageUploadId: input.imageUploadId }
        : {}),
      ...(input.expectedAt !== undefined
        ? { expectedAt: parseOptionalDate(input.expectedAt) ?? null }
        : {}),
      ...(input.ctaLabel !== undefined ? { ctaLabel: input.ctaLabel } : {}),
      ...(input.ctaUrl !== undefined ? { ctaUrl: input.ctaUrl } : {}),
      ...(input.isPublished !== undefined
        ? { isPublished: input.isPublished }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    });

    auditLogger.log({
      actorUserId,
      action: MARKETPLACE_TEASER_ACTIONS.UPDATE,
      entityType: MARKETPLACE_TEASER_AUDIT_ENTITY,
      entityId: id,
      metadata: { type: updated.type, title: updated.title },
    });

    return toSignedTeaserDto(updated);
  }

  async delete(actorUserId: string, id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Teaser not found");

    const deleted = await this.repo.delete(id);

    auditLogger.log({
      actorUserId,
      action: MARKETPLACE_TEASER_ACTIONS.DELETE,
      entityType: MARKETPLACE_TEASER_AUDIT_ENTITY,
      entityId: id,
      metadata: { type: existing.type, title: existing.title },
    });

    return toTeaserDto(deleted);
  }
}

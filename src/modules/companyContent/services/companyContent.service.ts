import { prisma } from "../../../infrastructure/prisma/client.js";
import { NotFoundError } from "../../../shared/errors/app.errors.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { toPermanentS3ObjectUrl } from "../../techBlogs/utils/blogMediaUrl.util.js";
import {
  COMPANY_CONTENT_ACTIONS,
  COMPANY_CONTENT_AUDIT_ENTITY,
} from "../constants/companyContent.constants.js";
import {
  toMemberDto,
  toSignedMemberDto,
  toWhyDto,
} from "../dto/companyContent.dto.js";
import { CompanyContentRepository } from "../repositories/companyContent.repository.js";
import type {
  CompanyMemberDto,
  CreateCompanyMemberInput,
  UpdateCompanyMemberInput,
  UpdateWhyVitalnodeInput,
  WhyVitalnodeDto,
} from "../types/companyContent.types.js";
import type { CompanyMemberTypeValue } from "../constants/companyContent.constants.js";

export class CompanyContentService {
  private readonly repo = new CompanyContentRepository(prisma);

  async getWhySection(adminView: boolean): Promise<WhyVitalnodeDto | null> {
    let section = await this.repo.getWhySection();
    if (!section) {
      section = await this.repo.ensureWhySection();
    }
    if (!adminView && !section.isPublished) {
      return null;
    }
    return toWhyDto(section);
  }

  async updateWhySection(
    actorUserId: string,
    input: UpdateWhyVitalnodeInput,
  ): Promise<WhyVitalnodeDto> {
    const existing =
      (await this.repo.getWhySection()) ?? (await this.repo.ensureWhySection());

    const nextTitle = input.title ?? existing.title;
    const nextSubtitle =
      input.subtitle !== undefined ? input.subtitle : existing.subtitle;
    const nextPublished =
      input.isPublished !== undefined
        ? input.isPublished
        : existing.isPublished;
    const nextCards =
      input.cards?.map((card, index) => ({
        title: card.title,
        description: card.description,
        iconKey: card.iconKey ?? null,
        sortOrder: card.sortOrder ?? index,
      })) ??
      existing.cards.map((card) => ({
        title: card.title,
        description: card.description,
        iconKey: card.iconKey,
        sortOrder: card.sortOrder,
      }));

    const updated = await this.repo.replaceWhySection({
      title: nextTitle,
      subtitle: nextSubtitle,
      isPublished: nextPublished,
      cards: nextCards,
    });

    auditLogger.log({
      actorUserId,
      action: COMPANY_CONTENT_ACTIONS.WHY_UPDATE,
      entityType: COMPANY_CONTENT_AUDIT_ENTITY.WHY,
      entityId: updated.id,
      metadata: {
        title: updated.title,
        isPublished: updated.isPublished,
        cardCount: updated.cards.length,
      },
    });

    return toWhyDto(updated);
  }

  async listMembers(
    options: { type?: CompanyMemberTypeValue; publicOnly: boolean },
  ): Promise<CompanyMemberDto[]> {
    const records = await this.repo.listMembers(options);
    return Promise.all(records.map(toSignedMemberDto));
  }

  async createMember(
    actorUserId: string,
    input: CreateCompanyMemberInput,
  ): Promise<CompanyMemberDto> {
    const created = await this.repo.createMember({
      type: input.type,
      name: input.name,
      role: input.role,
      bio: input.bio,
      imageUrl: toPermanentS3ObjectUrl(input.imageUrl) ?? input.imageUrl ?? null,
      imageUploadId: input.imageUploadId ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });

    auditLogger.log({
      actorUserId,
      action: COMPANY_CONTENT_ACTIONS.MEMBER_CREATE,
      entityType: COMPANY_CONTENT_AUDIT_ENTITY.MEMBER,
      entityId: created.id,
      metadata: { type: created.type, name: created.name },
    });

    return toSignedMemberDto(created);
  }

  async updateMember(
    actorUserId: string,
    id: string,
    input: UpdateCompanyMemberInput,
  ): Promise<CompanyMemberDto> {
    const existing = await this.repo.findMemberById(id);
    if (!existing) throw new NotFoundError("Member not found");

    const updated = await this.repo.updateMember(id, {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.bio !== undefined ? { bio: input.bio } : {}),
      ...(input.imageUrl !== undefined
        ? {
            imageUrl:
              toPermanentS3ObjectUrl(input.imageUrl) ?? input.imageUrl,
          }
        : {}),
      ...(input.imageUploadId !== undefined
        ? { imageUploadId: input.imageUploadId }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    auditLogger.log({
      actorUserId,
      action: COMPANY_CONTENT_ACTIONS.MEMBER_UPDATE,
      entityType: COMPANY_CONTENT_AUDIT_ENTITY.MEMBER,
      entityId: id,
      metadata: { type: updated.type, name: updated.name },
    });

    return toSignedMemberDto(updated);
  }

  async deleteMember(
    actorUserId: string,
    id: string,
  ): Promise<CompanyMemberDto> {
    const existing = await this.repo.findMemberById(id);
    if (!existing) throw new NotFoundError("Member not found");

    const deleted = await this.repo.softDeleteMember(id);

    auditLogger.log({
      actorUserId,
      action: COMPANY_CONTENT_ACTIONS.MEMBER_DELETE,
      entityType: COMPANY_CONTENT_AUDIT_ENTITY.MEMBER,
      entityId: id,
      metadata: { type: existing.type, name: existing.name },
    });

    return toMemberDto(deleted);
  }
}

import type {
  CompanyMemberRecord,
  WhySectionRecord,
} from "../repositories/companyContent.repository.js";
import type {
  CompanyMemberDto,
  WhyVitalnodeDto,
} from "../types/companyContent.types.js";
import { signFeaturedImageUrl } from "../../techBlogs/utils/blogMediaUrl.util.js";

export function toWhyDto(record: WhySectionRecord): WhyVitalnodeDto {
  return {
    id: record.id,
    title: record.title,
    subtitle: record.subtitle,
    isPublished: record.isPublished,
    cards: record.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      iconKey: card.iconKey,
      sortOrder: card.sortOrder,
    })),
    updatedAt: record.updatedAt,
  };
}

export function toMemberDto(record: CompanyMemberRecord): CompanyMemberDto {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    role: record.role,
    bio: record.bio,
    imageUrl: record.imageUrl,
    imageUploadId: record.imageUploadId,
    instagramUrl: record.instagramUrl,
    linkedinUrl: record.linkedinUrl,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function toSignedMemberDto(
  record: CompanyMemberRecord,
): Promise<CompanyMemberDto> {
  const dto = toMemberDto(record);
  return {
    ...dto,
    imageUrl: await signFeaturedImageUrl(dto.imageUrl),
  };
}

import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";
import type { CompanyMemberTypeValue } from "../constants/companyContent.constants.js";
import { WHY_SECTION_ID } from "../constants/companyContent.constants.js";

const whySelect = {
  id: true,
  title: true,
  subtitle: true,
  isPublished: true,
  updatedAt: true,
  cards: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      title: true,
      description: true,
      iconKey: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.WhyVitalnodeSectionSelect;

const memberSelect = {
  id: true,
  type: true,
  name: true,
  role: true,
  bio: true,
  imageUrl: true,
  imageUploadId: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanyMemberSelect;

export type WhySectionRecord = Prisma.WhyVitalnodeSectionGetPayload<{
  select: typeof whySelect;
}>;

export type CompanyMemberRecord = Prisma.CompanyMemberGetPayload<{
  select: typeof memberSelect;
}>;

export class CompanyContentRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async ensureWhySection() {
    return this.prisma.whyVitalnodeSection.upsert({
      where: { id: WHY_SECTION_ID },
      create: {
        id: WHY_SECTION_ID,
        title: "Why Vitalnode",
        subtitle:
          "Trusted medical equipment procurement for modern healthcare teams.",
        isPublished: false,
      },
      update: {},
      select: whySelect,
    });
  }

  getWhySection() {
    return this.prisma.whyVitalnodeSection.findUnique({
      where: { id: WHY_SECTION_ID },
      select: whySelect,
    });
  }

  async replaceWhySection(data: {
    title: string;
    subtitle: string | null;
    isPublished: boolean;
    cards: Array<{
      title: string;
      description: string;
      iconKey: string | null;
      sortOrder: number;
    }>;
  }) {
    await this.prisma.whyVitalnodeCard.deleteMany({
      where: { sectionId: WHY_SECTION_ID },
    });

    return this.prisma.whyVitalnodeSection.update({
      where: { id: WHY_SECTION_ID },
      data: {
        title: data.title,
        subtitle: data.subtitle,
        isPublished: data.isPublished,
        cards: {
          create: data.cards.map((card) => ({
            title: card.title,
            description: card.description,
            iconKey: card.iconKey,
            sortOrder: card.sortOrder,
          })),
        },
      },
      select: whySelect,
    });
  }

  createMember(data: {
    type: CompanyMemberTypeValue;
    name: string;
    role: string;
    bio?: string | null;
    imageUrl?: string | null;
    imageUploadId?: string | null;
    sortOrder: number;
    isActive: boolean;
  }) {
    return this.prisma.companyMember.create({
      data: {
        type: data.type,
        name: data.name,
        role: data.role,
        bio: data.bio ?? null,
        imageUrl: data.imageUrl ?? null,
        imageUploadId: data.imageUploadId ?? null,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
      select: memberSelect,
    });
  }

  findMemberById(id: string) {
    return this.prisma.companyMember.findFirst({
      where: { id, deletedAt: null },
      select: memberSelect,
    });
  }

  listMembers(options: {
    type?: CompanyMemberTypeValue;
    publicOnly: boolean;
  }) {
    return this.prisma.companyMember.findMany({
      where: {
        deletedAt: null,
        ...(options.type ? { type: options.type } : {}),
        ...(options.publicOnly ? { isActive: true } : {}),
      },
      select: memberSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  updateMember(
    id: string,
    data: {
      type?: CompanyMemberTypeValue;
      name?: string;
      role?: string;
      bio?: string | null;
      imageUrl?: string | null;
      imageUploadId?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.companyMember.update({
      where: { id },
      data,
      select: memberSelect,
    });
  }

  softDeleteMember(id: string) {
    return this.prisma.companyMember.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
      select: memberSelect,
    });
  }
}

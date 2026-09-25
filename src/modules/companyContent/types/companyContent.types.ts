import type { CompanyMemberTypeValue } from "../constants/companyContent.constants.js";

export interface WhyVitalnodeCardDto {
  id: string;
  title: string;
  description: string;
  iconKey: string | null;
  sortOrder: number;
}

export interface WhyVitalnodeDto {
  id: string;
  title: string;
  subtitle: string | null;
  isPublished: boolean;
  cards: WhyVitalnodeCardDto[];
  updatedAt: Date;
}

export interface WhyVitalnodeCardInput {
  id?: string;
  title: string;
  description: string;
  iconKey?: string | null;
  sortOrder?: number;
}

export interface UpdateWhyVitalnodeInput {
  title?: string;
  subtitle?: string | null;
  isPublished?: boolean;
  cards?: WhyVitalnodeCardInput[];
}

export interface CompanyMemberDto {
  id: string;
  type: CompanyMemberTypeValue;
  name: string;
  role: string;
  bio: string | null;
  imageUrl: string | null;
  imageUploadId: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCompanyMemberInput {
  type: CompanyMemberTypeValue;
  name: string;
  role: string;
  bio?: string | null;
  imageUrl?: string | null;
  imageUploadId?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCompanyMemberInput {
  type?: CompanyMemberTypeValue;
  name?: string;
  role?: string;
  bio?: string | null;
  imageUrl?: string | null;
  imageUploadId?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

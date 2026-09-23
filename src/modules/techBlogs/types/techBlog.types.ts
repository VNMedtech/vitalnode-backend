import type {
  TechBlogSortField,
  TechBlogStatusValue,
} from "../constants/techBlog.constants.js";

export interface TechBlogDto {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  category: string;
  tags: string[];
  featuredImageUrl: string | null;
  featuredImageUploadId: string | null;
  content: string;
  publishDate: Date | null;
  isFeatured: boolean;
  status: TechBlogStatusValue;
  authorUserId: string;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechBlogListItemDto {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  category: string;
  tags: string[];
  featuredImageUrl: string | null;
  publishDate: Date | null;
  isFeatured: boolean;
  status: TechBlogStatusValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTechBlogInput {
  title: string;
  slug?: string;
  shortDescription: string;
  category: string;
  tags?: string[];
  featuredImageUrl?: string | null;
  featuredImageUploadId?: string | null;
  content: string;
  publishDate?: string | null;
  isFeatured?: boolean;
  status?: TechBlogStatusValue;
}

export interface UpdateTechBlogInput {
  title?: string;
  slug?: string;
  shortDescription?: string;
  category?: string;
  tags?: string[];
  featuredImageUrl?: string | null;
  featuredImageUploadId?: string | null;
  content?: string;
  publishDate?: string | null;
  isFeatured?: boolean;
  status?: TechBlogStatusValue;
}

export interface ListTechBlogsQuery {
  page: number;
  limit: number;
  sortBy: TechBlogSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  category?: string;
  tag?: string;
  status?: TechBlogStatusValue;
  featuredOnly?: boolean;
}

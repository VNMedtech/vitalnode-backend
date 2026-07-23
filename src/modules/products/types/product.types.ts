import type { ProductSortField } from "../constants/product.constants.js";
import type { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import type { ProductTemplateFieldType } from "../../../../generated/prisma/client.js";

export interface ProductMediaDto {
  id: string;
  fileUploadId: string | null;
  fileUrl: string;
  displayOrder: number;
  createdAt: Date;
}

export interface ProductDocumentDto {
  id: string;
  fileUploadId: string | null;
  fileUrl: string;
  documentType: string;
  createdAt: Date;
}

export interface ProductCategorySummaryDto {
  id: string;
  name: string;
  isPrimary: boolean;
}

export interface ProductTemplateSummaryDto {
  id: string;
  name: string;
}

export interface ProductAttributeFieldDto {
  key: string;
  label: string;
  fieldType: ProductTemplateFieldType;
  unit: string | null;
  value: unknown;
  isOrphan: boolean;
}

export interface ProductSellerSummaryDto {
  id: string;
  businessName: string;
}

export interface ProductInventorySummaryDto {
  availableQuantity: number;
}

export interface ProductListItemDto {
  id: string;
  sellerId: string;
  templateId: string | null;
  productName: string;
  brand: string;
  model: string;
  pricing: string;
  moq: number;
  status: ProductStatus;
  categories: ProductCategorySummaryDto[];
  primaryCategory: ProductCategorySummaryDto | null;
  template: ProductTemplateSummaryDto | null;
  seller: ProductSellerSummaryDto;
  primaryImageUrl: string | null;
  averageRating: string | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDetailDto extends ProductListItemDto {
  description: string;
  details: string | null;
  attributes: Record<string, unknown> | null;
  attributeFields: ProductAttributeFieldDto[];
  media: ProductMediaDto[];
  documents: ProductDocumentDto[];
  inventory: ProductInventorySummaryDto | null;
}

export interface ProductMediaInput {
  fileUploadId: string;
  fileUrl: string;
  displayOrder?: number;
}

export interface ProductDocumentInput {
  fileUploadId: string;
  fileUrl: string;
  documentType: string;
}

export interface CreateProductInput {
  categoryIds: string[];
  templateId?: string;
  productName: string;
  brand: string;
  model: string;
  pricing: string;
  moq: number;
  description: string;
  details?: string;
  attributes?: Record<string, unknown>;
  documentTypes?: string[];
  media?: ProductMediaInput[];
  documents?: ProductDocumentInput[];
}

export interface UpdateProductInput {
  categoryIds?: string[];
  templateId?: string | null;
  productName?: string;
  brand?: string;
  model?: string;
  pricing?: string;
  moq?: number;
  description?: string;
  details?: string | null;
  attributes?: Record<string, unknown> | null;
  documentTypes?: string[];
  media?: ProductMediaInput[];
  documents?: ProductDocumentInput[];
  replaceMedia?: boolean;
  replaceDocuments?: boolean;
}

export interface AttachTemplateInput {
  templateId: string;
  attributes?: Record<string, unknown>;
}

export interface ListProductsQuery {
  page: number;
  limit: number;
  sortBy: ProductSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  categoryId?: string;
  categoryIds?: string[];
  brand?: string;
  status?: ProductStatus;
  minPrice?: string;
  maxPrice?: string;
  sellerId?: string;
}

export interface ListAdminProductsQuery extends ListProductsQuery {}

export interface ListMarketplaceProductsQuery {
  page: number;
  limit: number;
  sortBy?: ProductSortField;
  sortOrder?: "asc" | "desc";
  search?: string;
  categoryId?: string;
  categoryIds?: string[];
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
}

export interface RejectProductInput {
  reason?: string;
}

export interface ProductCompareItemDto {
  id: string;
  productName: string;
  categories: ProductCategorySummaryDto[];
  brand: string;
  model: string;
  pricing: string;
  moq: number;
  attributes: Record<string, unknown> | null;
  primaryImageUrl: string | null;
}

export interface ProductCompareAttributeDto {
  key: string;
  label: string;
  values: (string | number | null)[];
}

export interface ProductCompareDto {
  productIds: string[];
  products: ProductCompareItemDto[];
  attributes: ProductCompareAttributeDto[];
}

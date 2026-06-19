import type { ProductSortField } from "../constants/product.constants.js";
import type { ProductStatus } from "../../../shared/enums/productStatus.enum.js";

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
  categoryId: string;
  productName: string;
  brand: string;
  model: string;
  productType: string;
  pricing: string;
  moq: number;
  deliveryTime: number | null;
  status: ProductStatus;
  category: ProductCategorySummaryDto;
  seller: ProductSellerSummaryDto;
  primaryImageUrl: string | null;
  averageRating: string | null;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDetailDto extends ProductListItemDto {
  color: string | null;
  weight: string | null;
  length: string | null;
  warrantyPeriod: number | null;
  returnTime: number | null;
  description: string;
  details: string | null;
  specifications: Record<string, unknown> | null;
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
  categoryId: string;
  productName: string;
  brand: string;
  model: string;
  productType: string;
  color?: string;
  weight?: string;
  length?: string;
  warrantyPeriod?: number;
  returnTime?: number;
  deliveryTime?: number;
  pricing: string;
  moq: number;
  description: string;
  details?: string;
  specifications?: Record<string, unknown>;
  documentTypes?: string[];
  media?: ProductMediaInput[];
  documents?: ProductDocumentInput[];
}

export interface UpdateProductInput {
  categoryId?: string;
  productName?: string;
  brand?: string;
  model?: string;
  productType?: string;
  color?: string | null;
  weight?: string | null;
  length?: string | null;
  warrantyPeriod?: number | null;
  returnTime?: number | null;
  deliveryTime?: number | null;
  pricing?: string;
  moq?: number;
  description?: string;
  details?: string | null;
  specifications?: Record<string, unknown> | null;
  documentTypes?: string[];
  media?: ProductMediaInput[];
  documents?: ProductDocumentInput[];
  replaceMedia?: boolean;
  replaceDocuments?: boolean;
}

export interface ListProductsQuery {
  page: number;
  limit: number;
  sortBy: ProductSortField;
  sortOrder: "asc" | "desc";
  search?: string;
  categoryId?: string;
  brand?: string;
  status?: ProductStatus;
  minPrice?: string;
  maxPrice?: string;
}

export interface RejectProductInput {
  reason?: string;
}

export interface ProductCompareItemDto {
  id: string;
  productName: string;
  category: ProductCategorySummaryDto;
  brand: string;
  model: string;
  productType: string;
  color: string | null;
  weight: string | null;
  length: string | null;
  warrantyPeriod: number | null;
  returnTime: number | null;
  deliveryTime: number | null;
  pricing: string;
  moq: number;
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

import type { Prisma } from "../../../../generated/prisma/client.js";
import type { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import type {
  ProductDetailRecord,
  ProductListRecord,
} from "../repositories/product.repository.js";
import type { ProductReviewStats } from "../../reviews/types/review.types.js";
import type {
  ProductDetailDto,
  ProductDocumentDto,
  ProductListItemDto,
  ProductMediaDto,
  ProductCompareAttributeDto,
  ProductCompareDto,
  ProductCompareItemDto,
} from "../types/product.types.js";

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value.toString();
}

function toProductMediaDto(
  media: ProductDetailRecord["media"][number],
): ProductMediaDto {
  return {
    id: media.id,
    fileUploadId: media.fileUploadId,
    fileUrl: media.fileUrl,
    displayOrder: media.displayOrder,
    createdAt: media.createdAt,
  };
}

function toProductDocumentDto(
  document: ProductDetailRecord["documents"][number],
): ProductDocumentDto {
  return {
    id: document.id,
    fileUploadId: document.fileUploadId,
    fileUrl: document.fileUrl,
    documentType: document.documentType,
    createdAt: document.createdAt,
  };
}

function toProductListItemDto(
  record: ProductListRecord,
  reviewStats?: ProductReviewStats,
): ProductListItemDto {
  const sortedMedia = [...record.media].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );

  return {
    id: record.id,
    sellerId: record.sellerId,
    categoryId: record.categoryId,
    productName: record.productName,
    brand: record.brand,
    model: record.model,
    productType: record.productType,
    pricing: record.pricing.toString(),
    moq: record.moq,
    deliveryTime: record.deliveryTime,
    status: record.status as ProductStatus,
    category: {
      id: record.category.id,
      name: record.category.name,
    },
    seller: {
      id: record.seller.id,
      businessName: record.seller.businessName,
    },
    primaryImageUrl: sortedMedia[0]?.fileUrl ?? null,
    averageRating: reviewStats?.averageRating ?? null,
    reviewCount: reviewStats?.reviewCount ?? 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toProductListItemDtoFromRecord(
  record: ProductListRecord,
  reviewStats?: ProductReviewStats,
): ProductListItemDto {
  return toProductListItemDto(record, reviewStats);
}

export function toProductDetailDto(
  record: ProductDetailRecord,
  reviewStats?: ProductReviewStats,
): ProductDetailDto {
  const specifications =
    record.specifications &&
    typeof record.specifications === "object" &&
    !Array.isArray(record.specifications)
      ? (record.specifications as Record<string, unknown>)
      : null;

  return {
    ...toProductListItemDto(record, reviewStats),
    color: record.color,
    weight: decimalToString(record.weight),
    length: decimalToString(record.length),
    warrantyPeriod: record.warrantyPeriod,
    returnTime: record.returnTime,
    description: record.description,
    details: record.details,
    specifications,
    media: record.media
      .map(toProductMediaDto)
      .sort((a, b) => a.displayOrder - b.displayOrder),
    documents: record.documents.map(toProductDocumentDto),
    inventory: record.inventory
      ? { availableQuantity: record.inventory.availableQuantity }
      : null,
  };
}

const PRODUCT_COMPARE_ATTRIBUTES: Array<{
  key: keyof ProductCompareItemDto;
  label: string;
  getValue: (product: ProductCompareItemDto) => string | number | null;
}> = [
  { key: "productName", label: "Product Name", getValue: (p) => p.productName },
  {
    key: "category",
    label: "Category",
    getValue: (p) => p.category.name,
  },
  { key: "brand", label: "Brand", getValue: (p) => p.brand },
  { key: "model", label: "Model", getValue: (p) => p.model },
  {
    key: "productType",
    label: "Product Type",
    getValue: (p) => p.productType,
  },
  { key: "color", label: "Color", getValue: (p) => p.color },
  { key: "weight", label: "Weight", getValue: (p) => p.weight },
  { key: "length", label: "Length", getValue: (p) => p.length },
  {
    key: "warrantyPeriod",
    label: "Warranty Period",
    getValue: (p) => p.warrantyPeriod,
  },
  { key: "returnTime", label: "Return Time", getValue: (p) => p.returnTime },
  {
    key: "deliveryTime",
    label: "Delivery Time",
    getValue: (p) => p.deliveryTime,
  },
  { key: "pricing", label: "Price", getValue: (p) => p.pricing },
  { key: "moq", label: "MOQ", getValue: (p) => p.moq },
];

function toProductCompareItemDto(
  record: ProductDetailRecord,
): ProductCompareItemDto {
  const listItem = toProductListItemDto(record);

  return {
    id: listItem.id,
    productName: listItem.productName,
    category: listItem.category,
    brand: listItem.brand,
    model: listItem.model,
    productType: listItem.productType,
    color: record.color,
    weight: decimalToString(record.weight),
    length: decimalToString(record.length),
    warrantyPeriod: record.warrantyPeriod,
    returnTime: record.returnTime,
    deliveryTime: record.deliveryTime,
    pricing: listItem.pricing,
    moq: listItem.moq,
    primaryImageUrl: listItem.primaryImageUrl,
  };
}

function buildCompareAttributes(
  products: ProductCompareItemDto[],
): ProductCompareAttributeDto[] {
  return PRODUCT_COMPARE_ATTRIBUTES.map(({ key, label, getValue }) => ({
    key,
    label,
    values: products.map(getValue),
  }));
}

export function toProductCompareDto(
  productIds: string[],
  records: ProductDetailRecord[],
): ProductCompareDto {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const products = productIds.map((id) =>
    toProductCompareItemDto(recordMap.get(id)!),
  );

  return {
    productIds,
    products,
    attributes: buildCompareAttributes(products),
  };
}

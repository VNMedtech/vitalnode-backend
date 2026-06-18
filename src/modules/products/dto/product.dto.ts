import type { Prisma } from "../../../../generated/prisma/client.js";
import type { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import type {
  ProductDetailRecord,
  ProductListRecord,
} from "../repositories/product.repository.js";
import type {
  ProductDetailDto,
  ProductDocumentDto,
  ProductListItemDto,
  ProductMediaDto,
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

function toProductListItemDto(record: ProductListRecord): ProductListItemDto {
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
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toProductListItemDtoFromRecord(
  record: ProductListRecord,
): ProductListItemDto {
  return toProductListItemDto(record);
}

export function toProductDetailDto(record: ProductDetailRecord): ProductDetailDto {
  const specifications =
    record.specifications &&
    typeof record.specifications === "object" &&
    !Array.isArray(record.specifications)
      ? (record.specifications as Record<string, unknown>)
      : null;

  return {
    ...toProductListItemDto(record),
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

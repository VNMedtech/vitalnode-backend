import type {
  ProductDetailRecord,
  ProductListRecord,
} from "../repositories/product.repository.js";
import type { ProductReviewStats } from "../../reviews/types/review.types.js";
import type { ProductStatus } from "../../../shared/enums/productStatus.enum.js";
import {
  asAttributeMap,
  formatAttributeDisplayValue,
} from "../utils/productAttributes.util.js";
import type {
  ProductAttributeFieldDto,
  ProductCategorySummaryDto,
  ProductCompareAttributeDto,
  ProductCompareDto,
  ProductCompareItemDto,
  ProductDetailDto,
  ProductDocumentDto,
  ProductListItemDto,
  ProductMediaDto,
} from "../types/product.types.js";

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

function toCategorySummaries(
  categories: ProductListRecord["categories"],
): ProductCategorySummaryDto[] {
  return categories.map((link) => ({
    id: link.category.id,
    name: link.category.name,
    isPrimary: link.isPrimary,
  }));
}

function resolvePrimaryCategory(
  categories: ProductCategorySummaryDto[],
): ProductCategorySummaryDto | null {
  return categories.find((category) => category.isPrimary) ?? categories[0] ?? null;
}

function toAttributeFields(
  record: ProductDetailRecord,
): ProductAttributeFieldDto[] {
  const attributes = asAttributeMap(record.attributes);
  const templateFields = record.template?.fields ?? [];
  const activeFields = templateFields.filter((field) => field.isActive);
  const knownKeys = new Set(activeFields.map((field) => field.key));

  const fromTemplate: ProductAttributeFieldDto[] = activeFields
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    .map((field) => ({
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      unit: field.unit,
      value: attributes[field.key] ?? null,
      isOrphan: false,
    }));

  const orphans: ProductAttributeFieldDto[] = Object.keys(attributes)
    .filter((key) => !knownKeys.has(key))
    .sort()
    .map((key) => ({
      key,
      label: key,
      fieldType: "TEXT" as const,
      unit: null,
      value: attributes[key] ?? null,
      isOrphan: true,
    }));

  return [...fromTemplate, ...orphans];
}

function toProductListItemDto(
  record: ProductListRecord,
  reviewStats?: ProductReviewStats,
): ProductListItemDto {
  const sortedMedia = [...record.media].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  const categories = toCategorySummaries(record.categories);

  return {
    id: record.id,
    sellerId: record.sellerId,
    templateId: record.templateId,
    productName: record.productName,
    brand: record.brand,
    model: record.model,
    pricing: record.pricing.toString(),
    moq: record.moq,
    status: record.status as ProductStatus,
    categories,
    primaryCategory: resolvePrimaryCategory(categories),
    template: record.template
      ? { id: record.template.id, name: record.template.name }
      : null,
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
  const attributes = asAttributeMap(record.attributes);
  const hasAttributes = Object.keys(attributes).length > 0;

  return {
    ...toProductListItemDto(record, reviewStats),
    description: record.description,
    details: record.details,
    attributes: hasAttributes ? attributes : null,
    attributeFields: toAttributeFields(record),
    media: record.media
      .map(toProductMediaDto)
      .sort((a, b) => a.displayOrder - b.displayOrder),
    documents: record.documents.map(toProductDocumentDto),
    inventory: record.inventory
      ? { availableQuantity: record.inventory.availableQuantity }
      : null,
  };
}

const CORE_COMPARE_ATTRIBUTES: Array<{
  key: string;
  label: string;
  getValue: (product: ProductCompareItemDto) => string | number | null;
}> = [
  { key: "productName", label: "Product Name", getValue: (p) => p.productName },
  {
    key: "categories",
    label: "Categories",
    getValue: (p) => p.categories.map((c) => c.name).join(", ") || null,
  },
  { key: "brand", label: "Brand", getValue: (p) => p.brand },
  { key: "model", label: "Model", getValue: (p) => p.model },
  { key: "pricing", label: "Price", getValue: (p) => p.pricing },
  { key: "moq", label: "MOQ", getValue: (p) => p.moq },
];

function toProductCompareItemDto(
  record: ProductDetailRecord,
): ProductCompareItemDto {
  const listItem = toProductListItemDto(record);
  const attributes = asAttributeMap(record.attributes);

  return {
    id: listItem.id,
    productName: listItem.productName,
    categories: listItem.categories,
    brand: listItem.brand,
    model: listItem.model,
    pricing: listItem.pricing,
    moq: listItem.moq,
    attributes: Object.keys(attributes).length > 0 ? attributes : null,
    primaryImageUrl: listItem.primaryImageUrl,
  };
}

/**
 * Union of attribute keys across compared products.
 * Shared keys (present on 2+) come first, then product-specific keys.
 * Within each group keys are sorted alphabetically.
 */
function collectCompareAttributeKeys(
  products: ProductCompareItemDto[],
): string[] {
  const keyCounts = new Map<string, number>();
  for (const product of products) {
    for (const key of Object.keys(product.attributes ?? {})) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }

  const shared: string[] = [];
  const unique: string[] = [];
  for (const [key, count] of keyCounts.entries()) {
    if (count >= 2) shared.push(key);
    else unique.push(key);
  }

  shared.sort();
  unique.sort();
  return [...shared, ...unique];
}

function buildCompareAttributes(
  products: ProductCompareItemDto[],
  records: ProductDetailRecord[],
): ProductCompareAttributeDto[] {
  const core = CORE_COMPARE_ATTRIBUTES.map(({ key, label, getValue }) => ({
    key,
    label,
    values: products.map(getValue),
  }));

  const labelByKey = new Map<string, string>();
  for (const record of records) {
    for (const field of record.template?.fields ?? []) {
      if (!labelByKey.has(field.key)) {
        labelByKey.set(field.key, field.label);
      }
    }
  }

  const attributeKeys = collectCompareAttributeKeys(products);
  const attributeRows = attributeKeys.map((key) => ({
    key,
    label: labelByKey.get(key) ?? key,
    values: products.map((product) =>
      formatAttributeDisplayValue(product.attributes?.[key]),
    ),
  }));

  return [...core, ...attributeRows];
}

export function toProductCompareDto(
  productIds: string[],
  records: ProductDetailRecord[],
): ProductCompareDto {
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const orderedRecords = productIds.map((id) => recordMap.get(id)!);
  const products = orderedRecords.map(toProductCompareItemDto);

  return {
    productIds,
    products,
    attributes: buildCompareAttributes(products, orderedRecords),
  };
}

export interface CartSellerSummaryDto {
  id: string;
  businessName: string;
}

export interface CartProductSummaryDto {
  id: string;
  productName: string;
  brand: string;
  model: string;
  productType: string;
  description: string;
  pricing: string;
  moq: number;
  availableQuantity: number;
  primaryImageUrl: string | null;
  seller: CartSellerSummaryDto;
  isAvailable: boolean;
}

export interface CartItemDto {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  product: CartProductSummaryDto;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartDto {
  id: string | null;
  buyerId: string;
  seller: CartSellerSummaryDto | null;
  items: CartItemDto[];
  itemCount: number;
  totalItems: number;
  subtotal: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AddCartItemInput {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

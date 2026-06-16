import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ForbiddenError,
  NotFoundError,
} from "../../../shared/errors/app.errors.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import { ProductRepository } from "../../products/repositories/product.repository.js";
import {
  CART_ACTIONS,
  CART_AUDIT_ENTITY_TYPE,
} from "../constants/cart.constants.js";
import { toCartDto, toEmptyCartDto } from "../dto/cart.dto.js";
import { CartItemRepository } from "../repositories/cartItem.repository.js";
import { CartRepository } from "../repositories/cart.repository.js";
import type {
  AddCartItemInput,
  CartDto,
  UpdateCartItemInput,
} from "../types/cart.types.js";
import {
  assertCartQuantityWithinInventory,
  assertSingleSellerCart,
  validateProductForCart,
} from "../utils/cartProduct.utils.js";

export class CartService {
  private readonly cartRepo = new CartRepository(prisma);
  private readonly cartItemRepo = new CartItemRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly productRepo = new ProductRepository(prisma);

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  private async getOwnedCartItemOrThrow(itemId: string, cartId: string) {
    const item = await this.cartItemRepo.findByIdAndCartId(itemId, cartId);
    if (!item) {
      throw new NotFoundError("Cart item not found");
    }
    return item;
  }

  async getCart(actorUserId: string): Promise<CartDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const cart = await this.cartRepo.findByBuyerIdWithItems(buyerId);

    if (!cart) {
      return toEmptyCartDto(buyerId);
    }

    return toCartDto(cart);
  }

  async addItem(
    actorUserId: string,
    input: AddCartItemInput,
  ): Promise<CartDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const productRecord = await this.productRepo.findMarketplaceDetailById(
      input.productId,
    );
    const product = validateProductForCart(productRecord);

    const cartId = await prisma.$transaction(async (tx) => {
      const cartRepo = new CartRepository(tx);
      const cartItemRepo = new CartItemRepository(tx);

      const cart = await cartRepo.findOrCreateByBuyerId(buyerId);
      const existingItem = await cartItemRepo.findByCartIdAndProductId(
        cart.id,
        input.productId,
      );

      if (!existingItem) {
        const sellerRows = await cartItemRepo.findSellerIdsByCartId(cart.id);
        const existingSellerIds = sellerRows.map((row) => row.product.sellerId);
        assertSingleSellerCart(existingSellerIds, product.sellerId);
      }

      const nextQuantity = existingItem
        ? existingItem.quantity + input.quantity
        : input.quantity;

      assertCartQuantityWithinInventory(nextQuantity, product);

      if (existingItem) {
        await cartItemRepo.updateQuantity(existingItem.id, nextQuantity);
      } else {
        await cartItemRepo.create({
          cartId: cart.id,
          productId: input.productId,
          quantity: input.quantity,
        });
      }

      return cart.id;
    });

    auditLogger.log({
      actorUserId,
      action: CART_ACTIONS.ADD_ITEM,
      entityType: CART_AUDIT_ENTITY_TYPE,
      entityId: cartId,
      metadata: {
        buyerId,
        productId: input.productId,
        quantity: input.quantity,
      },
    });

    const cart = await this.cartRepo.findByBuyerIdWithItemsAfterMutation(cartId);
    return toCartDto(cart);
  }

  async updateItemQuantity(
    actorUserId: string,
    itemId: string,
    input: UpdateCartItemInput,
  ): Promise<CartDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const cart = await this.cartRepo.findByBuyerId(buyerId);
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    const existingItem = await this.getOwnedCartItemOrThrow(itemId, cart.id);
    const productRecord = await this.productRepo.findMarketplaceDetailById(
      existingItem.productId,
    );
    const product = validateProductForCart(productRecord);
    assertCartQuantityWithinInventory(input.quantity, product);

    await this.cartItemRepo.updateQuantity(existingItem.id, input.quantity);

    auditLogger.log({
      actorUserId,
      action: CART_ACTIONS.UPDATE_ITEM,
      entityType: CART_AUDIT_ENTITY_TYPE,
      entityId: cart.id,
      metadata: {
        buyerId,
        itemId,
        productId: existingItem.productId,
        previousQuantity: existingItem.quantity,
        newQuantity: input.quantity,
      },
    });

    const updatedCart =
      await this.cartRepo.findByBuyerIdWithItemsAfterMutation(cart.id);
    return toCartDto(updatedCart);
  }

  async removeItem(actorUserId: string, itemId: string): Promise<CartDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const cart = await this.cartRepo.findByBuyerId(buyerId);
    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    const existingItem = await this.getOwnedCartItemOrThrow(itemId, cart.id);
    await this.cartItemRepo.delete(existingItem.id);

    auditLogger.log({
      actorUserId,
      action: CART_ACTIONS.REMOVE_ITEM,
      entityType: CART_AUDIT_ENTITY_TYPE,
      entityId: cart.id,
      metadata: {
        buyerId,
        itemId,
        productId: existingItem.productId,
        quantity: existingItem.quantity,
      },
    });

    const updatedCart =
      await this.cartRepo.findByBuyerIdWithItemsAfterMutation(cart.id);
    return toCartDto(updatedCart);
  }

  async clearCart(actorUserId: string): Promise<CartDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const cart = await this.cartRepo.findByBuyerId(buyerId);

    if (!cart) {
      return toEmptyCartDto(buyerId);
    }

    const removedCount = await this.cartItemRepo.countByCartId(cart.id);
    if (removedCount > 0) {
      await this.cartItemRepo.deleteAllByCartId(cart.id);

      auditLogger.log({
        actorUserId,
        action: CART_ACTIONS.CLEAR,
        entityType: CART_AUDIT_ENTITY_TYPE,
        entityId: cart.id,
        metadata: {
          buyerId,
          removedItemCount: removedCount,
        },
      });
    }

    const updatedCart =
      await this.cartRepo.findByBuyerIdWithItemsAfterMutation(cart.id);
    return toCartDto(updatedCart);
  }
}

import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { BuyerRepository } from "../../buyers/repositories/buyer.repository.js";
import { CartRepository } from "../../cart/repositories/cart.repository.js";
import {
  COUPON_ACTIONS,
  COUPON_AUDIT_ENTITY_TYPE,
} from "../constants/coupon.constants.js";
import { toCouponDto } from "../dto/coupon.dto.js";
import {
  CouponRepository,
  generateCouponCode,
  type CouponRecord,
} from "../repositories/coupon.repository.js";
import type {
  AppliedCoupon,
  CreateCouponInput,
  ListCouponsOptions,
  UpdateCouponInput,
} from "../types/coupon.types.js";
import type { CouponValidateResultDto } from "../types/coupon.types.js";

function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export class CouponService {
  private readonly repo = new CouponRepository(prisma);
  private readonly buyerRepo = new BuyerRepository(prisma);
  private readonly cartRepo = new CartRepository(prisma);

  private async resolveBuyerId(actorUserId: string): Promise<string> {
    const buyer = await this.buyerRepo.findIdByUserId(actorUserId);
    if (!buyer) {
      throw new ForbiddenError("Buyer profile required");
    }
    return buyer.id;
  }

  private async allocateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const code = generateCouponCode();
      const existing = await this.repo.findByCode(code);
      if (!existing) return code;
    }
    throw new ConflictError("Unable to generate a unique coupon code");
  }

  private assertCouponUsable(
    coupon: CouponRecord,
    buyerId: string,
    existingRedemption: { id: string } | null,
  ): void {
    if (!coupon.isActive) {
      throw new ValidationError("This coupon is inactive");
    }
    if (coupon.usedCount >= coupon.maxUses) {
      throw new ValidationError("This coupon has reached its usage limit");
    }
    if (existingRedemption) {
      throw new ValidationError("You have already used this coupon");
    }
    void buyerId;
  }

  computeDiscount(
    subtotal: Prisma.Decimal,
    discountPercent: Prisma.Decimal,
  ): { discountAmount: Prisma.Decimal; totalAmount: Prisma.Decimal } {
    if (subtotal.lte(0)) {
      throw new ValidationError("Cart subtotal must be greater than zero");
    }
    const rawDiscount = subtotal.mul(discountPercent).div(100);
    const discountAmount = roundMoney(rawDiscount);
    const totalAmount = roundMoney(subtotal.sub(discountAmount));
    if (totalAmount.lt(0)) {
      throw new ValidationError("Discount cannot exceed order subtotal");
    }
    return { discountAmount, totalAmount };
  }

  async create(actorUserId: string, input: CreateCouponInput) {
    const code = input.code
      ? input.code.toUpperCase()
      : await this.allocateUniqueCode();

    const existing = await this.repo.findByCode(code);
    if (existing) {
      throw new ConflictError("A coupon with this code already exists");
    }

    const created = await this.repo.create({
      code,
      discountPercent: input.discountPercent,
      maxUses: input.maxUses,
      isActive: input.isActive ?? true,
    });

    auditLogger.log({
      actorUserId,
      action: COUPON_ACTIONS.CREATE,
      entityType: COUPON_AUDIT_ENTITY_TYPE,
      entityId: created.id,
      metadata: {
        code: created.code,
        discountPercent: created.discountPercent.toString(),
        maxUses: created.maxUses,
      },
    });

    return toCouponDto(created);
  }

  async list(query: ListCouponsOptions) {
    const { items, total } = await this.repo.list(query);
    const totalPages = Math.max(1, Math.ceil(total / query.limit));
    return {
      items: items.map(toCouponDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  async getById(id: string) {
    const coupon = await this.repo.findById(id);
    if (!coupon) throw new NotFoundError("Coupon not found");
    return toCouponDto(coupon);
  }

  async update(actorUserId: string, id: string, input: UpdateCouponInput) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Coupon not found");

    if (
      input.maxUses !== undefined &&
      input.maxUses < existing.usedCount
    ) {
      throw new ValidationError(
        `maxUses cannot be less than current usedCount (${existing.usedCount})`,
      );
    }

    const updated = await this.repo.update(id, {
      ...(input.discountPercent !== undefined
        ? { discountPercent: input.discountPercent }
        : {}),
      ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    auditLogger.log({
      actorUserId,
      action:
        input.isActive === false
          ? COUPON_ACTIONS.DEACTIVATE
          : COUPON_ACTIONS.UPDATE,
      entityType: COUPON_AUDIT_ENTITY_TYPE,
      entityId: id,
      metadata: {
        code: updated.code,
        discountPercent: updated.discountPercent.toString(),
        maxUses: updated.maxUses,
        isActive: updated.isActive,
      },
    });

    return toCouponDto(updated);
  }

  async validateForBuyer(
    actorUserId: string,
    code: string,
  ): Promise<CouponValidateResultDto> {
    const buyerId = await this.resolveBuyerId(actorUserId);
    const coupon = await this.repo.findByCode(code.toUpperCase());
    if (!coupon) {
      throw new NotFoundError("Coupon not found");
    }

    const existingRedemption = await this.repo.findRedemptionByCouponAndBuyer(
      coupon.id,
      buyerId,
    );
    this.assertCouponUsable(coupon, buyerId, existingRedemption);

    const cart = await this.cartRepo.findByBuyerIdWithItems(buyerId);
    if (!cart || cart.items.length === 0) {
      throw new ValidationError("Cart is empty");
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum.add(item.product.pricing.mul(item.quantity)),
      new Prisma.Decimal(0),
    );
    const { discountAmount, totalAmount } = this.computeDiscount(
      subtotal,
      coupon.discountPercent,
    );

    return {
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      subtotal: subtotal.toFixed(2),
      totalAfterDiscount: totalAmount.toFixed(2),
      message: `${coupon.discountPercent.toFixed(0)}% discount applied`,
    };
  }

  /**
   * Locks coupon, reserves a use, and returns discount amounts.
   * Caller must create the order and then call {@link finalizeRedemption}.
   */
  async reserveForCheckout(
    tx: Prisma.TransactionClient,
    input: {
      code: string;
      buyerId: string;
      subtotal: Prisma.Decimal;
    },
  ): Promise<AppliedCoupon> {
    const repo = new CouponRepository(tx);
    const coupon = await repo.lockByCode(input.code.toUpperCase());
    if (!coupon) {
      throw new NotFoundError("Coupon not found");
    }

    const existingRedemption = await repo.findRedemptionByCouponAndBuyer(
      coupon.id,
      input.buyerId,
    );
    this.assertCouponUsable(coupon, input.buyerId, existingRedemption);

    const { discountAmount, totalAmount } = this.computeDiscount(
      input.subtotal,
      coupon.discountPercent,
    );

    await repo.incrementUsedCount(coupon.id);

    return {
      couponId: coupon.id,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountAmount,
      totalAmount,
    };
  }

  async finalizeRedemption(
    tx: Prisma.TransactionClient,
    input: {
      couponId: string;
      buyerId: string;
      orderId: string;
      actorUserId: string;
    },
  ): Promise<void> {
    const repo = new CouponRepository(tx);
    await repo.createRedemption({
      couponId: input.couponId,
      buyerId: input.buyerId,
      orderId: input.orderId,
    });

    auditLogger.log({
      actorUserId: input.actorUserId,
      action: COUPON_ACTIONS.REDEEM,
      entityType: COUPON_AUDIT_ENTITY_TYPE,
      entityId: input.couponId,
      metadata: {
        orderId: input.orderId,
        buyerId: input.buyerId,
      },
    });
  }

  /**
   * Releases a reserved coupon when an unpaid checkout is abandoned/cancelled.
   * No-op when the order has no redemption.
   */
  async releaseForOrder(
    tx: Prisma.TransactionClient,
    input: { orderId: string; actorUserId: string },
  ): Promise<void> {
    const repo = new CouponRepository(tx);
    const redemption = await repo.findRedemptionByOrderId(input.orderId);
    if (!redemption) return;

    await repo.deleteRedemption(redemption.id);

    const coupon = await repo.lockById(redemption.couponId);
    if (coupon && coupon.usedCount > 0) {
      await repo.decrementUsedCount(coupon.id);
    }

    auditLogger.log({
      actorUserId: input.actorUserId,
      action: COUPON_ACTIONS.RELEASE,
      entityType: COUPON_AUDIT_ENTITY_TYPE,
      entityId: redemption.couponId,
      metadata: {
        orderId: input.orderId,
        buyerId: redemption.buyerId,
      },
    });
  }
}

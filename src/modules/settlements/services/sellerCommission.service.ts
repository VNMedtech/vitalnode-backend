import { Prisma } from "../../../../generated/prisma/client.js";
import { prisma } from "../../../infrastructure/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../shared/errors/app.errors.js";
import { auditLogger } from "../../auditLogs/services/auditLogger.util.js";
import { SellerRepository } from "../../sellers/repositories/seller.repository.js";
import { SETTLEMENT_ACTIONS, SETTLEMENT_AUDIT_ENTITY_TYPE } from "../constants/settlement.constants.js";
import { calculateCommissionBreakdown } from "../utils/commission.util.js";

export class SellerCommissionService {
  private readonly sellerRepo = new SellerRepository(prisma);

  async updateSellerCommission(
    actorUserId: string,
    sellerId: string,
    commissionPercentage: number,
  ) {
    const seller = await this.sellerRepo.findById(sellerId);
    if (!seller) {
      throw new NotFoundError("Seller not found");
    }

    if (seller.commissionPercentage === null) {
      throw new ConflictError(
        "Commission can only be updated for approved sellers",
      );
    }

    const updated = await this.sellerRepo.updateCommissionPercentage(
      sellerId,
      new Prisma.Decimal(commissionPercentage),
    );

    auditLogger.log({
      actorUserId,
      action: SETTLEMENT_ACTIONS.COMMISSION_UPDATED,
      entityType: SETTLEMENT_AUDIT_ENTITY_TYPE,
      entityId: sellerId,
      metadata: {
        previousCommissionPercentage: seller.commissionPercentage?.toString(),
        newCommissionPercentage: commissionPercentage,
      },
    });

    return updated;
  }
}

export async function finalizeOrderEarningsOnDelivery(
  tx: Prisma.TransactionClient,
  orderId: string,
  sellerId: string,
  totalAmount: Prisma.Decimal,
): Promise<void> {
  const seller = await tx.sellerProfile.findUnique({
    where: { id: sellerId },
    select: { commissionPercentage: true },
  });

  if (!seller?.commissionPercentage) {
    throw new ValidationError(
      "Seller commission percentage is not configured",
    );
  }

  const breakdown = calculateCommissionBreakdown(
    totalAmount,
    seller.commissionPercentage,
  );

  await tx.order.update({
    where: { id: orderId },
    data: {
      deliveredAt: new Date(),
      grossAmount: breakdown.grossAmount,
      commissionPercentageSnapshot: breakdown.commissionPercentage,
      commissionAmount: breakdown.commissionAmount,
      sellerReceivableAmount: breakdown.sellerReceivableAmount,
    },
  });
}

import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

export class BuyerRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findIdByUserId(userId: string) {
    return this.prisma.buyerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
  }
}

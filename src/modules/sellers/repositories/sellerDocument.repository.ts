import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

const sellerDocumentSelect = {
  id: true,
  sellerId: true,
  fileUrl: true,
  fileType: true,
  createdAt: true,
} satisfies Prisma.SellerDocumentSelect;

export type SellerDocumentRecord = Prisma.SellerDocumentGetPayload<{
  select: typeof sellerDocumentSelect;
}>;

export class SellerDocumentRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  findBySellerId(sellerId: string) {
    return this.prisma.sellerDocument.findMany({
      where: { sellerId },
      select: sellerDocumentSelect,
      orderBy: { createdAt: "asc" },
    });
  }
}

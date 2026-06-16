import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

export interface CreateProductMediaInput {
  fileUrl: string;
  displayOrder?: number;
}

export class ProductMediaRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async replaceForProduct(productId: string, media: CreateProductMediaInput[]) {
    await this.prisma.productMedia.deleteMany({ where: { productId } });

    if (media.length === 0) {
      return;
    }

    await this.prisma.productMedia.createMany({
      data: media.map((item, index) => ({
        productId,
        fileUrl: item.fileUrl,
        displayOrder: item.displayOrder ?? index,
      })),
    });
  }
}

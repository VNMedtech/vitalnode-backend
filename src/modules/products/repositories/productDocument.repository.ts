import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

export interface CreateProductDocumentInput {
  fileUploadId: string;
  fileUrl: string;
  documentType: string;
}

export class ProductDocumentRepository {
  constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
  ) {}

  async replaceForProduct(
    productId: string,
    documents: CreateProductDocumentInput[],
  ) {
    await this.prisma.productDocument.deleteMany({ where: { productId } });

    if (documents.length === 0) {
      return;
    }

    await this.prisma.productDocument.createMany({
      data: documents.map((item) => ({
        productId,
        fileUploadId: item.fileUploadId,
        fileUrl: item.fileUrl,
        documentType: item.documentType,
      })),
    });
  }
}

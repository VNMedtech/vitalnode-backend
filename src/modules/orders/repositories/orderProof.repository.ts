import {
  Prisma,
  ProofType,
  type PrismaClient,
} from "../../../../generated/prisma/client.js";
import { ConflictError } from "../../../shared/errors/app.errors.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export class OrderProofRepository {
  constructor(private readonly db: DbClient) {}

  existsByOrderIdAndType(orderId: string, proofType: ProofType) {
    return this.db.orderProof.findFirst({
      where: { orderId, proofType },
      select: { id: true },
    });
  }

  async create(input: {
    orderId: string;
    proofType: ProofType;
    fileUrl: string;
    uploadedBy: string;
  }) {
    try {
      return await this.db.orderProof.create({
        data: {
          orderId: input.orderId,
          proofType: input.proofType,
          fileUrl: input.fileUrl,
          uploadedBy: input.uploadedBy,
        },
        select: {
          id: true,
          proofType: true,
          fileUrl: true,
          uploadedBy: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          `${input.proofType} proof already uploaded for this order`,
        );
      }
      throw error;
    }
  }
}

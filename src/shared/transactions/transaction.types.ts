import type { Prisma } from "../../../generated/prisma/client.js";

export type TxClient = Prisma.TransactionClient;

export type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: "ReadCommitted" | "RepeatableRead" | "Serializable";
};

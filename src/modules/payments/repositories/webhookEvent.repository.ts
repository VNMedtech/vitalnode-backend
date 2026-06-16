import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type WebhookAcquireResult =
  | { action: "process"; id: string }
  | { action: "skip"; id: string };

export class WebhookEventRepository {
  constructor(private readonly db: DbClient) {}

  /**
   * Insert a new webhook event, or return an existing unprocessed event for retry.
   * Already-processed duplicates are returned with action "skip".
   */
  async acquireForProcessing(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
  }): Promise<WebhookAcquireResult> {
    try {
      const event = await this.db.webhookEvent.create({
        data: {
          provider: input.provider,
          eventId: input.eventId,
          eventType: input.eventType,
          payload: input.payload,
        },
        select: { id: true },
      });
      return { action: "process", id: event.id };
    } catch (error) {
      const prismaError = error as { code?: string };
      if (prismaError.code !== "P2002") {
        throw error;
      }

      const existing = await this.db.webhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: input.provider,
            eventId: input.eventId,
          },
        },
        select: { id: true, processedAt: true },
      });

      if (!existing) {
        throw error;
      }

      if (existing.processedAt) {
        return { action: "skip", id: existing.id };
      }

      return { action: "process", id: existing.id };
    }
  }

  markProcessed(id: string) {
    return this.db.webhookEvent.update({
      where: { id },
      data: { processedAt: new Date() },
    });
  }
}

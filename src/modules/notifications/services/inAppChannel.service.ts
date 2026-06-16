import { prisma } from "../../../infrastructure/prisma/client.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import type { NotificationEvent } from "../types/notificationEvent.types.js";
import { withRetry } from "../utils/retry.util.js";

export class InAppChannelService {
  private readonly repo = new NotificationRepository(prisma);

  async handleEvent(event: NotificationEvent): Promise<void> {
    const payloads = Array.isArray(event.inApp) ? event.inApp : [event.inApp];

    await Promise.all(
      payloads.map((payload) =>
        withRetry(
          () => this.repo.create(payload),
          {
            operation: "in_app.create",
            context: {
              eventType: event.eventType,
              correlationId: event.correlationId,
              userId: payload.userId,
              type: payload.type,
            },
          },
        ),
      ),
    );

    logger.info(
      {
        eventType: event.eventType,
        correlationId: event.correlationId,
        recipientCount: payloads.length,
      },
      "In-app notifications created",
    );
  }
}

export const inAppChannelService = new InAppChannelService();

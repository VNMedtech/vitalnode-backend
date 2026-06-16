import { prisma } from "../../../infrastructure/prisma/client.js";
import { logger } from "../../../infrastructure/logger/logger.js";
import { notificationEventBus } from "../events/notificationEventBus.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import type { CreateNotificationInput } from "../types/notification.types.js";
import type { NotificationEvent } from "../types/notificationEvent.types.js";

const notificationRepository = new NotificationRepository(prisma);

export const notificationDispatcher = {
  createInApp(input: CreateNotificationInput): void {
    void notificationRepository
      .create(input)
      .catch((error) => {
        logger.error(
          {
            err: error,
            userId: input.userId,
            type: input.type,
          },
          "Failed to create in-app notification",
        );
      });
  },

  emit(event: NotificationEvent): void {
    logger.info(
      {
        eventType: event.eventType,
        correlationId: event.correlationId,
      },
      "Notification event dispatched",
    );

    void notificationEventBus.publish(event).catch((error) => {
      logger.error(
        {
          err: error,
          eventType: event.eventType,
          correlationId: event.correlationId,
        },
        "Notification event bus publish failed",
      );
    });
  },
};

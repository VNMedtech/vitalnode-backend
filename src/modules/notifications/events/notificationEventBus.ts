import { logger } from "../../../infrastructure/logger/logger.js";
import type { NotificationEventType } from "../constants/notification.constants.js";
import type { NotificationEvent } from "../types/notificationEvent.types.js";

export type NotificationEventHandler = (
  event: NotificationEvent,
) => Promise<void>;

export class NotificationEventBus {
  private readonly handlers = new Map<
    NotificationEventType,
    NotificationEventHandler[]
  >();

  subscribe(
    eventType: NotificationEventType,
    handler: NotificationEventHandler,
  ): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  async publish(event: NotificationEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) ?? [];

    if (handlers.length === 0) {
      logger.warn(
        { eventType: event.eventType, correlationId: event.correlationId },
        "No notification handlers registered for event",
      );
      return;
    }

    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          logger.error(
            {
              err: error,
              eventType: event.eventType,
              correlationId: event.correlationId,
            },
            "Notification event handler failed",
          );
        }
      }),
    );
  }
}

export const notificationEventBus = new NotificationEventBus();

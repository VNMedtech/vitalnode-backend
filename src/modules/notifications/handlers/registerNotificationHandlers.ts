import { NOTIFICATION_EVENTS } from "../constants/notification.constants.js";
import { notificationEventBus } from "../events/notificationEventBus.js";
import { handleEmailNotification } from "./emailNotification.handler.js";
import { handleInAppNotification } from "./inAppNotification.handler.js";

let registered = false;

export function registerNotificationHandlers(): void {
  if (registered) {
    return;
  }

  const eventTypes = Object.values(NOTIFICATION_EVENTS);

  for (const eventType of eventTypes) {
    notificationEventBus.subscribe(eventType, handleInAppNotification);
    notificationEventBus.subscribe(eventType, handleEmailNotification);
  }

  registered = true;
}

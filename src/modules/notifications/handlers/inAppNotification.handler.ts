import { inAppChannelService } from "../services/inAppChannel.service.js";
import type { NotificationEvent } from "../types/notificationEvent.types.js";

export async function handleInAppNotification(
  event: NotificationEvent,
): Promise<void> {
  await inAppChannelService.handleEvent(event);
}

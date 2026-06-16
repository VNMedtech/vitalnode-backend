import { emailChannelService } from "../services/emailChannel.service.js";
import type { NotificationEvent } from "../types/notificationEvent.types.js";

export async function handleEmailNotification(
  event: NotificationEvent,
): Promise<void> {
  await emailChannelService.handleEvent(event);
}

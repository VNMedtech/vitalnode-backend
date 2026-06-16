import { EMAIL_TEMPLATE_IDS } from "../constants/email.constants.js";
import {
  renderDeliveryAssignedEmail,
  renderOrderCancelledEmail,
  renderOrderDeliveredEmail,
  renderOrderPlacedEmail,
  renderPasswordResetEmail,
  renderProductApprovedEmail,
  renderProductRejectedEmail,
  renderSellerApprovedEmail,
  renderSellerRejectedEmail,
} from "../templates/index.js";
import type { RenderedEmail, TemplateDataMap } from "../types/email.types.js";

export class TemplateService {
  render<T extends keyof TemplateDataMap>(
    templateId: T,
    data: TemplateDataMap[T],
  ): RenderedEmail {
    switch (templateId) {
      case EMAIL_TEMPLATE_IDS.PASSWORD_RESET:
        return renderPasswordResetEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.PASSWORD_RESET]);
      case EMAIL_TEMPLATE_IDS.SELLER_APPROVED:
        return renderSellerApprovedEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.SELLER_APPROVED]);
      case EMAIL_TEMPLATE_IDS.SELLER_REJECTED:
        return renderSellerRejectedEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.SELLER_REJECTED]);
      case EMAIL_TEMPLATE_IDS.PRODUCT_APPROVED:
        return renderProductApprovedEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.PRODUCT_APPROVED]);
      case EMAIL_TEMPLATE_IDS.PRODUCT_REJECTED:
        return renderProductRejectedEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.PRODUCT_REJECTED]);
      case EMAIL_TEMPLATE_IDS.ORDER_PLACED:
        return renderOrderPlacedEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.ORDER_PLACED]);
      case EMAIL_TEMPLATE_IDS.ORDER_CANCELLED:
        return renderOrderCancelledEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.ORDER_CANCELLED]);
      case EMAIL_TEMPLATE_IDS.DELIVERY_ASSIGNED:
        return renderDeliveryAssignedEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.DELIVERY_ASSIGNED]);
      case EMAIL_TEMPLATE_IDS.ORDER_DELIVERED:
        return renderOrderDeliveredEmail(data as TemplateDataMap[typeof EMAIL_TEMPLATE_IDS.ORDER_DELIVERED]);
      default: {
        const exhaustiveCheck: never = templateId;
        throw new Error(`Unsupported email template: ${exhaustiveCheck}`);
      }
    }
  }
}

export const templateService = new TemplateService();

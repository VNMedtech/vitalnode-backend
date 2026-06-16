export interface RazorpayOrderCreateInput {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayRefundInput {
  paymentId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}

export interface RazorpayRefundResponse {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}

export interface RazorpayWebhookPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  currency?: string;
}

export interface RazorpayWebhookRefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
}

export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: RazorpayWebhookPaymentEntity };
    order?: { entity: { id: string; amount: number } };
    refund?: { entity: RazorpayWebhookRefundEntity };
  };
}

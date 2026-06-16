import { createHmac, timingSafeEqual } from "node:crypto";

function safeCompare(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const payload = `${input.orderId}|${input.paymentId}`;
  const expected = createHmac("sha256", input.secret)
    .update(payload)
    .digest("hex");

  return safeCompare(expected, input.signature);
}

export function verifyWebhookSignature(input: {
  rawBody: string | Buffer;
  signature: string;
  secret: string;
}): boolean {
  const expected = createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");

  return safeCompare(expected, input.signature);
}

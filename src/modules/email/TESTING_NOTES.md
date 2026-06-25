# Email Module — Testing Guide

## Overview

The email module delivers transactional HTML emails through **AWS SES (SDK v3)** with plain-text fallbacks. Business services call `emailService`; low-level delivery is handled by `sesEmailClient` in `src/infrastructure/email/`.

Supported templates:

| Template | Method | Trigger |
|----------|--------|---------|
| Password reset | `sendPasswordResetEmail` | `POST /api/v1/auth/forgot-password` |
| Seller approved | `sendSellerApprovedEmail` | Admin approves seller |
| Seller rejected | `sendSellerRejectedEmail` | Admin rejects seller |
| Product approved | `sendProductApprovedEmail` | Admin approves product |
| Product rejected | `sendProductRejectedEmail` | Admin rejects product |

---

## Prerequisites

### 1. AWS SES setup

1. Verify a sender identity in AWS SES (email address or domain).
2. If the account is in **SES sandbox**, verify every recipient address you test with.
3. Create an IAM user/role with `ses:SendEmail` (or `ses:SendRawEmail`) permission.

### 2. Environment variables

Add to `server/.env`:

```env
AWS_SES_REGION=ap-south-1
AWS_SES_ACCESS_KEY_ID=your_ses_access_key
AWS_SES_SECRET_ACCESS_KEY=your_ses_secret_key
SES_FROM_EMAIL=noreply@yourdomain.com
SES_FROM_NAME=Medical Equipment Marketplace
SES_REPLY_TO_EMAIL=support@yourdomain.com
WEB_APP_BASE_URL=http://localhost:3001
```

`SES_FROM_EMAIL` is required. `SMTP_FROM_EMAIL` is used as a fallback if `SES_FROM_EMAIL` is not set.

### 3. Start the API

```bash
cd server && npm run dev
```

---

## Unit Tests (templates)

Template rendering is covered without AWS credentials:

```bash
cd server && npm test -- tests/unit/email/template.service.test.ts
```

Validates:

- Subject lines
- HTML body content
- Plain-text fallback content
- Optional fields (reason, CTA URLs, recipient name)

---

## Integration Tests (password reset)

Existing auth integration tests mock `emailClient.send`:

```bash
cd server && npm run test:integration:auth
```

The mock still works because `emailClient` delegates to `sesEmailClient`.

---

## Manual API Testing

### Password reset email

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "buyer@example.com"
}
```

Expected:

- `200` with generic success message (no email enumeration)
- SES delivers HTML + text email with reset link when `WEB_APP_BASE_URL` is set
- Server log: `Email sent` with `messageId` and `provider: aws-ses`

### Seller approval emails

1. Register a seller (`POST /api/v1/auth/register/seller`)
2. Login as admin and approve or reject:

```http
PATCH /api/v1/sellers/{{sellerId}}/approve
Authorization: Bearer {{adminToken}}
```

```http
PATCH /api/v1/sellers/{{sellerId}}/reject
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "reason": "Verification documents are incomplete"
}
```

Email delivery is **non-blocking** (`void emailService...catch`). API returns `200` even if SES fails; check server logs for delivery errors.

### Product approval emails

1. Create a product as an approved seller
2. Admin approves or rejects pending product:

```http
PATCH /api/v1/products/{{productId}}/approve
Authorization: Bearer {{adminToken}}
```

```http
PATCH /api/v1/products/{{productId}}/reject
Authorization: Bearer {{adminToken}}
Content-Type: application/json

{
  "reason": "Missing regulatory certification"
}
```

---

## Direct service smoke test (Node REPL)

With env configured and server built:

```bash
cd server && npx tsx -e "
import { emailService } from './src/modules/email/services/email.service.js';

await emailService.sendSellerApprovedEmail('verified-recipient@example.com', {
  recipientName: 'Test Seller',
  businessName: 'Test Medical Supplies',
  dashboardUrl: 'http://localhost:3001/seller/dashboard',
});
console.log('Email sent');
"
```

Replace the recipient with a verified address in SES sandbox mode.

---

## Error scenarios

| Scenario | Expected behavior |
|----------|-------------------|
| Missing `SES_FROM_EMAIL` / `AWS_SES_*` credentials | `503 EMAIL_NOT_CONFIGURED` when send is awaited |
| Invalid recipient (sandbox) | `502 EMAIL_SEND_FAILED`, error logged with SES message |
| SES throttling / service error | `502 EMAIL_SEND_FAILED`, full error in server logs |
| Approval workflow with SES down | API succeeds; email failure logged silently |

---

## Logging

Successful sends log:

```json
{
  "to": ["user@example.com"],
  "subject": "Your seller account has been approved",
  "messageId": "...",
  "provider": "aws-ses"
}
```

Failures log `SES send failed` with error name and message. Passwords, tokens, and JWT values are never logged.

---

## Architecture reference

```txt
Business service (auth, sellers, products)
    ↓
emailService (src/modules/email/services/email.service.ts)
    ↓
templateService → HTML + text templates
    ↓
sesEmailClient (src/infrastructure/email/ses.client.ts)
    ↓
AWS SES SDK v3
```

---

## Troubleshooting

1. **Email not received** — Check spam folder; confirm sender/recipient are verified in sandbox.
2. **`MessageRejected`** — Sender identity not verified in SES.
3. **`AccessDenied`** — IAM policy missing `ses:SendEmail`.
4. **Wrong region** — `AWS_SES_REGION` (or shared `AWS_REGION` fallback) must match the region where the identity was verified.
5. **No reset link in email** — Set `WEB_APP_BASE_URL`; otherwise the email includes a raw token.

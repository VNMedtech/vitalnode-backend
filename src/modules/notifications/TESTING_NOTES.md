# Notifications Module — Testing Guide

## Overview

The notifications module uses an **event-driven architecture** with two channels:

| Channel | Handler | Description |
|---------|---------|-------------|
| `IN_APP` | `inAppChannelService` | Persists rows to the `Notification` table |
| `EMAIL` | `emailChannelService` | Sends transactional email via AWS SES (with retry) |

Domain services emit events through `notificationDispatcher.emit()`. Handlers are registered at startup via `registerNotificationHandlers()` in `app.ts`.

---

## Supported Events

| Event | Trigger | Email recipients |
|-------|---------|------------------|
| `SELLER_APPROVED` | Admin approves seller | Seller |
| `SELLER_REJECTED` | Admin rejects seller | Seller |
| `PRODUCT_APPROVED` | Admin approves product | Seller |
| `PRODUCT_REJECTED` | Admin rejects product | Seller |
| `ORDER_PLACED` | Payment fulfillment succeeds | Buyer + Seller |
| `ORDER_CANCELLED` | Order cancelled | Buyer + Seller |
| `DELIVERY_ASSIGNED` | Delivery partner assigned/reassigned | Partner + Buyer + Seller |
| `ORDER_DELIVERED` | Delivery partner marks delivered | Buyer + Seller |

---

## Template Mapping

See `constants/templateMapping.constants.ts`:

| Event | Email template ID |
|-------|---------------------|
| `SELLER_APPROVED` | `seller-approved` |
| `SELLER_REJECTED` | `seller-rejected` |
| `PRODUCT_APPROVED` | `product-approved` |
| `PRODUCT_REJECTED` | `product-rejected` |
| `ORDER_PLACED` | `order-placed` |
| `ORDER_CANCELLED` | `order-cancelled` |
| `DELIVERY_ASSIGNED` | `delivery-assigned` |
| `ORDER_DELIVERED` | `order-delivered` |

---

## Retry & Logging

- Email and in-app writes retry up to **3 attempts** with exponential backoff (`utils/retry.util.ts`).
- Structured logs via Pino:
  - `Notification event dispatched` — event published
  - `In-app notifications created` — DB writes succeeded
  - `Notification operation failed — retrying` — transient failure
  - `Notification operation failed after retries` — terminal failure
  - `Email channel skipped — SES not configured` — SES env missing

---

## API Endpoints

Base path: `/api/v1/notifications`

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/` | `notifications:read` | List notifications (paginated) |
| `GET` | `/unread-count` | `notifications:read` | Unread count |
| `PATCH` | `/read-all` | `notifications:read` | Mark all as read |
| `PATCH` | `/:id/read` | `notifications:read` | Mark one as read |

### Query parameters (`GET /`)

- `page` (default 1)
- `limit` (default 20, max 100)
- `sortBy` (`createdAt`)
- `sortOrder` (`asc` | `desc`)
- `isRead` (`true` | `false`)
- `type` (e.g. `ORDER_PLACED`, `SELLER_APPROVED`)

---

## Postman

Import `postman/notifications.collection.json`.

### Suggested flow

1. **Login** as buyer/seller/admin (capture token).
2. **Trigger domain event** (e.g. approve seller, place order).
3. **GET** `/api/v1/notifications` — verify in-app notification.
4. **GET** `/api/v1/notifications/unread-count` — verify count.
5. **PATCH** `/api/v1/notifications/{id}/read` — mark read.
6. Check server logs for email dispatch / retry messages.

### Email verification

Requires AWS SES configuration (see `modules/email/TESTING_NOTES.md`). In sandbox mode, verify recipient addresses in SES.

---

## Event Trigger Reference

| Event | API to trigger |
|-------|----------------|
| Seller approved/rejected | `PATCH /api/v1/sellers/:id/approve` or `/reject` |
| Product approved/rejected | `PATCH /api/v1/products/:id/approve` or `/reject` |
| Order placed | Complete checkout + payment verify/webhook |
| Order cancelled | `POST /api/v1/orders/cancel` or admin cancel |
| Delivery assigned | `PATCH /api/v1/orders/:id/assign-delivery-partner` |
| Order delivered | `PATCH /api/v1/orders/:id/delivered` (delivery partner) |

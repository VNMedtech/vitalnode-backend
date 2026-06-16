# Delivery Partners Module — Testing Notes

## Prerequisites

1. Start the API server: `cd server && npm run dev`
2. Seed the database: `cd server && npm run db:seed`
3. Import `postman/delivery-partners.collection.json` and `postman/Medical Marketplace.postman_environment.json`
4. Obtain `{{adminToken}}` via Auth collection login (`admin@marketplace.local` / seed password)

## Recommended Test Order

```txt
POST   /api/v1/delivery-partners              (admin — create)
GET    /api/v1/delivery-partners              (admin — list + search)
GET    /api/v1/delivery-partners/:id          (admin — detail)
PATCH  /api/v1/delivery-partners/:id          (admin — update)
PATCH  /api/v1/delivery-partners/:id/disable  (admin — disable)
PATCH  /api/v1/delivery-partners/:id/enable   (admin — re-enable)
```

## Endpoint Matrix

| Endpoint | Method | Auth | Permission | Expected Status |
|----------|--------|------|------------|-----------------|
| `/api/v1/delivery-partners` | GET | Admin | `delivery-partners:read` | `200` |
| `/api/v1/delivery-partners/:id` | GET | Admin | `delivery-partners:read` | `200` / `404` |
| `/api/v1/delivery-partners` | POST | Admin | `delivery-partners:manage` | `201` / `409` |
| `/api/v1/delivery-partners/:id` | PATCH | Admin | `delivery-partners:manage` | `200` / `404` / `409` |
| `/api/v1/delivery-partners/:id/disable` | PATCH | Admin | `delivery-partners:manage` | `200` / `404` / `409` |
| `/api/v1/delivery-partners/:id/enable` | PATCH | Admin | `delivery-partners:manage` | `200` / `404` / `409` |

## Happy Path

### Create (admin)

```json
POST /api/v1/delivery-partners
Authorization: Bearer {{adminToken}}

{
  "email": "partner@logistics.example",
  "firstName": "Ravi",
  "lastName": "Kumar",
  "phoneNumber": "+919876543210",
  "addressLine1": "12 Transport Nagar",
  "addressLine2": "Block B",
  "city": "Mumbai",
  "state": "Maharashtra",
  "country": "India",
  "postalCode": "400001"
}
```

- Expect `201`, `success: true`
- Response includes `data.temporaryPassword` (one-time, store securely)
- `data.deliveryPartner.user.mustChangePassword` is `true`
- Save `data.deliveryPartner.id` as `deliveryPartnerId`
- Audit log: action `DELIVERY_PARTNER_CREATE`, entityType `DELIVERY_PARTNER`
- Async notification `DELIVERY_PARTNER_CREATED` is created for the partner

### First login (delivery partner)

```json
POST /api/v1/auth/login

{
  "email": "partner@logistics.example",
  "password": "<temporaryPassword from create response>"
}
```

- Expect `200`, `data.mustChangePassword: true`
- Partner can access `GET /api/v1/users/me` but other protected routes return `403` until password is changed
- Change password via `POST /api/v1/users/me/change-password`

### List (admin)

```
GET /api/v1/delivery-partners?page=1&limit=20&sortBy=createdAt&sortOrder=desc&search=Mumbai&status=ACTIVE
```

- Expect `200` with `data` array and `meta` (`page`, `limit`, `total`, `totalPages`)
- `search` matches name, email, phone, city, state, country, and postal code
- `status` filters on linked user account status (`ACTIVE` | `DISABLED`)

### Get by ID (admin)

```
GET /api/v1/delivery-partners/{{deliveryPartnerId}}
```

- Expect `200` with matching `data.id` and linked `user` summary

### Update (admin)

```json
PATCH /api/v1/delivery-partners/{{deliveryPartnerId}}

{
  "firstName": "Ravi",
  "city": "Pune"
}
```

- Expect `200`
- At least one field required; empty body returns `400`
- Audit log: action `DELIVERY_PARTNER_UPDATE` with `metadata.changedFields`

### Disable (admin)

```json
PATCH /api/v1/delivery-partners/{{deliveryPartnerId}}/disable

{
  "reason": "Inactive service area"
}
```

- Expect `200`, `data.user.status: DISABLED`
- Disabled partners cannot be assigned to new orders
- Audit log: action `DELIVERY_PARTNER_DISABLE`

### Re-enable (admin)

```json
PATCH /api/v1/delivery-partners/{{deliveryPartnerId}}/enable

{
  "reason": "Returned to active roster"
}
```

- Expect `200`, `data.user.status: ACTIVE`
- Audit log: action `DELIVERY_PARTNER_ENABLE`

## Negative Cases

| Scenario | Request | Expected |
|----------|---------|----------|
| Duplicate email on create | POST with existing email | `409` — Email already registered |
| Duplicate phone on create | POST with existing phone | `409` — Phone number is already in use |
| Buyer lists partners | GET with `buyerToken` | `403` |
| Unauthenticated create | POST without token | `401` |
| Invalid UUID | GET `/api/v1/delivery-partners/not-a-uuid` | `400` |
| Missing partner | GET random UUID | `404` |
| Disable twice | PATCH disable on disabled partner | `409` |
| Enable twice | PATCH enable on active partner | `409` |
| Empty update body | PATCH `{}` | `400` |
| Partner with mustChangePassword lists orders | GET orders with temp-login token | `403` |

## Pagination & Sorting

Supported query params:

- `page` (default `1`, min `1`)
- `limit` (default `20`, max `100`)
- `sortBy`: `createdAt` | `updatedAt` | `city` | `state` | `country` (default `createdAt`)
- `sortOrder`: `asc` | `desc` (default `desc`)
- `search`: optional, max 120 chars
- `status`: `ACTIVE` | `DISABLED`
- `city`, `state`, `country`: exact match (case-insensitive)

## Integration with Orders

After creating or listing an active partner, use `deliveryPartnerId` when assigning deliveries:

```
POST /api/v1/orders/{{orderId}}/assign-delivery-partner
Authorization: Bearer {{adminToken}}

{
  "deliveryPartnerId": "{{deliveryPartnerId}}"
}
```

Disabled partners return `409` on assignment.

## Audit Verification

After mutations, confirm audit entries:

```
GET /api/v1/audit-logs?entityType=DELIVERY_PARTNER&entityId={{deliveryPartnerId}}
```

(Requires admin token and audit-logs module.)

## Automated Tests

Run integration tests:

```bash
cd server && npm test -- tests/integration/deliveryPartners/deliveryPartners.admin.test.ts
```

## Related Docs

- `docs/API_TESTING_FLOW.md` — Section 9 (Delivery Flow), Section 11.3 (#10)
- `docs/API_DESIGN.md` — Delivery Partner APIs (Section 14)
- `postman/delivery-partners.collection.json` — import-ready requests

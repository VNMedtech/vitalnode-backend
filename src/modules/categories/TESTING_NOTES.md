# Categories Module — Testing Notes

## Prerequisites

1. Start the API server: `cd server && npm run dev`
2. Seed the database: `cd server && npm run db:seed`
3. Import `postman/categories.collection.json` and `postman/Medical Marketplace.postman_environment.json`
4. Obtain `{{adminToken}}` via Auth collection login (`admin@marketplace.local` / seed password)

## Recommended Test Order

```txt
POST   /api/v1/categories          (admin — create)
GET    /api/v1/categories          (public — list + search)
GET    /api/v1/categories/:id      (public — detail)
PATCH  /api/v1/categories/:id      (admin — update)
DELETE /api/v1/categories/:id      (admin — disable / soft delete)
```

## Endpoint Matrix

| Endpoint | Method | Auth | Permission | Expected Status |
|----------|--------|------|------------|-----------------|
| `/api/v1/categories` | GET | Public | — | `200` |
| `/api/v1/categories/:id` | GET | Public | — | `200` / `404` |
| `/api/v1/categories` | POST | Admin | `categories:create` | `201` / `409` |
| `/api/v1/categories/:id` | PATCH | Admin | `categories:update` | `200` / `404` / `409` |
| `/api/v1/categories/:id` | DELETE | Admin | `categories:delete` | `200` / `404` |

## Happy Path

### Create (admin)

```json
POST /api/v1/categories
Authorization: Bearer {{adminToken}}

{
  "name": "Laboratory Equipment",
  "description": "Centrifuges, microscopes, and lab analyzers."
}
```

- Expect `201`, `success: true`, `data.isActive: true`
- Save `data.id` as `categoryId` (Postman test script does this automatically)
- Audit log: action `CATEGORY_CREATE`, entityType `CATEGORY`

### List (public)

```
GET /api/v1/categories?page=1&limit=20&sortBy=name&sortOrder=asc&search=Laboratory
```

- Expect `200` with `data` array and `meta` (`page`, `limit`, `total`, `totalPages`)
- Only active, non-deleted categories are returned
- `search` performs case-insensitive partial match on `name`

### Get by ID (public)

```
GET /api/v1/categories/{{categoryId}}
```

- Expect `200` with matching `data.id`
- Disabled or soft-deleted categories return `404`

### Update (admin)

```json
PATCH /api/v1/categories/{{categoryId}}

{
  "name": "Lab Equipment",
  "description": "Updated description."
}
```

- Expect `200`
- At least one field required; empty body returns `400`
- Audit log: action `CATEGORY_UPDATE` with `metadata.changedFields`

### Disable (admin)

```
DELETE /api/v1/categories/{{categoryId}}
```

- Expect `200`, `data.isActive: false`
- Soft delete sets `deletedAt`; category no longer appears in public list/detail
- Existing products linked to the category remain intact
- Audit log: action `CATEGORY_DISABLE`

## Negative Cases

| Scenario | Request | Expected |
|----------|---------|----------|
| Duplicate name on create | POST with existing name | `409` — Category name already exists |
| Duplicate name on update | PATCH name to existing name | `409` |
| Buyer creates category | POST with `buyerToken` | `403` |
| Unauthenticated create | POST without token | `401` |
| Invalid UUID | GET `/api/v1/categories/not-a-uuid` | `400` |
| Missing category | GET random UUID | `404` |
| Disable twice | DELETE same id again | `404` |
| Empty update body | PATCH `{}` | `400` |
| Name too long | POST name > 120 chars | `400` |

## Pagination & Sorting

Supported query params:

- `page` (default `1`, min `1`)
- `limit` (default `20`, max `100`)
- `sortBy`: `name` | `createdAt` | `updatedAt` (default `name`)
- `sortOrder`: `asc` | `desc` (default `asc`)
- `search`: optional, max 120 chars

## P2002 Handling

Unique constraint violations on `Category.name` are caught in the service layer and returned as `409 Conflict` with message `Category name already exists`, even if the race bypasses the pre-check.

## Audit Verification

After mutations, confirm audit entries:

```
GET /api/v1/audit-logs?entityType=CATEGORY&entityId={{categoryId}}
```

(Requires admin token and audit-logs module.)

## Related Docs

- `docs/API_TESTING_FLOW.md` — Section 4 (Category Flow)
- `docs/API_DESIGN.md` — Category APIs
- `postman/categories.collection.json` — import-ready requests

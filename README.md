# VitalNode Backend

Node.js / Express API for the Medical Equipment Marketplace.

## Setup

1. Copy the environment template and fill in values:

   ```bash
   cp .env.example .env
   ```

2. **AWS credentials are split by service** — use separate IAM users and env vars:
   - **S3** (`AWS_S3_*`) for file uploads (product images, handover/delivery proofs, profiles)
   - **SES** (`AWS_SES_*`) for transactional email (password reset, approvals)

   Never use one shared `AWS_ACCESS_KEY_ID` for both S3 and SES, and never define duplicate keys in `.env`.

3. Install dependencies, migrate, and seed (local development):

   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```

   `db:seed` creates demo users (admin, seller, buyer, delivery partner), categories, a sample **approved** product (multi-category via `ProductCategory`, template-driven `attributes` JSON — not fixed color/weight columns), and a system actor. Default password: `Password123!` (see `prisma/seed.ts`).

## Database scripts

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply migrations (development) |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:seed` | **Development only** — demo data + known password |
| `npm run db:bootstrap` | **Production** — create admin + system actor from env |
| `npm run db:backfill-nmc` | **Temporary** — assign placeholder NMC numbers to legacy doctor buyers (null `nmcRegistrationNumber`) |

### Temporary NMC backfill

After deploying the NMC registration migration on an environment that already has doctor buyers:

```bash
npm run db:migrate:deploy
npm run db:backfill-nmc
```

The script is idempotent: it only updates `BuyerProfile` rows where `buyerType = DOCTOR` and `nmcRegistrationNumber` is null, using placeholders like `TEMP` + part of the user id. Doctors can replace these with their real NMC via `PATCH /users/me`. Remove the script once all environments are backfilled / real values collected.

### Production bootstrap

Set in `.env` before first deploy:

```env
BOOTSTRAP_CONFIRM=true
BOOTSTRAP_ADMIN_EMAIL=admin@yourdomain.com
BOOTSTRAP_ADMIN_PASSWORD=<strong-password>
```

Then after migrate:

```bash
npm run db:migrate:deploy
npm run db:bootstrap
```

Copy the printed `SYSTEM_ACTOR_USER_ID` into `.env`. Re-running bootstrap is safe: an existing admin password is **not** changed.

## Unpaid checkout TTL

Orders left in `PENDING_PAYMENT` longer than the TTL are auto-cancelled (same outcome as buyer abandon):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PENDING_PAYMENT_TTL_MINUTES` | `30` | Age after which unpaid checkout expires |
| `PENDING_PAYMENT_SWEEP_INTERVAL_MS` | `300000` | How often the server scans (5 minutes) |

Requires `SYSTEM_ACTOR_USER_ID`. Job: `src/jobs/cleanup/expirePendingOrders.job.ts` (started from `startServer`).

## Read notification TTL

Read in-app notifications older than the retention window are hard-deleted. Unread notifications are never deleted by this job.

| Variable | Default | Purpose |
|----------|---------|---------|
| `READ_NOTIFICATION_TTL_DAYS` | `30` | Age after which a read notification is deleted |
| `READ_NOTIFICATION_SWEEP_INTERVAL_MS` | `86400000` | How often the server scans (24 hours) |

Job: `src/jobs/cleanup/expireReadNotifications.job.ts` (started from `startServer`). Retention uses `readAt` (set when the notification is first marked read).

## Idempotency key TTL

Idempotency keys replay cached responses only until `expiresAt`. After expiry the same key may be reused, and a background job hard-deletes expired rows.

| Variable | Default | Purpose |
|----------|---------|---------|
| `IDEMPOTENCY_TTL_MS` | `86400000` | Replay window written to `expiresAt` on create (24 hours) |
| `IDEMPOTENCY_SWEEP_INTERVAL_MS` | `3600000` | How often the server purges expired rows (1 hour) |

Job: `src/jobs/cleanup/expireIdempotencyKeys.job.ts` (started from `startServer`). Lookups ignore expired rows (and delete them so the unique constraint can be reused).

## Tests

```bash
npm test
```

Integration tests use `tests/.env.test` (see `tests/.env.test.example`).

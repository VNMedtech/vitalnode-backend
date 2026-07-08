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

   `db:seed` creates demo users (admin, seller, buyer, delivery partner), categories, and a system actor. Default password: `Password123!` (see `prisma/seed.ts`).

## Database scripts

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply migrations (development) |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:seed` | **Development only** — demo data + known password |
| `npm run db:bootstrap` | **Production** — create admin + system actor from env |

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

## Tests

```bash
npm test
```

Integration tests use `tests/.env.test` (see `tests/.env.test.example`).

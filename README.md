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

3. Install dependencies and start the dev server:

   ```bash
   npm install
   npm run dev
   ```

## Tests

```bash
npm test
```

Integration tests use `tests/.env.test` (see `tests/.env.test.example`).

## Documentation

- [Backend architecture](../docs/BACKEND_ARCHITECTURE.md)
- [Upload testing guide](../docs/testing/uploads-testing.md)
- [Email testing notes](src/modules/email/TESTING_NOTES.md)

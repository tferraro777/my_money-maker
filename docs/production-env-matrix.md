# My Money Maker Production Env Matrix

This matrix is the source of truth for staging/production env ownership and required values.

| Variable | Required | Environment(s) | Provider / Source | Notes |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Yes | Staging, Production | Vercel runtime | Must be `production` on deployed environments. |
| `NEXT_PUBLIC_APP_NAME` | Yes | Staging, Production | Vercel Project Env | UI branding label. |
| `NEXT_PUBLIC_BASE_URL` | Yes | Staging, Production | Vercel Project Env | Must match deployment URL/domain for links and redirects. |
| `DATABASE_URL` | Yes | Staging, Production | Neon | Primary Postgres connection string. |
| `AUTH_SECRET` | Yes | Staging, Production | Vercel Project Env (generated secret) | Minimum 32 chars. |
| `OPENAI_API_KEY` | Yes | Staging, Production | OpenAI | Used for chat + ingestion. |
| `OPENAI_MODEL` | Yes | Staging, Production | Vercel Project Env | Default `gpt-4.1-mini`. |
| `STRIPE_SECRET_KEY` | Yes | Staging, Production | Stripe Dashboard | Use test key in staging, live key in production. |
| `STRIPE_WEBHOOK_SECRET` | Yes | Staging, Production | Stripe Webhook endpoint | Unique per environment endpoint. |
| `STRIPE_PRICE_ID_MONTHLY` | Yes | Staging, Production | Stripe Product Catalog | Test price for staging, live price for production. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Staging, Production | Stripe Dashboard | Test key in staging, live key in production. |
| `EMAIL_PROVIDER` | Yes | Staging, Production | Vercel Project Env | Set to `resend`. |
| `EMAIL_FROM` | Yes | Staging, Production | Resend verified domain | Must be verified sender identity/domain. |
| `EMAIL_PROVIDER_API_KEY` | Yes | Staging, Production | Resend | API key scoped to the relevant environment/domain. |
| `R2_ACCOUNT_ID` | Yes | Staging, Production | Cloudflare Account | For R2 S3 endpoint construction. |
| `R2_ACCESS_KEY_ID` | Yes | Staging, Production | Cloudflare R2 API token | Scoped to bucket with read/write. |
| `R2_SECRET_ACCESS_KEY` | Yes | Staging, Production | Cloudflare R2 API token | Paired with access key. |
| `R2_BUCKET` | Yes | Staging, Production | Cloudflare R2 | Bucket name (for example `mmm-knowledge-prod`). |
| `R2_PUBLIC_BASE_URL` | No | Staging, Production | Cloudflare custom domain (optional) | Only needed if serving files directly. |
| `INGESTION_CRON_SECRET` | Yes* | Staging, Production | Vercel Project Env | Required unless `CRON_SECRET` is set. |
| `CRON_SECRET` | Yes* | Staging, Production | Vercel Project Env | Required unless `INGESTION_CRON_SECRET` is set. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional pair | Staging, Production | Push provider / generated VAPID key | If set, `VAPID_PRIVATE_KEY` must also be set. |
| `VAPID_PRIVATE_KEY` | Optional pair | Staging, Production | Push provider / generated VAPID key | If set, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must also be set. |
| `DEV_USER_ID` | No (forbidden) | Production | N/A | Must not be set in production. Allowed only for local dev testing. |

## Validation Rules Enforced in Runtime

- Missing required production env vars throw explicit errors at request startup.
- `DEV_USER_ID` in production throws an auth env error.
- `NEXT_PUBLIC_BASE_URL` cannot be localhost in production.
- Push env is validated as an all-or-nothing pair.
- Ingestion worker requires one of `INGESTION_CRON_SECRET` or `CRON_SECRET`.

# My Money Maker

Production-oriented starter for a global SaaS PWA that delivers AI coaching, onboarding intelligence, referrals, usage gating, chat logging, admin analytics, and income/activity tracking.

## Stack
- Next.js App Router + TypeScript + Tailwind
- PostgreSQL + pgvector schema (`db/schema.sql`)
- OpenAI server-side API integration (`src/lib/ai.ts`)
- Stripe subscription webhook scaffold (`src/app/api/stripe/webhook/route.ts`)
- PWA scaffold (manifest + service worker)

## Implemented In This Scaffold
- Core schema tables from your spec, including tracker additions and indexes.
- Free usage logic with non-double-counting behavior (increment only on successful AI response).
- Referral crediting workflow with anti-abuse email canonicalization + similarity checks.
- Onboarding persistence for required contact fields, timezone, language, goals, systems, and multi-company products.
- Chat API with mode routing (`/today`, `/plan`, `/content`, `/recruit`, `/objections`, `/products`, `/compplan`, `/vocabulary`, `/encouragement`).
- Full chat and AI call logging fields for analytics.
- Helpfulness vote capture (yes/no + optional reason).
- Tracker module:
  - Income entries (currency-per-entry, no conversion)
  - Activity entries
  - Daily scoreboard widget
  - Streak + totals snapshot
  - Task completion auto-log hooks
- Admin log search endpoint with role gate.
- Birthdate sensitivity helpers + audit logging hook.
- File upload metadata route + knowledge embedding service scaffold.

## Required Environment
Copy `.env.example` to `.env.local` and fill keys.

## Run
```bash
npm install
npm run db:schema
npm run dev
```

## Manuscript Ingestion
```bash
npm run manuscripts:load -- "/absolute/path/to/manuscripts-folder"
```
Supported file types: `.pdf`, `.docx`, `.txt`, `.xls`, `.xlsx`.

## Auto-Watch Manuscripts
```bash
npm run manuscripts:watch -- "/absolute/path/to/manuscripts-folder"
```

## Key Endpoints
- `POST /api/onboarding`
- `POST /api/chat`
- `POST /api/messages/helpfulness`
- `POST /api/referrals/claim`
- `POST /api/tracker/income`
- `POST /api/tracker/activity`
- `POST /api/tasks/complete`
- `GET /api/admin/logs/search`
- `POST /api/stripe/webhook`
- `POST /api/files/upload`
- `POST /api/files/process`

## Next Hardening Steps
- Replace `x-user-id` placeholder auth with real auth (Clerk/Auth.js/Supabase Auth).
- Add true object storage upload + document parsing workers.
- Add push subscription registration and VAPID send pipeline.
- Add recurring jobs/queue for reminders and file processing.
- Add unit/integration tests for usage gating, referral anti-abuse, and tracker math.
- Add admin UI for full user management, abuse review, and sensitive-view permission controls.
- Add CSV export routes for user and admin reports.

## Auth Setup
Add to `.env.local`:

```env
AUTH_SECRET=use_a_random_secret_at_least_32_chars
```

Auth endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

UI route:
- `/auth`

Password reset:
- Request reset: `POST /api/auth/password-reset/request`
- Confirm reset: `POST /api/auth/password-reset/confirm`
- UI: `/auth/reset`

Email verification:
- Verify token: `POST /api/auth/verify`
- UI: `/auth/verify`

Verification resend:
- `POST /api/auth/verify/resend`
- UI: `/auth/verify/resend`

## Email Delivery
Verification and password reset now send real emails through Resend API when configured.

Required env vars:
```env
EMAIL_PROVIDER=resend
EMAIL_FROM=My Money Maker <no-reply@yourdomain.com>
EMAIL_PROVIDER_API_KEY=re_xxx
```

If email provider config is missing, the app falls back to dev links in API responses/logs.

Stripe billing routes:
- `POST /api/stripe/checkout`
- `POST /api/stripe/portal`

Required billing env vars:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID_MONTHLY`
- `STRIPE_WEBHOOK_SECRET`

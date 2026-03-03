# My Money Maker — Architecture Decisions

## Database source of truth
- Source of truth: `db/schema.sql`
- We do NOT use Prisma Migrate.
- `prisma/migrations/` is intentionally unused/deleted.

## Data access
- Use `db.query()` / raw SQL for reads/writes.
- Prisma Client models are not required and should not be reintroduced unless we explicitly change strategy.

## Deploy
- Database is Neon Postgres via `DATABASE_URL` in Vercel.

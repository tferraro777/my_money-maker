# Database Migration Runbook (Staging and Production)

This project uses raw SQL migrations only. Prisma migrations are intentionally not used.

## Migration Files (ordered)

1. `db/migrations/001_allow_xls_source_type.sql`
2. `db/migrations/002_password_reset_tokens.sql`
3. `db/migrations/003_email_verification_tokens.sql`
4. `db/migrations/004_ingestion_jobs.sql`
5. `db/migrations/005_schema_migrations.sql`
6. `db/migrations/006_stripe_webhook_events.sql`

## Preflight Checks

Run before applying migrations:

```bash
export DATABASE_URL="postgres://..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select version();"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select current_database(), current_schema();"
```

Verify pgvector extension availability:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "create extension if not exists vector;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select extname from pg_extension where extname in ('vector','pgcrypto');"
```

## Fresh Environment (new staging/prod DB)

Apply full baseline schema:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
```

Verification:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select to_regclass('public.users'), to_regclass('public.files'), to_regclass('public.knowledge_embeddings');"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select to_regclass('public.ingestion_jobs'), to_regclass('public.stripe_webhook_events');"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select indexname from pg_indexes where tablename='knowledge_embeddings' and indexdef ilike '%ivfflat%';"
```

## Existing Environment (incremental deploy)

Apply migrations in order (idempotent):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_allow_xls_source_type.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_password_reset_tokens.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_email_verification_tokens.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/004_ingestion_jobs.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/005_schema_migrations.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/006_stripe_webhook_events.sql
```

Record applied migration names (idempotency journal):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into schema_migrations(name) values ('001_allow_xls_source_type.sql') on conflict (name) do nothing;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into schema_migrations(name) values ('002_password_reset_tokens.sql') on conflict (name) do nothing;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into schema_migrations(name) values ('003_email_verification_tokens.sql') on conflict (name) do nothing;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into schema_migrations(name) values ('004_ingestion_jobs.sql') on conflict (name) do nothing;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into schema_migrations(name) values ('005_schema_migrations.sql') on conflict (name) do nothing;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "insert into schema_migrations(name) values ('006_stripe_webhook_events.sql') on conflict (name) do nothing;"
```

Post-apply verification:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select name, applied_at from schema_migrations order by applied_at desc;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select to_regclass('public.password_reset_tokens'), to_regclass('public.email_verification_tokens');"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select to_regclass('public.ingestion_jobs'), to_regclass('public.stripe_webhook_events');"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "select count(*) from pg_indexes where tablename='knowledge_embeddings' and indexdef ilike '%ivfflat%';"
```

## Rollback Guidance (per migration)

- `001_allow_xls_source_type.sql`
  - Restore prior check constraint list excluding `xls` only if application code is also reverted.
- `002_password_reset_tokens.sql`
  - Safe rollback: `drop table if exists password_reset_tokens cascade;`
- `003_email_verification_tokens.sql`
  - Safe rollback: `drop table if exists email_verification_tokens cascade;`
- `004_ingestion_jobs.sql`
  - Safe rollback: `drop table if exists ingestion_jobs cascade;`
  - Optional cleanup: `drop index if exists idx_knowledge_embeddings_file_unique;`
- `005_schema_migrations.sql`
  - Safe rollback: `drop table if exists schema_migrations cascade;`
- `006_stripe_webhook_events.sql`
  - Safe rollback: `drop table if exists stripe_webhook_events cascade;`

Use rollback only when corresponding application code is reverted, and always take a DB snapshot first.

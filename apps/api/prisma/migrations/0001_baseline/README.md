# Baseline Migration

This directory should contain `migration.sql` — the baseline migration for the tenant schema.

## How to generate

Run this command on a machine with PostgreSQL access:

```bash
cd apps/api
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/tenant.prisma \
  --script > prisma/migrations/0001_baseline/migration.sql
```

## How to mark as applied on existing tenants

After generating the baseline, run on each tenant DB:

```bash
npx prisma migrate resolve --applied 0001_baseline --schema=prisma/tenant.prisma
```

## Important

- This migration represents the **current** state of the tenant schema
- All existing tenant databases already have this schema applied via `db push`
- New tenants will get this migration applied automatically via `migrate deploy`

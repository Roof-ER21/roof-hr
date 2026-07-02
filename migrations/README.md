# Migrations

Versioned schema changes, applied automatically at server boot by
`server/migrationRunner.ts` and recorded in the `_applied_migrations` table.

## Rules

- Name files `NNNN_short_description.sql` — applied in numeric order, once.
- Write idempotent SQL (`IF NOT EXISTS` / `IF EXISTS` guards) so a re-run is
  harmless.
- Each file runs in its own transaction under a Postgres advisory lock; a
  failure rolls back, is logged, and retries on the next boot.
- Never edit an already-applied migration — add a new numbered file instead.

## drizzle-kit push

`npm run db:push:dev` (formerly `db:push`) diffs the live schema directly with
no history and can rewrite or drop objects on renames. **Local/dev databases
only — never against production.**

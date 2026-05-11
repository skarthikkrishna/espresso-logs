# M3 Backfill Runbook

## 1. Prerequisites

- Access to the Google Sheets spreadsheet containing the source data
- A running PostgreSQL instance with the application database
- Migration 0004 applied (`alembic upgrade head`)
- Python environment with all application dependencies installed (`uv sync`)
- Google ADC credentials configured for Sheets access (`gcloud auth application-default login`)

## 2. Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `SPREADSHEET_ID` | Google Sheets spreadsheet ID (from URL) | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` |
| `DATABASE_URL` | Async PostgreSQL connection URL | `postgresql+asyncpg://user:pass@host/dbname` |

Export both before running any command:

```bash
export SPREADSHEET_ID="<your-spreadsheet-id>"
export DATABASE_URL="postgresql+asyncpg://<user>:<pass>@<host>/<dbname>"
```

## 3. Step-by-Step Operator Commands

### Step 1 — Apply migration 0004

```bash
uv run alembic upgrade head
```

Verify the migration applied:

```bash
uv run alembic current
# Expected: 0004 (head)
```

### Step 2 — Run the backfill (dry run first)

```bash
uv run python scripts/migrate_sheets_to_postgres.py --dry-run
```

Review output. In dry-run mode, seeding is skipped entirely (no `ensure_system_user` or
`ensure_default_household` calls) and no Postgres writes of any kind occur. Placeholder UUIDs
are used internally for mapping; all per-entity mapped/error counts are still reported.

### Step 3 — Run the backfill (full)

```bash
uv run python scripts/migrate_sheets_to_postgres.py
```

Expected output shows per-entity counts ending with `MIGRATION COMPLETE`.

### Step 4 — Run partial entity migration (if needed)

```bash
uv run python scripts/migrate_sheets_to_postgres.py --entity Catalog --entity Hardware
```

### Step 5 — Validate the migration

```bash
uv run python scripts/validate_migration.py
```

Expected output:

```
✓ Catalog: 42 rows — 0 checksum errors
✓ Inventory: 18 rows — 0 checksum errors
✓ Hardware: 7 rows — 0 checksum errors
✓ Maintenance: 23 rows — 0 checksum errors
✓ Brew_Log: 315 rows — 0 checksum errors

VALIDATION PASSED
```

## 4. Expected Output

### migrate_sheets_to_postgres.py

```
→ Migrating Catalog...
  mapped=42, errors=0, upserted=42
→ Migrating Inventory...
  mapped=18, errors=0, upserted=18
→ Migrating Hardware...
  mapped=7, errors=0, upserted=7
→ Migrating Maintenance...
  mapped=23, errors=0, upserted=23
→ Migrating Brew_Log...
  mapped=315, errors=0, upserted=315

── MIGRATION SUMMARY ────────────────────────────────────────────────
  Catalog: 42 mapped, 42 upserted — PASS
  Inventory: 18 mapped, 18 upserted — PASS
  Hardware: 7 mapped, 7 upserted — PASS
  Maintenance: 23 mapped, 23 upserted — PASS
  Brew_Log: 315 mapped, 315 upserted — PASS
─────────────────────────────────────────────────────────────────────
MIGRATION COMPLETE
```

Rows with mapping errors (invalid enum values, missing required fields) are skipped with a
`SKIP:` log line. The migration continues with the remaining rows.

### validate_migration.py

```
✓ Catalog: 42 rows — 0 checksum errors
...
VALIDATION PASSED
```

Exit code `0` on success, `1` on failure.

## 5. Partial Failure Recovery

If the migration fails partway through or reports SKIP errors:

1. Check `stderr` output for `SKIP:` lines to identify problematic rows
2. Correct the data in Google Sheets if the source data is invalid
3. Re-run the migration — it is **idempotent** (uses `ON CONFLICT (sheets_id) DO UPDATE`)
4. Re-run validation to confirm all rows are now present and checksums match

To re-run a single entity only:

```bash
uv run python scripts/migrate_sheets_to_postgres.py --entity Brew_Log
```

## 6. Rollback

The migration is non-destructive: it only adds rows and new columns. To roll back:

### Roll back alembic migration (removes 0004 columns)

```bash
uv run alembic downgrade 0003
```

This removes all `sheets_id` and v2 columns added by 0004 from all entity tables.

**Warning:** This will drop all backfilled data. Only do this if you need to abort M3
entirely before M4 cutover.

### Remove the seeded system user and household (optional cleanup)

```sql
DELETE FROM households WHERE name = 'default' AND created_by = (
    SELECT id FROM users WHERE username = '__migration_system__'
);
DELETE FROM users WHERE username = '__migration_system__';
```

## 7. M4 Gate Conditions

Before M4 read switchover can proceed, the following must all be true:

1. `validate_migration.py` exits with code `0` ("VALIDATION PASSED")
2. All entity tables have 0 checksum errors
3. Row counts in Postgres match Google Sheets exactly
4. `alembic current` reports `0004 (head)`
5. No `sheets_id IS NULL` rows remain for entities that were in Sheets

Check for NULL sheets_ids:

```sql
SELECT 'catalog' AS entity, COUNT(*) FROM catalog WHERE sheets_id IS NULL
UNION ALL
SELECT 'inventory_bags', COUNT(*) FROM inventory_bags WHERE sheets_id IS NULL
UNION ALL
SELECT 'hardware', COUNT(*) FROM hardware WHERE sheets_id IS NULL
UNION ALL
SELECT 'maintenance_log', COUNT(*) FROM maintenance_log WHERE sheets_id IS NULL
UNION ALL
SELECT 'brew_log', COUNT(*) FROM brew_log WHERE sheets_id IS NULL;
```

All counts should be `0` (or acceptable for rows that pre-date Sheets tracking).

## 8. Notes on the __migration_system__ User

The migration script seeds a special user `__migration_system__` in the `users` table.
This user:

- Is used as `created_by` for the `default` household seed
- Has `username = '__migration_system__'` (satisfies the `users_has_identity` CHECK constraint)
- Has `password_hash = NULL` and `google_sub = NULL` — cannot log in
- Is idempotent: re-running the migration will not create a duplicate

This user should remain in the database permanently. It is a sentinel that allows the
migration to be re-run safely without needing a real user account.

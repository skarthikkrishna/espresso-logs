# Decision Drop — Priya routing assessment
# 2026-05-15 — Hardware maintenance display + Brew log internal IDs

**Agent:** Priya (Product Manager)
**Date:** 2026-05-15
**Scope:** Bugs reported post-Postgres-migration

---

## Bugs assessed

### Bug 1 — Hardware view does not show maintenance logs

**Status: DIRECT_PERMITTED**

**Symptom:** Hardware detail panel always shows "No maintenance records." regardless of whether events
exist in Google Sheets.

**Root cause (confirmed by source inspection):**

The `maintenance_log` table has a `sheets_hardware_id TEXT` column added by migration 0005
(2026-05-14). That migration adds the column with no backfill SQL. Before 0005 was applied to
production, `SqlMaintenanceRepo.add()` tried to insert rows with `sheets_hardware_id` into a table
that didn't have that column yet. SQLAlchemy raised a DB error. `_DualWriteMaintenanceRepo.add()`
silently catches all SQL exceptions and continues. Result: every maintenance event written during
the period when 0005 was un-applied was accepted by Sheets but **rejected from Postgres without
surfacing an error to the caller**. The data exists in Sheets; it does not exist in Postgres.

After migration 0005 was applied (via `alembic upgrade head` in the PR #73 session), the column
now exists but there is no Postgres data to filter by. `SqlMaintenanceRepo.list(hardware_id=...)`
executes `WHERE sheets_hardware_id = ?` and returns an empty result. The frontend renders
"No maintenance records."

Additionally: `MaintenanceLog.hardware_id` (UUID FK → `hardware.id`) is never populated by
`SqlMaintenanceRepo.add()`. There is therefore no UUID-based join path that could be used for a
pure-SQL backfill. The data must be re-read from Sheets.

**Fix scope (bounded, no product decisions needed):**
1. Add a `SqlMaintenanceRepo.upsert()` method that inserts or updates by `sheets_id` (unique
   constraint exists) — prevents duplicate rows during backfill.
2. Add a startup backfill hook (or `POST /api/admin/resync-maintenance` endpoint) that reads all
   maintenance events from the Sheets-backed `MaintenanceRepo`, then calls
   `SqlMaintenanceRepo.upsert()` for each row. This populates `sheets_hardware_id` from
   `row["Hardware_ID"]`.
3. No schema migration needed (column already exists after 0005).
4. No frontend changes (frontend code is correct; it correctly renders `detail.maintenance`).

---

### Bug 2 — Brew Log and home page show internal Bag_IDs instead of bean/catalog names

**Status: DIRECT_PERMITTED**

**Symptom:** Brew log list and detail views display raw IDs like `Ve20250201M` instead of
"Roaster — Bean name".

**Root cause (confirmed by source inspection):**

`_resolve_names_from_dicts()` in `app/routers/api_brew_log.py` resolves bean display names by:

```
shot["Bag_ID"] → bags[bag_id]["Catalog_ID"] → catalog[catalog_id]["Roaster"] + ["Bean_Name"]
```

When `use_postgres=True`, `bags` is populated from `SqlInventoryRepo.list_all()` which returns
`"Catalog_ID": row.sheets_catalog_id or ""`.

`sheets_catalog_id` was added to `inventory_bags` by migration 0006 (2026-05-15). That migration
adds the column with no backfill. Before 0006 was applied, `SqlInventoryRepo.upsert()` tried to
set `existing.sheets_catalog_id` — a column that didn't exist in the DB yet — and received a DB
error that was silently caught by `_DualWriteInventoryRepo`. Inventory bags may exist in Postgres
(written before the `sheets_catalog_id` attribute was added to the ORM model), but those rows
have `sheets_catalog_id = NULL`.

Result: `bag_row.get("Catalog_ID", "")` returns `""` for all existing bags →
`catalog.get("", {})` returns `{}` → neither `Roaster` nor `Bean_Name` is resolved →
`bag_display` falls back to `bag_id` (the internal Sheets composite key like `Ve20250201M`).

This is a V1 core functional requirement violation (spec §9.2: "List view: frosted-glass cards;
date, **bean name**, roast level…"; §9.7: "no internal IDs in UI").

**Relationship to PR #73:** PR #73 fixes the migration pipeline (cloudbuild.yaml) and the
`DATABASE_URL` injection gap. Migration 0006 was applied manually to production during that
session. However, PR #73 does **not** backfill existing `inventory_bags` rows. All rows written
before 0006 was applied still have `sheets_catalog_id = NULL`. This bug is NOT fixed by PR #73
merging — it requires a separate backfill.

**Fix scope (bounded, no product decisions needed):**
1. A Sheets→Postgres backfill for existing `inventory_bags` rows: read all bags from
   `InventoryRepo` (Sheets-backed), call `SqlInventoryRepo.upsert(row)` for each. Since
   `upsert()` already handles INSERT vs UPDATE by `sheets_id`, and the column now exists, this
   will set `sheets_catalog_id = row["Catalog_ID"]` for all existing rows.
2. Implement as a startup backfill hook (idempotent: `WHERE sheets_catalog_id IS NULL`) or as an
   admin endpoint `POST /api/admin/resync-inventory`.
3. No schema migration needed (0006 already added the column and was applied to production).
4. No frontend changes (frontend correctly uses `entry.bag_display`).

---

## Combined routing verdict

| Bug | Status | Rationale |
|-----|--------|-----------|
| Hardware maintenance not displayed | DIRECT_PERMITTED | Pure data backfill regression. No product decisions. Backend only. |
| Brew log shows internal IDs | DIRECT_PERMITTED | Pure data backfill regression. V1 spec violation but fix is a Sheets→Postgres re-sync. No product decisions. Backend only. |

**Both bugs can be addressed on a single new branch off `main`.**
Branch name suggestion: `fix/postgres-backfill-maintenance-catalog`

**Relationship to open work:**
- PR #73 (`hotfix/beans-catalog-brew-log`): Addresses configuration and CI gaps. Not overlapping.
  Both PRs can coexist; this new work is complementary. However, PR #73 should merge first (or
  this branch should be based on PR #73's branch) since PR #73 includes the `cloudbuild.yaml`
  migration step that ensures this doesn't regress on future deploys.
- No SpecKit artifacts required. No Quinn gate required (no new user-facing behaviour; pure
  regression fix restoring V1 spec compliance).

**Implementation note for Alex:**
Both fixes follow the same pattern — a startup idempotent backfill via the DualWrite repos.
Consider a single `_backfill_postgres_from_sheets()` coroutine (or equivalent) called from
`app/main.py` `lifespan()` when `USE_POSTGRES=True`, covering both entities. Guard with
`WHERE sheets_catalog_id IS NULL` / `WHERE sheets_hardware_id IS NULL` so subsequent deploys
are no-ops.

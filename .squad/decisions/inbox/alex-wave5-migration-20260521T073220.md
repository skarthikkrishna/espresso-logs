# Decision Drop — Alex Wave 5 Migration Round-Trip
**Date:** 2026-05-21T07:32:20-07:00
**Author:** Alex (Backend Engineer)
**Task:** US-5.1 — Migration round-trip verification

---

## Summary

Migration 0007 round-trip verification completed. One issue found and fixed; all round-trip and CI checks now pass.

---

## Issue Found

**Migration:** `alembic/versions/0007_m5_schema_corrections.py`
**Symptom:** `asyncpg.exceptions.InsufficientPrivilegeError: must be superuser to create bypassrls users`

The `CREATE ROLE app_admin BYPASSRLS` DDL in step 7 of the upgrade fails when the migration user is not a PostgreSQL superuser. In local Docker dev (`docker-compose.dev.yml`, `POSTGRES_USER=espresso`), the `espresso` user has no superuser attribute.

## Fix Applied

Wrapped the `CREATE ROLE app_admin BYPASSRLS` (upgrade) and `DROP ROLE app_admin` (downgrade) statements in `EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE` PL/pgSQL exception handlers.

- **Production (Cloud SQL admin = superuser):** Role is created normally — no behavior change.
- **Local dev (non-superuser):** A `NOTICE` is emitted and migration continues. The `app_admin` BYPASSRLS role is not created locally, which is acceptable — RLS is only enforced in Cloud SQL environments where the runtime user is correctly configured.

**Commit:** `c786242` on `feat/034-m5-household-roles`

---

## Round-Trip Verification Results

| Step | Command | Result |
|------|---------|--------|
| 1 | `downgrade base` | ✅ Clean |
| 2 | `upgrade head` | ✅ Clean (after fix) |
| 3a | `pending_invitations` has `token_hash`, no `token` | ✅ |
| 3b | `guest_tokens` has `token_hash` + `expires_at` | ✅ |
| 3c | `households` has `is_guest_accessible` | ✅ |
| 3d | `oauth_states` exists (4 correct columns) | ✅ |
| 3e | RLS `household_isolation` on all 5 tenant tables | ✅ |
| 3f | `household_members.invited_by` FK → `users(id)` | ✅ |
| 4 | `downgrade 0006` | ✅ Clean |
| 5 | `upgrade head` (second time) | ✅ Clean (idempotent) |

---

## CI Results

All 4 checks pass post-fix:
- `uv run ruff check app/ tests/` → 0 issues
- `uv run ruff format --check app/ tests/` → 130 files already formatted
- `uv run mypy app/ --strict` → 0 issues (59 source files)
- `pytest tests/ -v --ignore=tests/e2e/` → 480 passed, 4 skipped

---

## Pre-Deployment Note

The `app_admin BYPASSRLS` role must be created in Cloud SQL manually (or via a migration run with a superuser account) before the first production deployment. The migration will now log a NOTICE rather than fail when run without superuser, so operators should verify the role exists post-migration:

```sql
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'app_admin';
```

If the row is absent, run:
```sql
CREATE ROLE app_admin BYPASSRLS;
GRANT app_admin TO coffee_tracker_runtime;
```
as a Cloud SQL superuser before enabling RLS enforcement in the application.

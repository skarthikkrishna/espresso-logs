# Routing Decision — Dual-Write sql=None Regression in app/deps.py

**Date:** 2026-05-23  
**Agent:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Request:** Fix a regression where `_DualWriteRepo` wrappers in `app/deps.py` silently no-op writes when `sql is None`, leading to `POST /api/catalog` returning `201` while a subsequent `GET /api/catalog/CAT100` returns `404`.

---

## Decision

**status: DIRECT_PERMITTED**

---

## Rationale

This is a bounded backend bug fix in existing dependency wiring and dual-write wrapper behavior. The defect is localized to `app/deps.py`: multiple dual-write write methods (`_DualWriteCatalogRepo.upsert`, `_DualWriteBrewLogRepo.add`, `_DualWriteInventoryRepo.upsert`, `_DualWriteHardwareRepo.upsert`, `_DualWriteMaintenanceRepo.add`) immediately return when `sql is None`, which turns writes into silent no-ops instead of falling back to the Sheets-backed repo.

The failure mode is already visible in the existing backend flow:
- `app/routers/api_catalog.py` writes via `await catalog_repo.upsert(row)` in `POST /api/catalog`.
- `app/routers/api_catalog.py` reads via `await catalog_repo.get(catalog_id)` in `GET /api/catalog/{catalog_id}`.
- In `app/deps.py`, reads already fall back to Sheets when `sql is None`, but writes currently do not.
- Existing tests also show the scope is contained to backend wrapper behavior: `tests/repos/test_sql_repos_read.py` covers read fallback, while `tests/test_dual_write_disabled.py` currently encodes the write-no-op behavior that produced this regression.

No new product behavior, schema change, migration, API contract, frontend work, or e2e test changes are required. The fix is to restore correct fallback semantics for existing write paths when SQL is unavailable, plus update/add targeted backend tests to cover the regression.

---

## Scope Confirmation

**Explicitly in scope:**
- `app/deps.py` dual-write wrapper write methods and closely related dependency wiring
- Targeted backend tests covering dual-write fallback and the catalog create/detail regression path
- Updating incorrect unit tests that currently assert write suppression when `sql is None`

**Explicitly out of scope:**
- Frontend code
- Schema/models/migrations
- New endpoints or auth changes
- E2E test edits
- Broad refactors outside dual-write dependency behavior

---

## Evidence Read

- `app/deps.py`
- `app/routers/api_catalog.py`
- `tests/repos/sql/test_dual_write.py`
- `tests/repos/test_sql_repos_read.py`
- `tests/test_dual_write_disabled.py`
- `tests/test_api.py`

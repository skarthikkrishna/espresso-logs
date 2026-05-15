# Decision Drop — Quinn: M4 Issue Fixes #64 and #69

**Agent:** Quinn (QA Engineer)
**Date:** 2026-05-15T12:19:02.047-07:00
**Branch:** feat/m4-prerequisites
**Issues addressed:** #64, #69

---

## What was done

### Issue #64 — Write-then-read integration tests for Postgres read path

Added to `tests/repos/sql/test_brew_log.py`:
- `test_add_then_list_returns_row` — inserts via `add()`, asserts row appears in `list()` with correct field values
- `test_add_then_get_returns_row` — inserts via `add()`, asserts row retrievable via `get()` with correct fields

Added to `tests/repos/sql/test_catalog.py`:
- `test_upsert_then_list_returns_row` — inserts via `upsert()`, asserts row appears in `list()` with correct fields
- `test_upsert_then_get_returns_row` — inserts via `upsert()`, asserts row retrievable via `get()`

### Issue #69 — Happy-path tests for all 5 SQL repos

Added `test_list_returns_inserted_row` and `test_get_returns_inserted_row` to all 5 SQL repo test files:
- `tests/repos/sql/test_brew_log.py` ✓ (additional tests beyond #64 with different assertion emphasis)
- `tests/repos/sql/test_catalog.py` ✓ (additional tests beyond #64)
- `tests/repos/sql/test_hardware.py` ✓
- `tests/repos/sql/test_inventory.py` ✓
- `tests/repos/sql/test_maintenance.py` ✓

### Quinn gate note — `test_hardware_next_id_still_uses_sheets_when_use_postgres_true`

**Already present.** Alex added this test during the M4 CI fix cycle. It lives in `TestDualWriteHardwareRepoReads` in `tests/repos/test_sql_repos_read.py` and uses the `settings_use_postgres` fixture. All 28 mock-based read path tests pass. No duplicate added.

---

## Verification

- `uv run ruff check tests/repos/sql/ tests/repos/test_sql_repos_read.py` — all checks passed
- `SPREADSHEET_ID=dummy uv run pytest tests/repos/test_sql_repos_read.py -v` — 28/28 passed
- SQL integration tests (`tests/repos/sql/`) require `DATABASE_URL` (CI Postgres container) — auto-skip locally

---

## Staged files

- `tests/repos/sql/test_brew_log.py`
- `tests/repos/sql/test_catalog.py`
- `tests/repos/sql/test_hardware.py`
- `tests/repos/sql/test_inventory.py`
- `tests/repos/sql/test_maintenance.py`

Coordinator to commit when CI verification is complete.

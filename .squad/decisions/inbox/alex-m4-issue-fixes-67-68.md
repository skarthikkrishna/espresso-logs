# Decision Drop — Alex — Issues #67 and #68

**Date:** 2026-05-15  
**Branch:** feat/m4-prerequisites  
**Author:** Alex (Backend Engineer)

---

## Issue #67 — `_DualWriteBrewLogRepo.update_feedback` async + SQL dual-write

**Decision:** `update_feedback` in `_DualWriteBrewLogRepo` (app/deps.py) converted from `def` to `async def`. SQL dual-write block added following the same try/except pattern as `add()` — writes to Sheets first, then to Postgres if `self._sql is not None and settings.use_postgres`, rolls back and logs a warning on failure. `inference.py` updated to `await` the call.

**Rationale:** The sync method silently dropped Postgres writes whenever `USE_POSTGRES=True`. AI feedback is user-visible data; losing it to the SQL layer without any error or warning is a silent data loss bug.

---

## Issue #68 — `Mapped[sa.DateTime]` / `Mapped[sa.Date]` wrong type annotations

**Decision:** All ORM model files (`brew_log.py`, `inventory.py`, `catalog.py`, `hardware.py`, `maintenance.py`, `user.py`, `auth.py`, `household.py`) updated to use Python stdlib types `datetime.datetime` and `datetime.date` inside `Mapped[...]`. The SQLAlchemy column type (`sa.TIMESTAMP(timezone=True)`, `sa.Date`) remains in the `mapped_column(...)` call where it belongs. `import datetime` added to each model file.

`cast()` call-site workarounds removed from `SqlBrewLogRepo._to_dict`, `SqlInventoryRepo._to_dict`, and `SqlMaintenanceRepo._to_dict`. Unused `cast` and `dt` imports removed from those files.

**Rationale:** `Mapped[sa.DateTime]` is semantically incorrect — `Mapped[T]` expects a Python type, not an SA type descriptor. The `cast()` workarounds in `_to_dict` existed only to silence mypy; they are unnecessary once the model annotations are correct, and are misleading to readers.

---

## Verification

- `uv run ruff check app/ tests/` — 0 issues
- `SPREADSHEET_ID=dummy uv run pytest tests/ --ignore=tests/e2e/ -q` — 400 passed, 4 skipped

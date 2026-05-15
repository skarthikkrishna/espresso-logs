# Routing Decision: CI Fix Verification — commit b5a5bff

**Agent:** Alex (Backend Engineer — Routing Agent)
**Timestamp:** 2026-05-14T23:12:23
**Request:** Verify that CI fixes in commit `b5a5bff` on branch `feat/m4-prerequisites` are correct.

---

## Status

```
status: DIRECT_PERMITTED
rationale: This is bounded verification of an already-committed CI fix — no new feature scope, no architectural decisions, no new design. All 4 phases of the commit address mechanical CI compliance (mypy strict, pytest async, ruff format). Verification requires running existing CI checks locally and confirming all 3 root causes from the RCA are resolved.
scope: Verify commit b5a5bff on feat/m4-prerequisites passes: (1) ruff format on 5 files, (2) mypy --strict on app/ — zero errors, (3) SPREADSHEET_ID=dummy pytest tests/ -v on 16 previously-failing SQL tests. No code changes required if checks pass; targeted fixes permitted only for any residual failures found.
```

---

## Diff Analysis (b5a5bff)

The diff was read in full. All 4 phases are mechanical CI compliance fixes:

### Phase 1 — SQLAlchemy DateTime casts (mypy strict)
- `app/repos/sql/brew_log.py`: `cast(dt, row.brewed_at).date().isoformat()` — correct; satisfies mypy for SQLAlchemy `DateTime` column returning `Any` at runtime.
- `app/repos/sql/inventory.py`: `cast(datetime.date, row.roast_date).isoformat()` + `# type: ignore[assignment]` for `_to_date()` return — correct approach.
- `app/repos/sql/maintenance.py`: `cast(dt, row.performed_at).date().isoformat()` — correct.

### Phase 2 — Type annotation swaps (mypy strict)
- 5 routers (`api_brew_log`, `api_catalog`, `api_hardware`, `api_inventory`, `api_maintenance`, `defaults`) and 2 services (`defaults.py`, `inference.py`) swapped from concrete Sheets repo classes to `_DualWriteBrewLogRepo` / `_DualWriteCatalogRepo` etc. (exported from `app.deps`).
- `app/services/defaults.py` and `app/services/inference.py` use `TYPE_CHECKING` guard + string annotations — correct pattern to avoid circular imports.
- Residual `# type: ignore[misc, func-returns-value]` suppressor comments were also removed, which is correct since the underlying issue (wrong type annotation) is now fixed.

### Phase 3 — Async test corrections (pytest)
- 5 test files (`tests/repos/sql/test_*.py`) updated: `repo.list()` / `repo.get()` → `await repo.list()` / `await repo.get()`.
- Docstrings updated from M2 stub descriptions to accurate async DB descriptions.
- These tests are `async def` functions in a `pytest-asyncio` auto-mode suite — `await` is required.

### Phase 4 — ruff format
- Long lines reformatted in `app/models/brew_log.py`, `app/repos/sql/brew_log.py`, `app/repos/sql/hardware.py`, `tests/test_inference.py`.
- `app/repos/sql/catalog.py`: `list` → `builtins.list` (consistent with other sql repos).

### Assessment
All 4 phases are correct, targeted, and address the 3 root causes from the RCA. No logic changes. No new features. No scope expansion. Implementation is self-contained.

---

## Next Step

Coordinator should proceed to **STEP 3 — Direct Implementation**: run CI checks locally on `feat/m4-prerequisites` to confirm all 3 root causes are resolved. If any check fails, Quinn-gate and targeted fix may follow — but no SpecKit cycle is warranted for residual mechanical fixes of this nature.

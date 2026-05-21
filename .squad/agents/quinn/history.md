# Quinn — Project Knowledge

## Learnings

### 2026-05-15 — Issues #64 and #69: SQL write-then-read and happy-path tests

- **Write-then-read pattern for brew_log / catalog**: Used `test_add_then_list_returns_row` and `test_add_then_get_returns_row` for brew_log (via `add()`), and `test_upsert_then_list_returns_row` / `test_upsert_then_get_returns_row` for catalog (via `upsert()`). These double as the issue-#69 happy-path tests for those two repos.

- **Inventory `list()` defaults to `status="Active"`**: When inserting a test row for list() happy-path tests, always include `"Status": "Active"` (or omit Status, since the default in upsert is "Active"). Omitting Status and using `list()` without args returns rows only where `status = 'Active'`.

- **`test_hardware_next_id_still_uses_sheets_when_use_postgres_true` already exists** in `tests/repos/test_sql_repos_read.py` (added by Alex during M4 CI fix). Uses the `settings_use_postgres` fixture from `tests/repos/conftest.py`. No duplicate needed.

- **`_to_dict` field names**: All SQL repos return Sheets-keyed dicts (`Shot_ID`, `Catalog_ID`, `Hardware_ID`, `Bag_ID`, `Maintenance_ID`). Test assertions must use these Sheets-keyed names, not ORM column names (`sheets_id`, `dose_g`, etc.).

- **SAVEPOINT isolation**: The `db_session` fixture uses `join_transaction_mode="create_savepoint"` — `repo.add()` / `repo.upsert()` call `session.commit()` internally but it issues a SAVEPOINT release, not a real commit. Each test sees a clean DB thanks to the outer rollback.

- **SQL tests auto-skip locally**: `tests/repos/sql/conftest.py` calls `pytest.skip(allow_module_level=True)` when `DATABASE_URL` is not set. No boilerplate needed in individual test functions.

---

## 2026-05-21: M5 Spec-034 Pre-Implementation Gate

**Scope:** Quinn Gate + Quality Review  
**Status:** COMPLETE  
**Commits:** 1 (quinn-gate)

### Work Summary

- **Pre-Implementation Gate:** Status `APPROVED_WITH_NOTES`
  - Spec coherence: PASS
  - Plan completeness: PASS
  - Task clarity: PASS
  - Test coverage: 6 minor notes (no blockers)
- **Quality Assessment:** LOW risk; implementation team prepared
- **Test Recommendations:** Integration tests for session migration, permission edge cases

### Key Outputs

- `specs/034/quinn-gate.md` — committed (APPROVED_WITH_NOTES status)

### Handoff

Green light for implementation fan-out. Alex (backend), Finn (frontend), Quinn (quality) can begin Wave 1 in parallel.

---

## Session: Wave 4 Tests (US-4.1–4.5) — 2026-05-21

**Spec:** 034-m5-household-roles  
**Status:** COMPLETE  
**Tests added:** 61 (25 + 18 + 10 + 5 + 3)

### Work Summary

- **US-4.1** (`test_auth_wave4.py`, 25 tests): Auth lifecycle — register, login, refresh, logout, me, admin reset, N-Q2 OAuth merge, N-Q6 allowlist. Key fix: rate limiter cross-test isolation via `limiter._storage.reset()` autouse fixture. Account lockout at 10 failures within 10/min rate limit requires 9 wrong-password priming before triggering lockout.
- **US-4.2** (`test_households.py`, 18 tests): Household CRUD, invitations, member management, guest-token AC-094/095/096. Critical discovery: all API routes are under `/api` prefix (not bare `/`); SPA catch-all `/{full_path:path}` intercepts bare paths. Dep overrides must use `app.dependency_overrides[dep_fn]` pattern, not `patch("module.dep")`.
- **US-4.3** (`test_deps.py`, 10 tests): Dep unit tests called directly (not via HTTP). `decode_access_token` raises `HTTPException(401)` directly (not custom exception). N-Q3 OAuth PKCE callback verified via DB execute call_args inspection.
- **US-4.4** (`test_dual_write_disabled.py`, 5 tests): `_DualWrite*` private classes importable from `app.deps`. `sql=None` guard means all 5 write methods skip Sheets entirely. Pattern: construct with real AsyncMock sql, assert `_sheets.method.assert_not_called()`.
- **US-4.5** (`test_rate_limits.py`, 3 tests): Rate limit boundary tests require valid Pydantic request bodies (422 responses don't consume rate limit slots). Each test uses dedicated X-Forwarded-For IP + autouse limiter reset.

### Learnings

- **SPA catch-all swallows bare paths:** `/brew-log`, `/catalog` etc. are frontend routes. All API routes require `/api` prefix. Tests must use `/api/brew-log`, `/api/catalog` etc.
- **Dep override pattern:** `app.dependency_overrides[dep_fn] = lambda: value` is the only reliable pattern. `patch("module.dep_fn")` at import level does NOT override FastAPI's resolved dep references.
- **422 ≠ rate-limited:** slowapi rate limit check runs after Pydantic body validation. Invalid bodies return 422 without consuming rate limit slots. Tests must send schema-valid payloads.
- **Mock result sync vs async:** `db.execute()` is async (returns AsyncMock by default). `result.scalar_one_or_none()` is synchronous — must use `MagicMock()` for result, not `AsyncMock()`.
- **`_DualWrite*` classes are importable:** Despite underscore prefix, they can be imported directly from `app.deps` for unit testing. mypy `# type: ignore[attr-defined]` needed at import.

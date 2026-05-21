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

---

## Wave 5 — US-5.2 Integration Tests

**Spec:** 034-m5-household-roles  
**Status:** COMPLETE  
**Tests added:** 4 integration tests (`tests/test_integration.py`)

### Work Summary

- **US-5.2** (`test_integration.py`, 4 tests): Real-Postgres integration suite.
  - `test_register_login_refresh_logout_full_cycle` (AC-088): Full auth lifecycle against real DB + real JWT validation.
  - `test_brew_log_scoped_to_household` (AC-097): RLS isolation via `FORCE ROW LEVEL SECURITY` (espresso owner bypasses RLS by default).
  - `test_delete_brew_log_requires_admin` (AC-103): `DELETE /api/brew-log/{shot_id}` — 403 for members, 204 for admins.
  - `test_seed_orphan_rows_on_first_login` (AC-090–092): Orphan row seeding on first register + idempotency on second login.
- **Bug fix:** `DELETE /api/brew-log/{shot_id}` endpoint was missing entirely. Added `SqlBrewLogRepo.delete_by_shot_id`, `_DualWriteBrewLogRepo.delete_by_shot_id`, and route in `api_brew_log.py`.
- **Bug fix (asyncpg):** `SET LOCAL app.current_household_id = :hid` fails with asyncpg because `SET LOCAL` doesn't support bound parameter syntax (`$1`). Fixed in `current_household_membership` and `resolve_guest_or_member` by replacing with `SELECT set_config('app.current_household_id', :hid, true)`.

### Learnings

- **`SET LOCAL` + asyncpg:** `SET LOCAL setting = :param` fails with asyncpg (`syntax error at or near "$1"`). `SET` commands don't accept parameterized values in Postgres. Use `SELECT set_config('setting', :param, true)` — same effect (transaction-scoped), supports bound params.
- **FORCE ROW LEVEL SECURITY for owner:** Table owners bypass RLS by default. For integration tests proving household isolation, temporarily enable `FORCE ROW LEVEL SECURITY` on the table and disable in `finally`. In production (Cloud SQL with a non-owner app user), RLS applies automatically.
- **set_config() third arg:** `set_config(name, value, is_local)` — `is_local = true` is equivalent to `SET LOCAL` (transaction-scoped). `is_local = false` is equivalent to `SET` (session-scoped).
- **Same-second JWT tokens:** `create_access_token` uses `int(now.timestamp())` — two calls within the same second produce identical tokens. Don't assert `new_token != old_token` in tests; assert the refresh cookie was rotated instead.
- **Integration test autouse override pattern:** `integration_client` fixture pops autouse auth dep overrides (from conftest `_patch_auth_deps`) and restores them in teardown. This lets the full JWT → DB auth chain run for integration tests while keeping unit tests isolated.

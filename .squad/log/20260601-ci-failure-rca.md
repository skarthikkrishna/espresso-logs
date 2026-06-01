# CI failure root cause analysis — PR #80 (`feat/034-m5-household-roles`)

- Date: 2026-06-01
- PR: `#80`
- Run: `26736087268`
- Scope: diagnosis only; no fixes applied
- Source log command: `gh run view 26736087268 --log-failed 2>&1`

## Overall assessment
This is **not** a schema-migration mismatch failure. The `test` job failures all share the same async event-loop/runtime error before any schema-specific assertion executes. In parallel, CI is independently blocked by:

1. a dependency vulnerability (`starlette 1.0.0`)
2. a committed secret-shaped test literal caught by Gitleaks in three places
3. a dynamic SQL pattern in `app/repos/sql/household.py` rejected by both Bandit and Semgrep

## Failed jobs

### 1) `CI/test`
**Root cause**
The SQL repo tests are running with an async fixture/plugin combination that creates an **event-loop mismatch**. CI is failing during `await db.flush()` in `UserRepo.create(...)`, with asyncpg reporting a future attached to a different loop.

**Exact error**
- `RuntimeError: Task <Task pending ...> got Future <Future pending cb=[BaseProtocol._on_waiter_completed()]> attached to a different loop`
- `asyncpg/protocol/protocol.pyx:369: RuntimeError`

**Representative failing tests from the CI log**
- `tests/repos/sql/test_household_repo.py::test_create_household_creates_admin_member` → failure at `tests/repos/sql/test_household_repo.py:37`
- `tests/repos/sql/test_household_repo.py::test_count_admins` → `:49`
- `tests/repos/sql/test_household_repo.py::test_update_member_role_prevents_demoting_sole_admin` → `:64`
- `tests/repos/sql/test_household_repo.py::test_remove_member_prevents_removing_sole_admin` → `:82`
- `tests/repos/sql/test_refresh_token_repo.py::test_create_and_get_refresh_token` → `:40`
- `tests/repos/sql/test_refresh_token_repo.py::test_rotate_revokes_single_valid_token_atomically` → `:62`
- `tests/repos/sql/test_refresh_token_repo.py::test_revoke_single_token` → `:90`
- `tests/repos/sql/test_refresh_token_repo.py::test_revoke_all_for_user_nukes_all_active_tokens` → `:113`
- `tests/repos/sql/test_user_repo.py::test_create_user_with_username` → `:18`
- `tests/repos/sql/test_user_repo.py::test_get_by_username_case_insensitive` → `:38`
- `tests/repos/sql/test_user_repo.py::test_increment_login_attempts_sets_locked_until_at_10` → `:59`
- `tests/repos/sql/test_user_repo.py::test_reset_login_state_clears_attempts_and_lock` → `:85`

**Count**
- `15` failures in `tests/repos/sql/test_household_repo.py`
- `4` failures in `tests/repos/sql/test_refresh_token_repo.py`
- `4` failures in `tests/repos/sql/test_user_repo.py`
- CI summary: `23 failed, 599 passed, 12 skipped`

**Evidence in repo**
- `tests/repos/sql/conftest.py:50-82` defines async engine/session fixtures with transaction + savepoint handling
- `tests/repos/sql/conftest.py:50-52` sets `anyio_backend = "asyncio"`
- `tests/repos/sql/test_household_repo.py:35`, `tests/repos/sql/test_refresh_token_repo.py:38`, `tests/repos/sql/test_user_repo.py:15` mark tests with `@pytest.mark.anyio`
- `pyproject.toml:44-45` enables `pytest-asyncio` auto mode

**Diagnosis**
The failure signature points to **test harness/runtime configuration**, not schema state:
- every failure happens at the initial insert/flush path through `app/repos/sql/user.py:52`
- the exception is a loop-affinity error from asyncpg, not `UndefinedTable`, missing column, or migration DDL failure
- the repo mixes `@pytest.mark.anyio` tests with `pytest-asyncio` auto mode, while also using async SQLAlchemy fixtures and asyncpg savepoints

**Recommended fix**
Standardize on one async test runner model for these SQL tests. Most likely fixes are:
- remove `@pytest.mark.anyio` from these repo tests and run them under `pytest-asyncio` only, **or**
- disable `pytest-asyncio` auto mode for this suite and keep `anyio`, **or**
- otherwise ensure engine/session fixtures and tests are guaranteed to run on the same loop

Do **not** chase schema/migration fixes first; the CI evidence does not support that as the primary failure.

---

### 2) `CI/dependencies`
**Root cause**
Dependency audit is failing because CI resolves a vulnerable Starlette version.

**Exact finding**
- Command: `uv run pip-audit --ignore-vuln PYSEC-2025-185`
- Output:
  - `Found 1 known vulnerability in 1 package`
  - `starlette 1.0.0   PYSEC-2026-161 1.0.1`

**File / package**
- Resolved dependency: `starlette==1.0.0`

**Diagnosis**
This is a real dependency-audit failure. The only ignored advisory in CI is `PYSEC-2025-185`; `PYSEC-2026-161` is still actionable.

**Recommended fix**
Update the dependency graph so CI installs `starlette>=1.0.1` (either by bumping a direct pin or by updating the parent dependency that resolves Starlette), then refresh the lockfile.

---

### 3) `CI/gitleaks`
**Root cause**
Gitleaks detected a committed JWT secret-like literal and classified it as `generic-api-key` in three places in the scanned commit range.

**Exact findings from CI log**
1. `tests/test_integration.py:17`
   - Finding: `JWT_SECRET=REDACTED`
   - Rule: `generic-api-key`
   - Commit: `7d68b7d88ca00c424d138c4f97e316bc17516abe`
2. `.squad/agents/alex/history.md:148`
   - Finding contains the same `JWT_SECRET=REDACTED` literal in agent history
   - Rule: `generic-api-key`
   - Commit: `e94502b9bbaf3dbb8fd40cbced0e5f562199ae5d`
3. `tests/conftest.py:13`
   - Finding: `os.environ.setdefault("JWT_SECRET", "REDACTED")`
   - Rule: `generic-api-key`
   - Commit: `45469824f19119f9dcda663a914be39cf260faf2`

**Current repo context**
- `tests/conftest.py:13-14` contains a fixed 32-character test secret literal
- `tests/test_integration.py:15-18` includes the same literal in a documented run command
- Historical commit `e94502b9...` stored the same literal in `.squad/agents/alex/history.md`

**Diagnosis**
This is a **secret-scanning policy failure**, not a false schema/test failure. Even though the value is test-only, it is secret-shaped and committed in tracked content and commit history, so Gitleaks blocks the PR.

**Recommended fix**
Replace the literal with a non-secret-shaped test value strategy (for example, generate at runtime or inject via CI/env without committing the literal). Also clean any tracked history/artifacts in the PR range that contain the same value, or explicitly ignore the exact known-safe test fixture only if project policy allows that.

---

### 4) `CI/security`
**Root cause**
Bandit rejects dynamic SQL built with an f-string passed into `sqlalchemy.text(...)`.

**Exact finding**
- Tool: Bandit
- Rule: `B608:hardcoded_sql_expressions`
- Severity: `Medium`
- Confidence: `Low`
- Location: `app/repos/sql/household.py:496:22`
- Code:
  ```python
  sa.text(
      f"UPDATE {table} SET household_id = :hid WHERE household_id IS NULL"  # noqa: S608
  )
  ```

**Diagnosis**
The inline `# noqa: S608` only suppresses Ruff; it does not suppress Bandit. CI therefore still fails on this pattern.

**Recommended fix**
Refactor this backfill/update path to avoid string-built SQL in `sa.text(...)`. Use SQLAlchemy table objects or a strict whitelist mapped to concrete SQLAlchemy metadata objects so scanners no longer see a raw constructed SQL statement.

---

### 5) `CI/semgrep`
**Root cause**
Semgrep independently blocks the same dynamic SQL pattern that Bandit reports.

**Exact finding**
- Rule: `python.sqlalchemy.security.audit.avoid-sqlalchemy-text.avoid-sqlalchemy-text`
- File: `app/repos/sql/household.py`
- Blocking lines: `495-497`
- Message: `sqlalchemy.text passes the constructed SQL statement to the database mostly unchanged... Use normal SQLAlchemy operators ... to construct SQL.`

**Diagnosis**
This is the same underlying code issue as the Bandit failure, but enforced by a second scanner. Clearing only one scanner would still leave CI red.

**Recommended fix**
Use normal SQLAlchemy expressions / metadata-backed table updates instead of `sqlalchemy.text(f"UPDATE {table} ...")`.

## Bottom line
The PR is blocked by **four distinct root-cause categories**:

1. **Async test harness mismatch** in SQL repo tests (`CI/test`)
2. **Vulnerable dependency** (`CI/dependencies`)
3. **Committed secret-shaped literal** (`CI/gitleaks`)
4. **Dynamic SQL security finding** affecting both `CI/security` and `CI/semgrep`

The evidence supports a **runtime/test configuration issue plus security/dependency policy failures** — not a missing migration or schema drift problem.

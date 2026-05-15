### 2026-05-15: Alex routing decision — M4 issue batch (PR #62 blockers)

**By:** Alex (Backend Engineer)  
**Status:** `status: DIRECT_PERMITTED`

---

## Issue-by-Issue Assessment

| Issue | Title | Scope | Status |
|-------|-------|-------|--------|
| #63 | [M4] Generate alembic migration 0005 for `sheets_hardware_id` column | Already completed; migration exists at `alembic/versions/0005_add_sheets_hardware_id_to_maintenance.py` | ✅ DONE |
| #64 | [M4] Add SQL write-then-read integration test for postgres read path | New test coverage; bounded to `tests/repos/test_sql_repos_read.py`; tests write-then-read cycles for all 5 SQL repos | 📝 DIRECT |
| #66 | [Process] Add pre-push check script | New shell script in `scripts/`; runs `uv run ruff check` + `uv run mypy --strict` before push; catches linting failures locally | 📝 DIRECT |
| #67 | [Bug] `_DualWriteBrewLogRepo.update_feedback` silently drops SQL write when USE_POSTGRES=True | Already fixed in commit 8404a20; properly async with `await self._db.execute()` + `await self._db.commit()` | ✅ DONE |
| #68 | [Debt] Fix `Mapped[sa.DateTime]` / `Mapped[sa.Date]` model annotations — remove cast() workarounds | Refactor 3 call-sites in `app/repos/sql/`: `brew_log.py:105`, `maintenance.py:60`, `inventory.py:96`; remove `cast(dt, ...)` and `cast(datetime.date, ...)` by improving type hints in `_to_dict()` methods | 📝 DIRECT |
| #69 | [Debt] SQL repo happy-path tests missing — list() and get() only cover empty/absent cases | New test coverage; bounded to `tests/repos/test_sql_repos_read.py`; write a record, then read it back, verify all fields | 📝 DIRECT |

---

## Rationale

All six issues are **bounded, self-contained fixes** with no new feature design or API contracts:

1. **Issues #63, #67 (DONE):** Already completed on `feat/m4-prerequisites` branch. Tests pass (400 passed, 4 skipped).

2. **Issues #64, #69 (Test additions):** Add missing test coverage for SQL repos. No new routes, no data model changes. Bounded to existing test infrastructure. Can be implemented directly.

3. **Issue #66 (Pre-push script):** Straightforward shell script in `scripts/pre-push.sh`. Runs `ruff check` + `mypy --strict` before allowing push. No changes to production code. Can be implemented directly.

4. **Issue #68 (Type annotation refactor):** Remove type casts at Sheets serialization call-sites. The underlying issue is that SQLAlchemy `Mapped[sa.DateTime]` and `Mapped[sa.Date]` lack explicit Python type information for `.date()` extraction. Solution: improve type hints in `_to_dict()` methods (e.g., extract to typed intermediate variable before `.date()` call). No API changes. Can be implemented directly.

---

## Explicit Scope Confirmation

- ✅ No new API surface (all are internal repo methods or test coverage)
- ✅ No data model changes beyond existing migrations
- ✅ No architecture decisions needed
- ✅ All fit within Alex's charter: `app/deps.py`, `app/repos/sql/`, `app/models/`, `alembic/versions/`
- ✅ All maintain `mypy --strict` compliance (issue #66 pre-push script ensures this going forward)

---

**Recommendation:** All six issues can proceed directly to implementation. No SpecKit phases required.

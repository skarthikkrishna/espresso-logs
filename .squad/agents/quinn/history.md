# Quinn — Project Knowledge

## Learnings

### 2026-05-15 — Issues #64 and #69: SQL write-then-read and happy-path tests

- **Write-then-read pattern for brew_log / catalog**: Used `test_add_then_list_returns_row` and `test_add_then_get_returns_row` for brew_log (via `add()`), and `test_upsert_then_list_returns_row` / `test_upsert_then_get_returns_row` for catalog (via `upsert()`). These double as the issue-#69 happy-path tests for those two repos.

- **Inventory `list()` defaults to `status="Active"`**: When inserting a test row for list() happy-path tests, always include `"Status": "Active"` (or omit Status, since the default in upsert is "Active"). Omitting Status and using `list()` without args returns rows only where `status = 'Active'`.

- **`test_hardware_next_id_still_uses_sheets_when_use_postgres_true` already exists** in `tests/repos/test_sql_repos_read.py` (added by Alex during M4 CI fix). Uses the `settings_use_postgres` fixture from `tests/repos/conftest.py`. No duplicate needed.

- **`_to_dict` field names**: All SQL repos return Sheets-keyed dicts (`Shot_ID`, `Catalog_ID`, `Hardware_ID`, `Bag_ID`, `Maintenance_ID`). Test assertions must use these Sheets-keyed names, not ORM column names (`sheets_id`, `dose_g`, etc.).

- **SAVEPOINT isolation**: The `db_session` fixture uses `join_transaction_mode="create_savepoint"` — `repo.add()` / `repo.upsert()` call `session.commit()` internally but it issues a SAVEPOINT release, not a real commit. Each test sees a clean DB thanks to the outer rollback.

- **SQL tests auto-skip locally**: `tests/repos/sql/conftest.py` calls `pytest.skip(allow_module_level=True)` when `DATABASE_URL` is not set. No boilerplate needed in individual test functions.

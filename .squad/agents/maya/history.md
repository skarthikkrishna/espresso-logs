# Maya — Project History

## Learnings

### 2026-05-13: CI fix — mypy strict + ruff format (PR #60)

**Branch:** fix/ui-safari-polish  
**Commit:** a0f7f03

**What failed:**
1. `ruff format --check` — `app/deps.py` and `app/main.py` had formatting violations (auto-fixed with `ruff format`)
2. `mypy --strict` — two files had errors:
   - `app/testing/fake_sheets.py`: 8 bare `dict`/`list` generic type annotations missing type arguments; fixed by adding `from typing import Any` and replacing all with `dict[str, Any]` / `list[Any]` / `list[list[Any]]`
   - `app/routers/api_e2e.py:36`: `BaseRepo` lacked a `delete_rows` method; all 5 concrete repos (brew_log, catalog, hardware, inventory, maintenance) already implemented `delete_rows(start_row, end_row)` but the abstract base class was missing it — fixed by adding `@abstractmethod delete_rows(start_row: int, end_row: int) -> None` to `BaseRepo`

**Key pattern:** When a concrete method exists on every subclass but is missing from the ABC, mypy `--strict` surfaces it as `attr-defined` when called through the base type. Always declare such methods on the ABC, not just the concrete subclasses.

**Verification:** `mypy app/ --strict` → 0 errors; `ruff format --check` → 0 violations; 372 tests passed, 4 skipped.

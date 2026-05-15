# Decision: Pre-push check script (Issue #66)

**Date:** 2026-05-15  
**Author:** Tariq  
**Status:** Implemented  

---

## Decision

Created `scripts/pre-push-check.sh` as a portable local CI gate before any push to espresso-logs. The script enforces all four checks from `.github/copilot-instructions.md` in sequential order with immediate exit on first failure.

## Rationale

**One-engineer operability requires automation.** A shared shell script lowers the cognitive load for developers to run checks locally before pushing, reducing wasted CI cycles and feedback loops.

**Early feedback is cheaper than late feedback.** Running all checks locally before push avoids unnecessary GitHub Actions invocations, which consume the weekly budget.

**Clear output is operationally critical.** Developers need to know which check failed and why without diving into CI logs. The `[N/4]` header pattern and explicit error messages satisfy this.

## Implementation

- `scripts/pre-push-check.sh`: Runs ruff check, ruff format, mypy strict, pytest (with SPREADSHEET_ID=dummy)
- `Makefile` target `pre-push`: Calls the script (added with proper help text)
- File is executable (chmod +x) and staged in git
- No secrets or hardcoded paths; uses `uv` directly from PATH
- Works from repo root

## Checks Enforced (in order)

1. `uv run ruff check app/ tests/` — Linter
2. `uv run ruff format --check app/ tests/` — Formatter
3. `uv run mypy app/ --strict` — Type checking
4. `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/` — Tests

Any failure stops the script immediately and reports which step failed.

## Success Criteria

- [x] Script runs all 4 checks in order
- [x] Exits on first failure
- [x] Clear section headers and output messages
- [x] Executable file with proper git mode
- [x] Makefile target added
- [x] No GCP credentials or secrets
- [x] Works from repo root
- [x] Staged, not committed (per git-discipline/SKILL.md)

## Next Steps

Coordinator will commit after CI verification. No further action required from Tariq.

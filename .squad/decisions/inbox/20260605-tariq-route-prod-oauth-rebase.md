# Routing Decision: fix/prod-oauth-callback rebase + gitleaks remediation

**Status:** `DIRECT_PERMITTED`

**Date:** 2026-06-05 21:15 UTC-7  
**Ref:** espresso-logs d7c5c3d6  
**Scope:** Bounded, documentation + dependency integration  

---

## Decision Rationale

**Work is self-contained and mechanical:**
1. **Rebase** `fix/prod-oauth-callback` onto `origin/main` to include 3 merged Dependabot PRs (#90, #91, #92) — dependency updates only, no feature changes.
2. **Fix gitleaks false positives** in `docs/ROTATION_PLAYBOOK.md` (lines 67, 79, 186) — documented placeholder secrets, safe to remediate via documentation edits.
3. **Run existing CI checks** (ruff check/format, mypy --strict, pytest, frontend tests, Playwright).

**Routing criteria met for DIRECT_PERMITTED:**
- ✅ No feature scope, no architecture decisions, no app code changes in this step.
- ✅ Bounded work: documented branch, specific remediation targets, known CI suite.
- ✅ All verification is against existing tooling — no new gates or SpecKit phases required.
- ✅ User has explicitly authorized proceeding: "Go ahead and do it."

---

## Scope Definition (Coordinator → Implementation)

**Do:**
- Rebase `fix/prod-oauth-callback` with `origin/main` to resolve behind/ahead status.
- Edit `docs/ROTATION_PLAYBOOK.md` lines 67, 79, 186: replace placeholder secret examples with safe, non-rotatable equivalents (e.g., `example-`, `demo-`, or documented patterns per security review).
- Run all required CI checks:
  - `ruff check app/ tests/`
  - `ruff format --check app/ tests/`
  - `mypy app/ --strict`
  - `SPREADSHEET_ID=dummy pytest tests/ -v --ignore=tests/e2e/`
  - Frontend and Playwright tests (scope includes frontend + e2e updates).
- **Do NOT push until all checks pass AND operator explicitly approves.**

**Don't:**
- Change app code or architecture.
- Push without operator consent.
- Modify unrelated files.

---

## Next Coordinator Action

Proceed to rebase, gitleaks remediation, and CI validation. 

**Return status:** `DIRECT_PERMITTED`  
**Checkpoint:** All four local CI + frontend/Playwright must pass before requesting push approval.

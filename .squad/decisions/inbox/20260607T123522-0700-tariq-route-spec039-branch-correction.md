# Tariq Routing Decision — Spec-039 Branch Correction

- **Timestamp:** 2026-06-07T12:35:22.603-07:00
- **Actor:** Tariq
- **Request:** Correct the locally validated Spec-039 production-readiness work off `chore/planning-session-hygiene` onto a separate bug-fix branch without pushing, rewriting published history, discarding local commits, or accessing production data/secrets.

## Git State Inspected

- Current branch: `chore/planning-session-hygiene`.
- Local implementation commit present: `21bbef4 fix: complete spec 039 production readiness`.
- `origin/main...HEAD` comparison after fetch: current branch is 63 commits ahead and 2 commits behind `origin/main`.
- `origin/main` contains newer commits not on the current branch: `56f863f fix(037): production shot save/detail hotfix (#105)` and `be7ae04 governance(spec-038): add squad privacy gate and handoff support`.
- Current `HEAD` and its parent are not contained by any remote branch.
- Working tree was clean before this routing-drop file.

## Validation Evidence

Recorded T35 handoff evidence confirms:

- **T32 PASS:** Spec-039 Playwright evidence file completed 6/6 tests.
- **T33 PASS:** Targeted backend regression suite, targeted frontend suite, and Playwright evidence command passed.
- **T34 PASS:** `ruff check`, `ruff format --check`, `mypy --strict`, backend CI test script with local Postgres, frontend lint, full frontend Vitest suite, and frontend build all exited 0.

Conclusion: local tests, unit tests, integration/backend CI tests, frontend tests, build, lint, and Spec-039 Playwright evidence are recorded as passing. No push is authorized by that evidence.

## Decision

status: DIRECT_PERMITTED

Rationale: This is a bounded process/git correction for an already validated local work unit. No product scope or code behavior is being changed by the branch correction itself, and the safe path preserves local commits while avoiding any rewrite or push.

Explicit scope confirmation: coordinator may create a new bug-fix branch and move the existing local validated commit onto it. Coordinator must not push without explicit operator approval, must not rewrite published history, must not discard local commits, and must stop/re-route if cherry-pick conflicts require non-mechanical resolution.

Safe path: create the new branch from `origin/main`, then cherry-pick `21bbef4` and this routing-drop commit. Do **not** create the new bug-fix branch at current `HEAD`, because that would carry 63 commits not in `origin/main` and omit 2 newer `origin/main` commits. Appropriate branch pattern: `fix/spec-039-production-readiness`.

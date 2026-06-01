# Routing Decision — spec-034 M5 Security Remediation

**Agent:** Alex (backend routing)
**Timestamp:** 2026-06-01T05:38:13Z
**Branch:** feat/034-m5-household-roles
**Status:** DIRECT_PERMITTED

---

## Request Summary

Remediate two CI/security scanner findings on the existing `feat/034-m5-household-roles` branch:

1. **Semgrep S608** — `app/repos/sql/household.py` lines 495-497: dynamic SQL table name
   interpolated via an f-string inside `sqlalchemy.text(...)`. The table name comes from a
   closed, hardcoded list `["hardware", "maintenance_log"]` defined in the same function.

2. **Gitleaks** — dummy JWT_SECRET test-fixture literal `abcdefghijklmnopqrstuvwxyz123456`
   appearing in `tests/conftest.py:14` and `tests/test_integration.py:17`. Both are
   intentional, non-sensitive test values.

---

## Routing Decision: DIRECT_PERMITTED

### Rationale

- **No net-new functionality.** Both changes are purely defensive — replacing a safe-but-flagged
  pattern with an equivalent safe pattern, and suppressing false-positive scanner noise on
  known dummy values.

- **Bounded scope.** Affected files:
  - `app/repos/sql/household.py` — allowlist guard replaces f-string interpolation; no
    behaviour change because the allowlist exactly matches the existing hardcoded list.
  - `tests/conftest.py` — inline `# gitleaks:allow` annotation on line 14.
  - `tests/test_integration.py` — inline `# gitleaks:allow` annotation on line 17.

- **No new routes, models, data-access contracts, or API surface.** The household migration
  helper function signature and return type are unchanged.

- **In-branch.** Work stays on `feat/034-m5-household-roles`; no new branch required.

- **SpecKit is not warranted** for security-scanner suppression / safe-equivalent refactors
  on an already-approved and substantially-complete feature branch.

### Explicit Scope Confirmation

The implementer (Quinn) is authorised to make **only** the following changes:

| File | Change |
|---|---|
| `app/repos/sql/household.py` | Replace `sa.text(f"UPDATE {table} ...")` with an allowlist-validated static dispatch (e.g. `if table not in _ALLOWED_TENANT_TABLES: raise ValueError`) so no user-controlled or dynamic string reaches `sqlalchemy.text`. |
| `tests/conftest.py` | Add `# gitleaks:allow` (or equivalent suppression comment) to the `JWT_SECRET` setdefault line. |
| `tests/test_integration.py` | Add `# gitleaks:allow` (or equivalent suppression comment) to the `JWT_SECRET` env-var comment line. |

No other files may be modified under this routing decision.

### Post-change Verification

Before committing, all of the following must pass:

```
uv run ruff check app/ tests/
uv run ruff format --check app/ tests/
uv run mypy app/ --strict
SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/ -k "household"
```

Commit message (pre-approved):
```
fix(security): replace dynamic SQL table interpolation with allowlist in household.py (#034)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

**No push until operator explicitly authorises.**

---

## Quinn Gate

For this narrow security remediation, a full `quinn-gate.md` artifact is **waived** per the
routing agent's explicit statement here. The routing agent (Alex) confirms this is a
documentation-equivalent / scanner-suppression change with no logic delta that would require
a pre-implementation design review.

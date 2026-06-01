# Routing Decision — spec-034 backend gap remediation

**Date:** 2026-05-23T16:02:14Z  
**Agent:** Alex (routing)  
**Branch:** feat/034-m5-household-roles  
**Status:** DIRECT_PERMITTED

---

## Request Summary

Fix the unambiguous HIGH and LOW backend spec deviations from Priya's spec-034 analysis, while explicitly excluding the operator-held architectural decisions:

- active household context mechanism in `app/deps.py`
- first-sign-in onboarding behaviour in `app/routers/api_auth.py`
- household delete semantics
- invitation API route shapes

In-scope requested fixes are:
1. household name max length 64 on create/rename
2. duplicate pending invitation rejection
3. existing-member invitation rejection
4. 10-member household cap on invitation creation
5. per-admin per-household invite rate limit (10 / rolling 24h)
6. UUID v4 invitation token type
7. token acceptance/decline status code audit
8. LOW-1 membership `accepted_at` / `invited_at` only where explicitly required by spec

---

## Routing Assessment

**DIRECT_PERMITTED**

### Rationale

1. **This is implementation reconciliation against already-approved specs, not new product design.** The request points to existing source-of-truth documents and asks for conformance fixes only: `docs/requirements/functional-spec-v2.md:541`, `docs/requirements/functional-spec-v2.md:623`, `docs/requirements/functional-spec-v2.md:654-656`, `docs/requirements/functional-spec-v2.md:564-566`, `docs/requirements/functional-spec-v2.md:1034-1058`, and `docs/requirements/engineering_architecture_v2.md:277-285, 501-503`.

2. **The work is bounded to existing backend surfaces.** The current implementation already lives in the established household model/repo/router layers: `app/models/household.py`, `app/repos/sql/household.py`, `app/routers/api_households.py`, with existing household tests under `tests/test_households.py` and `tests/repos/sql/test_household_repo.py`. This is the correct place to close the gaps without inventing new APIs or workflows.

3. **Architectural/redesign items are explicitly carved out.** The operator has already excluded the ambiguous items that would require broader design decisions (`app/deps.py` active household context, onboarding semantics, delete semantics, route-shape changes). That leaves a self-contained backend compliance pass.

4. **Schema changes, if needed, remain tactical rather than architectural.** A migration may be required for token representation or membership timestamps, but that is still direct implementation because it only aligns existing persistence with explicit spec requirements and does not alter the approved product model.

5. **The scope is strict and execution constraints are already defined.** Branch, source-of-truth docs, excluded areas, commit granularity, CI cadence, and no-push instruction are all explicit. There is no missing product requirement that warrants reopening SpecKit.

---

## Explicit Scope Confirmation

Direct implementation is authorised for this scope only:

- `app/routers/api_households.py`
- `app/repos/sql/household.py`
- `app/models/household.py`
- tightly coupled request/response models or helpers used by the above files
- Alembic migration(s) only if required to align stored invitation/member fields with the spec
- tests covering household creation/rename, invitation creation, invitation acceptance/decline, and related repository behaviour

Implementation must preserve these boundaries:

- **Do not touch** `app/deps.py` active-household-context behaviour
- **Do not touch** first-sign-in onboarding semantics in `app/routers/api_auth.py`
- **Do not change** household delete semantics
- **Do not change** invitation route shapes
- **Do not push**
- keep each fix as a separate commit
- after each fix, run all four required local CI-equivalent checks before starting the next fix

If implementation uncovers a dependency on any excluded architectural item, work must stop and be rerouted instead of widening scope inline.

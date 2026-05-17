---
status: APPROVED_WITH_NOTES
---
# Quinn Gate — Beans/Catalog Hotfix

**Branch:** `hotfix/beans-catalog-brew-log`  
**Reviewed by:** Quinn  
**Date:** 2026-05-15  
**CI result:** All 4 checks pass (ruff check ✅, ruff format ✅, mypy --strict ✅, pytest 403 passed ✅)

---

## Summary

The hotfix correctly addresses all three production bugs. All CI checks green. Approved to merge with notes.

---

## Bug 1 — Cannot add new beans (AddBeanModal 422 crash)

**Root cause:** `POST /api/catalog` and `PUT /api/catalog/{id}` rejected empty-string `roast_level` with 422 because `if body.roast_level not in _ROAST_LEVELS` evaluates `True` for `""` (empty string is not in the valid set). When the LLM infer step fails to determine roast level, `roast_level=""` was sent and the API rejected it — leaving the user unable to save at all.

**Fix correctness:** ✅  
Changed to `if body.roast_level and body.roast_level not in _ROAST_LEVELS` in both `api_catalog_create` (line 214) and `api_catalog_update` (line 294). Empty string now passes validation; non-empty invalid values are still rejected.

**Test coverage:** ✅  
Three regression tests added and passing:
- `test_api_catalog_create_empty_roast_level_accepted` — POST with `roast_level=""` returns 201
- `test_api_catalog_create_invalid_roast_level_rejected` — POST with `roast_level="Bogus"` still returns 422
- `test_api_catalog_update_empty_roast_level_accepted` — PUT with `roast_level=""` returns 200

---

## Bug 2 — Cannot view catalog / add to catalog (frontend error state)

**Fix correctness:** ✅  
`AddBeanModal.tsx` now shows inline field-level validation errors with `touched` state and `fieldErrors` state, preventing a submit against a backend that might return 422. The 422 error handler is also correctly decomposed: string detail → direct message, array detail → extracts `loc[-1]` field names.

---

## Bug 3 — New brew log form shows empty beans dropdown

**Root cause:** `BrewLogAdd.tsx` had no error state handling for the `/api/inventory` query. If the inventory fetch failed (network error or server error), the component returned nothing useful — leaving the beans dropdown empty with no user feedback and no way to recover.

**Fix correctness:** ✅  
`isError: invError, refetch: refetchInventory` added to the `useQuery` destructure. An error card with "Couldn't load your beans" + a Retry button is shown when `invError` is true. The retry calls `refetchInventory()` directly.

---

## Notes / Minor Observations

### 1. Frontend validation contradicts backend intent (low severity)
The frontend `validate()` function in `AddBeanModal.tsx` requires roast_level (`if (!roastLevel) errors.roastLevel = 'Roast level is required'`), while the backend now explicitly **allows** empty roast_level for the LLM-infer-fails case. 

This means a user whose LLM inference returns `roast_level=""` will see "Roast level is required" and must manually select one before saving. This is acceptable UX (the user can always pick a level), but the backend permissiveness is not surfaced through the UI for the exact scenario it was built for.

**Recommendation:** No action required for this hotfix. Consider a follow-up to either (a) add an "Unknown" option to the roast level dropdown, or (b) document that the empty-roast-level backend allowance is for direct API callers only.

### 2. Diff display artefact — not a code defect
The raw `git diff` output showed `+m    if body.roast_level…` for the PUT handler, which looked like a syntax error. Confirmed via `git show` that the actual committed file is syntactically correct. The `m` was a stray character in the diff display (likely a terminal control code). No action required.

### 3. `touched` state in AddBeanModal — unused for `product_url` field
The `product_url` field (URL lookup input) does not participate in the `touched`/`fieldErrors` system. This is intentional — it is optional and not validated. No issue.

---

## Verdict

**APPROVED_WITH_NOTES** — merge to `main` is clear. Note 1 above is a follow-up item, not a blocker.

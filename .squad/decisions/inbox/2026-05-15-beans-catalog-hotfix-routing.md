# Routing Decision — Beans/Catalog Hotfix

**Date:** 2026-05-15  
**Agent:** Priya  
**Decision:** DIRECT_PERMITTED  
**Trigger:** Three user-reported production bugs in the beans/catalog domain

---

## Bugs Under Investigation

1. Cannot add new beans
2. Cannot view catalog or add to catalog
3. New brew log form shows empty beans dropdown

---

## Investigation Summary

### Backend (all clean)
- `app/routers/api_catalog.py` — routes correctly registered; all async/await patterns correct
- `app/repos/catalog.py` + `_DualWriteCatalogRepo` — properly wired; `list`, `get`, `upsert`, `_fetch_all` all present
- `app/routers/api_inventory.py` — `_resolve_display_name` correctly falls back when catalog entry is absent
- `app/main.py` — `api_catalog.router` is included
- **400 tests pass**, `mypy --strict` clean, `ruff check` clean
- No route conflicts: `POST /api/catalog` and `POST /api/catalog/infer` are distinct paths

### Frontend (builds clean, type-checks pass)
- `frontend/src/api/catalog.ts` — all API calls correctly typed and targeted
- `frontend/src/pages/CatalogList.tsx` — correct error/loading states for the catalog query
- `frontend/src/components/AddBeanModal.tsx` — **no client-side validation** for required fields (`roast_level`, `roaster`, `bean_name`) before submit
- `frontend/src/pages/BrewLogAdd.tsx` — **no error handling** for the inventory query (`isError` not destructured); silent failure renders empty dropdown

### Recent commit context
- `eb1fddb` — react-router-dom 6 → 7 (May 12, Dependabot); API-compatible, no breaking usage
- `a8471c4` — TypeScript 5 → 6 (May 12, Dependabot); compiles cleanly
- `68d7505` — `USE_POSTGRES` moved into `APP_SECRETS` blob (May 15); if production APP_SECRETS blob does not include `use_postgres: true`, `use_postgres` defaults to `False`, reads fall back to Sheets. Sheets writes are always first in the dual-write pattern so Sheets data should be intact — this is low-suspicion for the catalog list failure but should be verified in production.

---

## Root Cause Hypothesis (per bug)

### Bug 1 — Cannot add new beans
**Primary cause:** `AddBeanModal.tsx` has no client-side validation for required fields. When `roast_level` is empty (inference returned no roast level and user did not select one), the backend returns HTTP 422. The catch block surfaces a generic "Failed to save bean. Please try again." with no field-level guidance. Users retry and fail repeatedly, perceiving the feature as broken.

**Fix target:** `frontend/src/components/AddBeanModal.tsx` — add field-presence checks before calling `createCatalogItem`; surface which field is missing.

### Bug 2 — Cannot view catalog or add to catalog
**Two sub-causes:**
- **2a (add to catalog):** Same as Bug 1 — save silently fails due to missing `roast_level`. "Add to catalog" is the modal's save path; it errors with no useful feedback.
- **2b (view catalog):** If production `APP_SECRETS` blob is missing `use_postgres: true` after the M5 migration, `use_postgres` defaults to `False`. Reads go to Sheets. If Sheets auth credentials are stale or misconfigured on the current Cloud Run revision, `GET /api/catalog` returns 500 and `CatalogList` enters its error state. This is a production-environment issue, not a code defect, but worth noting.

**Fix targets:**
- `frontend/src/components/AddBeanModal.tsx` (same as Bug 1)
- Production: verify APP_SECRETS blob contains `use_postgres` and that Sheets service-account credentials are valid

### Bug 3 — Empty beans dropdown in brew log form
**Primary cause:** `BrewLogAdd.tsx` does not handle the error state for the inventory query. `isError` is not destructured from `useQuery`; when `listInventory('Active')` fails, `inventory` is `undefined` and `inventory?.map()` renders zero options silently. The user sees only "Select bag…" — indistinguishable from "no active bags."

**Secondary cause (data):** If there are genuinely no bags with status "Active" in inventory (e.g. all bags are "Finished"), the dropdown is also empty — correct behaviour but uninformative.

**Fix target:** `frontend/src/pages/BrewLogAdd.tsx` — destructure `isError` from the inventory query; show an inline error or retry prompt when the query fails.

---

## Scope Confirmation

All changes are frontend-only (plus optional production config verification):

| File | Change |
|---|---|
| `frontend/src/components/AddBeanModal.tsx` | Add client-side required-field validation; improve save-error message |
| `frontend/src/pages/BrewLogAdd.tsx` | Add `isError` handling for inventory query; surface load failure to user |
| Production APP_SECRETS (out-of-band) | Verify `use_postgres` key present and Sheets credentials valid |

No new API endpoints, no schema changes, no new feature surface. Changes are self-contained within two component files.

---

## Routing Decision

**status: DIRECT_PERMITTED**

Rationale: All three bugs trace to bounded, identifiable defects in existing frontend components (missing validation, missing error state) plus a probable production config state to verify out-of-band. No new features, no data model changes, no cross-service impact. A hotfix touching two component files is the correct response. SpecKit cycle is not warranted.

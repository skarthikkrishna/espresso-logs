# Decision Drop — Finn Frontend Routing: M5 Spec-034 Frontend Gaps
Date: 2026-05-22T05:27:24Z
Author: Finn (Frontend Agent)
Branch: feat/034-m5-household-roles

## Decision

**status: DIRECT_PERMITTED**

### Rationale

This is bounded, well-defined frontend implementation work that proceeds directly without a new SpecKit cycle.

**Why DIRECT_PERMITTED:**
1. All requirements already exist in `docs/requirements/functional-spec-v2.md` and Maya's architectural review (`.squad/orchestration-log/20260521T2032Z-maya-arch-review.md`). No new spec cycle is needed — the gaps were identified against an existing spec, not against missing requirements.
2. This is frontend-only scope. No backend API contracts are being changed by Finn; the frontend is being aligned to the contracts the spec already defines.
3. The branch `feat/034-m5-household-roles` is an existing M5 implementation branch. This is a direct continuation of that work to address review findings, not a new feature.
4. Maya's review provides exact file/line evidence for every gap. The implementation path is unambiguous.
5. Alex (backend agent) is handling backend gaps on the same branch in parallel. Finn's work does not block or require coordination beyond agreed API contracts already in the spec.

### Explicit Scope Confirmation

**In scope (Finn owns):**
- Add missing routes to `router.tsx`: `/welcome`, `/invite/accept`, `/invite/invalid`, `/invite/expired`, `/profile`, `/household/new`, `/household/settings`
- Create corresponding page components: `Welcome`, `InviteAccept`, `InviteInvalid`, `Profile`, `HouseholdNew`, `HouseholdSettings`
- Extend `types/entities.ts`: add `HouseholdMembership` type, update `CurrentUser` to include `memberships[]` and `active_household_id`
- Extend `AuthContext.tsx`: add `memberships`, `activeHouseholdId`, `switchHousehold`; graceful fallback for single-household legacy response
- Add `AdminRoute` component for role-based route protection
- Fix `Login.tsx`: add required-field validation, preserve `invite`/`from` query params, navigate zero-membership users to `/welcome`
- Fix `Register.tsx`: remove duplicate token storage (module-level call), align username validation to spec (3–30, alphanumeric + underscores only), preserve `invite`/`from` query params, navigate new users to `/welcome`
- Add household API types to `api/auth.ts` (no new endpoints, just type alignment with spec response contract)
- Run frontend quality checks: `tsc --noEmit`, `eslint`, `vitest run`

**Out of scope (not Finn's):**
- Backend security fixes (BYPASSRLS, cross-household reset) — Alex
- Backend endpoint gaps (decline invite, revoke/resend, household rename/delete) — Alex
- Guest read-only UI — deferred pending backend guest-token contract alignment (Alex)
- Test coverage for backend — Quinn
- Quinn gate artifact creation — Quinn

### Files to Change
- `frontend/src/types/entities.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/components/ProtectedRoute.tsx` (minor refactor)
- `frontend/src/components/AdminRoute.tsx` (new)
- `frontend/src/router.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/Welcome.tsx` (new)
- `frontend/src/pages/InviteAccept.tsx` (new)
- `frontend/src/pages/InviteInvalid.tsx` (new)
- `frontend/src/pages/Profile.tsx` (new)
- `frontend/src/pages/HouseholdNew.tsx` (new)
- `frontend/src/pages/HouseholdSettings.tsx` (new)
- `frontend/src/api/auth.ts` (type alignment)

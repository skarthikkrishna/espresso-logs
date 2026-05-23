# Decision Drop — Alex Routing: M5 Pending Backend Items 1–5

**Date:** 2026-05-23  
**Agent:** Alex (Backend Engineer / Routing Agent)  
**Branch:** `feat/034-m5-household-roles`

## Decision
**status: DIRECT_PERMITTED**

## Rationale
This request is a bounded remediation pass on work that was already fully specified under spec-034 and already routed for implementation on this branch. The five requested items are the remaining HIGH-priority backend follow-ups from Maya's 2026-05-21 RED architecture review after the two CRITICAL security fixes were completed.

A new SpecKit cycle is not required because:
1. The product scope already exists: these items correct missing or incomplete implementation against spec-034 requirements rather than introducing new user stories.
2. The implementation boundary is explicit: `.squad/agents/alex/pending-m5-work.md` provides concrete file targets, endpoint/schema expectations, acceptance criteria, and named tests for each item.
3. Planning artifacts already exist: prior spec-034 SpecKit phases were completed, tasks already existed for the milestone, and the branch remains the same implementation branch for that approved work.
4. The Quinn gate was previously approved for spec-034, so this is completion work within an already-authorised feature envelope rather than a net-new feature needing re-specification.
5. The requested changes stay within backend/auth/household/import-wizard remediation and do not expand beyond the reviewed M5 household-roles feature boundary.

## Explicit Scope Confirmation
The following five items are in scope for direct implementation, and no broader re-scoping is authorised under this routing decision:

1. **Atomic Refresh Token Rotation**
   - Fix refresh rotation race condition with an atomic repo-level rotate operation and concurrent test coverage.

2. **Invitation Model Overhaul**
   - Align invitation expiry, status model, request body fields, accept-role behaviour, and required decline/revoke/resend endpoints with existing spec-034 requirements.

3. **Household Rename and Soft-Delete**
   - Add the missing spec-required admin rename and soft-delete endpoints, including delete guards and deleted-household filtering.

4. **Active-Household Resolution via `X-Household-Id` Header**
   - Fix multi-household dependency resolution and update `/auth/me` membership payloads, with optional switch-household endpoint if implemented within the documented scope.

5. **Import Wizard: Admin-Gate + Replace `request.session`**
   - Correct admin-only enforcement and replace removed session-middleware usage with DB-backed import-session state.

## Notes
- This decision covers completion of already-specified M5 backend work only.
- Any new requirements beyond these five items, or any change that alters spec-034 behaviour outside the documented remediation scope, requires fresh routing.

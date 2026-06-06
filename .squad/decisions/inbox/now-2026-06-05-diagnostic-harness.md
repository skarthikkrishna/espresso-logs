---
decision_id: diagnostic-harness-auth-429
timestamp: 2026-06-05T13:01:06Z
requestor: Karthik Krishna Subramanian
route_by: Tariq (cross-repo governance)
status: DIRECT_PERMITTED
scope: Investigation + diagnostics only
---

## Decision: Diagnostic Harness for Auth 429 Investigation

### Approved Scope
- Set up logging harness in espresso-logs (application repo)
- Enable request/response tracing in FastAPI middleware
- Collect rate limiter state snapshots during E2E test runs
- Organize diagnostics into annotated artifacts for review

### Prohibited
- Production code modifications
- Real Google OAuth credentials or secrets
- Destructive changes to test suite
- Integration of diagnostics into main codebase (temp only)

### Unknown Variables
- Rate limiter reset behavior (timing, state cleanup)
- Source of duplicate `/auth/refresh` without `rt` param
- Backend log correlation with E2E failure trace
- Whether isolated failing tests pass outside suite rate pressure

### Handoff Recipients
1. **Quinn** (initial pre-implementation gate)
2. **Finn** (frontend test harness, E2E flow analysis)
3. **Alex** (backend rate limiter, auth logic)

### Next Decision Point
After diagnostic collection + Quinn review: proceed to fix code OR fix tests based on root cause analysis.

### Decision Authority
Tariq (on behalf of Karthik Krishna Subramanian).  
No Squad phase required — investigation scope is explicit and bounded.

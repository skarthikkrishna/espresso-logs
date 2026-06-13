---
date: 2026-06-13
agent: Tariq
kind: routing-decision
status: DIRECT_PERMITTED
---

# Privacy Remediation Routing

Assumptions:
- The public app repo must not expose private repo names in tracked files.
- The requested remediation is limited to tracked public files and does not rewrite history or push.
- The intended changes are documentation, governance text, comments, and script defaults only.

Decision:
- Direct implementation is permitted.
- SpecKit is not required because this is bounded privacy hygiene with no product, API, data model, auth, runtime behavior, or deployment topology change.

Scope confirmation:
- Remove private spec repo name references from tracked public files.
- Use generic wording such as "the spec repo" where a reference is still needed.
- Do not alter application behavior.
- Do not rewrite git history.
- Do not push.

Gate ruling:
- Quinn gate is waived for documentation-only, governance-only, comment-only, and script-default wording changes.
- If implementation touches application code or infrastructure behavior, Quinn gate becomes required before that code change proceeds.

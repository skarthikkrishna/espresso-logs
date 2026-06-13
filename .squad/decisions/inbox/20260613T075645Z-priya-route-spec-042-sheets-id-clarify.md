---
node_id: 20260613T075645Z-priya-route-spec-042-sheets-id-clarify
node_type: decision_drop
agent: Priya
role: product_spec_routing
spec_id: spec-042
date: 2026-06-13T07:56:45Z
status: direct_permitted
privacy_gate: .squad/privacy-gate.md reviewed before writing
---

# Routing Decision: spec-042 US3 `sheets_id` clarify amendment

## Decision

status: DIRECT_PERMITTED

A Priya-owned post-freeze clarify amendment is permitted and required before implementation. The scope is bounded to encoding Maya architecture decision d1524c3 into spec-042 US3 and tasks; this is not a new product feature and does not require a full SpecKit restart.

## Explicit Scope Confirmation

Permitted changes are limited to:

1. Amend US3 acceptance criteria so tenant table `sheets_id` identity is household-local, using `UNIQUE(household_id, sheets_id)` rather than global uniqueness.
2. Clarify that every SQL write-path read-before-write lookup by `sheets_id` must be scoped to the resolved household and must fail closed when household context is unavailable.
3. Add dependency-ordered Alex/Quinn tasks starting at T038 as needed for schema/model/write-path changes and verification.
4. Preserve the existing US3 tenant-isolation intent, fresh-household empty-state requirement, and SQL-backed verification requirements.

## Constraints

- No implementation may begin from this routing decision alone; Quinn gate remains required before schema, ORM, repository, or RLS-affecting code changes.
- No push is authorized.
- Public-repository privacy gate applies to this decision drop and downstream governance artifacts.

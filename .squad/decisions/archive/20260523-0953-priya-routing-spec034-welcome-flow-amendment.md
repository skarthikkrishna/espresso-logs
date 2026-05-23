# Decision Drop — Priya Routing

**Date:** 2026-05-23
**Agent:** Priya (product engineer, routing owner)
**Session branch:** feat/034-m5-household-roles
**Request:** Write a spec amendment for the `/welcome` first-sign-in onboarding flow, based only on `docs/requirements/functional-spec-v2.md`; create `docs/requirements/spec-034-amendment-welcome-flow.md`; commit it; do not modify application code or push.

---

## Routing Decision

**status: DIRECT_PERMITTED**

---

## Rationale

1. **Documentation-only change.** The request produces a single markdown spec amendment file under `docs/requirements/`. No application code, no test files, no configuration, no data model changes are involved.

2. **Source-bounded.** The amendment is to be derived exclusively from the existing canonical source `docs/requirements/functional-spec-v2.md`, specifically §4.12.1 (First sign-in onboarding, `/welcome` route) and related acceptance criteria (AC-ONB-01 through AC-ONB-04). No new product decisions, no new acceptance criteria, and no scope expansion are required — this is a focused extraction and formalisation of what the spec already defines.

3. **Self-contained.** The output is a single file committed to `docs/requirements/`. It does not alter the functional spec itself, does not affect any SpecKit artifacts, and does not touch any application surface.

4. **Quinn gate waived (explicit).** Per repository protocol, Quinn gate may be waived for documentation-only or governance-only changes when the routing agent states this explicitly. I (Priya) am stating this explicitly: the Quinn gate (`specs/{n}/quinn-gate.md`) is **not required** for this change. There is no implementation, no tests, and no code to review.

5. **No SpecKit cycle required.** A full SpecKit cycle (specify → clarify → plan → tasks → implement) applies to feature development. This request produces a spec artifact from pre-existing spec content. It does not initiate a new feature or alter any existing one.

---

## Explicit Scope Confirmation

- **File to create:** `docs/requirements/spec-034-amendment-welcome-flow.md`
- **Source:** `docs/requirements/functional-spec-v2.md` only
- **Content scope:** `/welcome` first-sign-in onboarding flow (§4.12.1 and related ACs)
- **No application code changes**
- **No push to remote**
- **Local commit only**
- **Quinn gate:** waived (documentation-only, routing agent confirmation on record)

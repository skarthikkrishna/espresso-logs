# Routing Decision Drop

**Date:** 2026-05-23  
**Agent:** Tariq (routing)  
**Branch:** feat/034-m5-household-roles  
**Request summary:** Independent QA validation — run FastAPI + React app, exercise scenarios A–E via live API and browser automation where possible, inspect code as needed; no application code changes; no push.

---

## Decision

**status: DIRECT_PERMITTED**

## Rationale

This is a **bounded, read-only validation task**:

1. **No application code changes requested.** The operator has explicitly prohibited modifying application code.
2. **No push requested.** Git history will not be altered beyond any session-scoped scratch artefacts (which are excluded from the no-push rule).
3. **Self-contained scope.** QA validation against the current branch state is a standard pre-merge activity. It produces a report, not a code artefact requiring SpecKit governance.
4. **SpecKit is for feature/fix work that introduces persistent code changes.** A validation-only pass that emits PASS/PARTIAL/FAIL evidence does not meet that threshold.
5. **Scenarios A–E are unambiguously scoped.** No architecture decisions, no data-model changes, no UI changes are involved.

## Scope Boundaries Confirmed

| In scope | Out of scope |
|---|---|
| Start backend (FastAPI) and/or frontend (Vite dev server) locally | Any change to `app/`, `frontend/src/`, `tests/`, config files |
| Exercise API endpoints for scenarios A–E (curl, httpx, or browser automation) | Pushing commits to remote |
| Read and cite source code as evidence | Modifying `.github/`, `alembic/`, `docs/`, `specs/` |
| Report PASS / PARTIAL / FAIL with exact evidence | Invoking SpecKit phases |

## Executing Agent

The coordinator should delegate the actual QA execution to a **`general-purpose`** agent (or directly execute it) per Step 3 of the session protocol. No SpecKit phases are required before execution begins.

---

_Tariq — routing only. Decision committed to inbox per protocol._

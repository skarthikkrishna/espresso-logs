# Routing Decision — Spec-034 M5 Feature Analysis (Top-Down Audit)

**Date:** 2026-05-23T00:00:00Z
**Agent:** Priya (routing)
**Branch:** feat/034-m5-household-roles
**Status:** DIRECT_PERMITTED

---

## Request Summary

A thorough top-down feature analysis of spec-034 (M5 Household Roles):
- Read source-of-truth spec documents (spec.md, plan.md, tasks.md, compliance.md, aria-gate.md, quinn-gate.md in the spec repo's `specs/034-m5-household-roles/`)
- Map every requirement to current implementation on `feat/034-m5-household-roles`
- Identify gaps, deviations, or incomplete items
- Produce an analysis report

This is explicitly stated as **analysis/reporting only — no code changes**.

---

## Routing Assessment

**DIRECT_PERMITTED**

### Rationale

1. **No code changes.** The request is read-only: examine spec artifacts and trace requirements through the implementation on the feature branch. No files will be written to `app/`, `tests/`, or `frontend/`. No migrations, no route changes, no product behaviour modifications.

2. **Not a SpecKit trigger.** SpecKit cycles exist to *produce* spec artifacts (spec.md, plan.md, tasks.md) or to gate implementation. An audit that reads those artifacts and cross-references them against existing implementation is entirely downstream of SpecKit — it is the kind of quality signal that informs PR review, not a new feature introduction.

3. **Bounded and well-defined scope.** Source-of-truth artifacts are fully committed in the spec repo's `specs/034-m5-household-roles/` (spec.md, plan.md, tasks.md, compliance.md, aria-gate.md, quinn-gate.md). Implementation to audit lives on `feat/034-m5-household-roles`. The analysis scope has hard edges.

4. **Analysis tasks are explicitly treated as research tasks in the process protocol.** The coordinator's instructions state: "For research tasks where you're gathering information, searching files, or understanding the codebase — do NOT use exit_plan_mode." This request is precisely that category.

5. **No Quinn gate required.** Quinn gate guards implementation start. A read-only audit does not trigger the implementation gate.

---

## Explicit Scope Confirmation

Direct work is authorised for the following — and **only** the following:

- Read the spec repo's `specs/034-m5-household-roles/spec.md`, `plan.md`, `tasks.md`, `compliance.md`, `aria-gate.md`, `quinn-gate.md`
- Read `app/`, `tests/`, `frontend/src/` on branch `feat/034-m5-household-roles` to trace requirement implementation
- Produce a written analysis report (surfaced in the conversation or as a read-only session artifact)

Priya explicitly prohibits during this task:
- Modifying any source file in `app/`, `tests/`, or `frontend/`
- Committing any code changes
- Opening or drafting a PR
- Invoking SpecKit phases (specify, clarify, plan, tasks, implement)

---

## Next Step

The requesting agent (or coordinator) may proceed directly to the feature analysis using the explore/general-purpose agent type against the read-only scope above.

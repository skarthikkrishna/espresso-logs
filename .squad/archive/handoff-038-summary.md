---
spec_id: spec-038
target_repo: espresso-logs
handoff_version: "1.0"
created_at: 2026-06-06
updated_at: 2026-06-06
status: active
author: tariq
lifecycle: permanent
---

# Handoff: spec-038 → espresso-logs (Inbox Summary)

> **Self-contained artifact.** An espresso-logs implementation agent reading this file can execute all Phase 6 tasks without accessing any `coffee_tracker` file path. This file is the single source of truth for the espresso-logs stream of Spec-038.

---

## What You Are Implementing

Spec-038 establishes cross-repo Squad governance, privacy gates, handoff infrastructure, and retro ceremonies for the three-repo product system (coffee_tracker, espresso-logs, tf-infra).

Your scope is **Phase 5 and Phase 6**: governance artifacts for `espresso-logs` only.

---

## Standing Constraints (Non-Negotiable)

**No-push gate is ACTIVE throughout all of Spec-038 implementation:**
- No `git push` to espresso-logs without explicit per-operation operator authorization
- No PR creation without operator authorization
- No workflow deployment (T020) without operator authorization
- No branch deletion without operator authorization
- Record authorization before each operation begins

**Privacy gate prerequisite:**
- `.squad/privacy-gate.md` MUST be committed in `espresso-logs` before ANY other `.squad/` write
- If `.squad/privacy-gate.md` does not exist when you spawn: T012 is your first task — no other write proceeds before it
- Verify: `git ls-files .squad/privacy-gate.md` must return non-empty before any other `.squad/` write

---

## Task Scope (T012–T019; T020 deferred)

All tasks below are scoped to `espresso-logs`. No changes to application code, tests, Terraform, or production config. Governance artifacts only.

| Task | Description | Dependencies | Status |
|------|-------------|-------------|--------|
| **T012** | Create `.squad/privacy-gate.md` | Fan-Out Gate | **MUST be committed first** |
| **T013** | Create `.squad/inbox/README.md` | T012 | Create inbox directory and README |
| **T014** | Create `AGENTS.md` at repo root | T012 | Derived from coffee_tracker `AGENTS.md`; espresso-logs-scoped copy; extensions marked `<!-- espresso-logs extension -->` |
| **T015** | Update `.squad/agents/tariq/charter.md` | T014 | Add YAML frontmatter, behavioral principles, "How I Am Invoked", SpecKit ownership, Cross-Repo Governance; preserve existing content as marked extensions |
| **T016** | Replace `.squad/agents/scribe/charter.md` | T014 | Full Scribe v2.1 protocol; privacy-gate references; handoff inbox check |
| **T017** | Add Implementation-Cycle Close Retro to `.squad/ceremonies.md` | T012 | Same ceremony as coffee_tracker with espresso-logs context |
| **T018** | Create `.squad/decisions/inbox/charter-reconciliation-20260606-tariq-scribe.md` | T012 | Charter-update trigger notice; no further reconciliation required before next session |
| **T019** | Create this file (`.squad/inbox/handoff-038-summary.md`) | T013 | Self-contained inbox summary — you are reading it |
| **T020** | Create `.github/workflows/squad-privacy-scan.yml` | T015, T016, T017 | **REQUIRES_OPERATOR_AUTH** — do NOT implement without operator authorization |

### T013/T014 may run in parallel. T015/T016 may run in parallel after T014. T017/T018 may run in parallel after T012.

---

## Acceptance Criteria

| AC | Description | Validation |
|----|-------------|------------|
| **AC-038-001** | Charter Consistency — all agent charters in espresso-logs are consistent with coffee_tracker canonical versions; no type-(c) behavioral contradictions; behavioral contradiction count = 0 | Charter audit (T036): side-by-side diff; all deviations classified (a) additive, (b) stale, (c) conflicting |
| **AC-038-002** | Cross-Repo Handoff — espresso-logs inbox summary is self-contained; an implementation agent can execute all Phase 6 tasks using only this file without coffee_tracker file access | Handoff dry-run (T037): written verification that all Phase 6 scope executable from this summary alone |
| **AC-038-003** | Privacy-Safe Artifacts — zero prohibited content in any `.squad/**` artifact committed to espresso-logs | Final privacy scan (T039): zero pattern matches across all `.squad/**` |

---

## Cross-Repo Decisions

The following decisions apply to all espresso-logs operations under Spec-038:

### 038-no-push-gate (standing constraint)
No push, no PR, no branch delete, no workflow deploy in espresso-logs without per-operation operator authorization. Every operation requiring a push must obtain and record written authorization before executing.

### Privacy gate design (Spec-038)
Layer 1: written prohibition (`.squad/privacy-gate.md` — T012); Layer 2: CI scan (T020, REQUIRES_OPERATOR_AUTH); Layer 3: state-of-the-union scan (T032, cross-repo, in coffee_tracker). Layer 1 is the primary control; Layer 2 is the backstop.

### Charter reconciliation protocol
When canonical charters in coffee_tracker change, the charter reconciliation protocol governs propagation to espresso-logs. Trigger 2 (charter-update trigger): when any charter in `.squad/agents/` is updated, a reconciliation notice is committed to `.squad/decisions/inbox/`. Scribe processes the notice at the next retro. Reconciliation for Tariq and Scribe was performed as part of Spec-038 (T015, T016) — a notice is committed at T018.

---

## Halt Conditions

**HALT** if any of the following conditions are met — surface to coordinator before proceeding:

1. **`.squad/privacy-gate.md` does not exist** and you are about to write any other `.squad/` file. T012 must be committed first. No exceptions.
2. **A push is requested** for any artifact without recorded operator authorization. Surface to coordinator; obtain written authorization; record before pushing.
3. **Any prohibited content is about to be committed.** Reference `.squad/privacy-gate.md` and identify the category. Do not commit; surface to coordinator.
4. **Any application code, test, Terraform, or production config change is requested.** espresso-logs deliverables are `.squad/` governance artifacts only. No changes to `app/`, `frontend/`, `tests/`, `pyproject.toml`, or any deployment config.
5. **T020 is about to be implemented** without explicit operator authorization. T020 requires operator auth before push, workflow deployment, and branch protection setup. Stop and surface.

---

## Quinn Gate Summary

Quinn gate for Spec-038: `APPROVED_WITH_NOTES` (reviewed 2026-06-06).

Fan-out conditions satisfied at handoff time:
- Quinn gate committed with `status: APPROVED_WITH_NOTES` ✅
- `handoff-espresso-logs.md` committed in coffee_tracker ✅

Implementation fan-out is **permitted** for espresso-logs (Phase 5 + Phase 6).

**Non-blocking notes relevant to espresso-logs:**
- **Note 1 (Phase 3 prose):** Phase 3 description says tasks are "not dependent on Quinn gate" — disregard this; the dependency graph governs. Phase 5/6 tasks begin only after all fan-out gate conditions are satisfied.
- **Note 2 (`cloud_sql` scan):** The `cloud_sql`/`cloud-sql`/`cloudsql` CI scan pattern in T020 may match documentation references. Human reviewer judgment required on match context. Layer 1 (charter prohibition) is the primary control; Layer 2 CI scan is the backstop.

---

## First Reads on Spawn

When an espresso-logs implementation agent spawns, read in this order:

1. **This file** (`.squad/inbox/handoff-038-summary.md`) — you are reading it
2. **`.squad/privacy-gate.md`** — read before writing any `.squad/` artifact; if not yet committed, T012 is your first task
3. **`.squad/decisions/inbox/`** — check for unprocessed drops before beginning any task

---

## Repo-Local Conventions (espresso-logs)

- espresso-logs is a **public repository** — all committed content is publicly visible
- Stack: Python 3.12 · FastAPI · React 18 · Vite · TypeScript · TailwindCSS + DaisyUI · Google Sheets via `gspread` · Google OAuth + email allowlist · Gemini 2.5 Flash / Claude Haiku · Google Cloud Run (scale-to-zero) · Google Cloud Storage
- Existing `.squad/` structure: agents (tariq, maya, scribe, alex, finn, priya, quinn, ralph, aria present), ceremonies, decisions (with archive and inbox), log, orchestration-log, sessions, routing, team, templates, health-report, casting
- No `AGENTS.md` at repo root before Spec-038 (T014 creates it)
- No `.squad/inbox/` before Spec-038 (T013 creates it)
- No `.squad/privacy-gate.md` before Spec-038 (T012 creates it — must be first)

---

*Lifecycle: active during Spec-038 implementation cycle. Archived to `.squad/archive/handoff-038-summary.md` at Implementation-Cycle Close Retro Step 4.*

# Ceremonies

> Team meetings that happen before or after work. Each squad configures their own.

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | multi-agent task involving 2+ agents modifying shared systems |
| **Facilitator** | lead |
| **Participants** | all-relevant |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review the task and requirements
2. Agree on interfaces and contracts between components
3. Identify risks and edge cases
4. Assign action items

---

## Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, or reviewer rejection |
| **Facilitator** | lead |
| **Participants** | all-involved |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. Root cause analysis
3. What should change?
4. Action items for next iteration


---

## Retrospective with Enforcement

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | weekly |
| **Condition** | No *retrospective* log in .squad/log/ within the last 7 days |
| **Facilitator** | lead |
| **Participants** | all |
| **Time budget** | focused |
| **Enabled** | yes |
| **Enforcement skill** | retro-enforcement |

**Agenda:**
1. What shipped this week? (closed issues, merged PRs)
2. What did not ship? (open issues, blockers)
3. Root cause on any failures
4. Action items -- each MUST become a GitHub Issue labeled retro-action

**Coordinator integration:**
At round start, call Test-RetroOverdue (see skill retro-enforcement). If overdue, run this ceremony before the work queue.

**Why GitHub Issues, not markdown:**
Production data: 0% completion across 6 retros using markdown checklists, 100% after switching to GitHub Issues.

---

## Implementation-Cycle Close Retro

> Added by Spec-038 (T017). Defined in full at `specs/038-cross-repo-squad-governance/plan.md §5.6` in the spec repo. Required by FR-038-008 through FR-038-011.

| Field | Value |
|-------|-------|
| **Trigger** | Manual — operator invokes after Quinn gate closed and PR merged to `main` in all repos in scope for the implementation cycle |
| **When** | After |
| **Facilitator** | Tariq |
| **Participants** | Tariq (process), Scribe (artifacts), Coordinator (authorization) |
| **Time budget** | ≤ 1 operator session (~2 hours total); each step is individually time-bounded |
| **Enabled** | ✅ yes |

**Agenda (all six steps are mandatory, in order):**

1. **Decision Drop Merge** *(≤20 min)* — Scribe reads all `.squad/decisions/inbox/*.md` (except `README.md`), merges each entry into `.squad/decisions.md` ledger (append; deduplicate by timestamp+agent), deletes each processed inbox file (preserving `README.md`), commits updated ledger and empty inbox. Operator verifies inbox is empty before proceeding.

2. **Log Summary and Archive** *(≤30 min)* — Scribe produces a cycle summary (key decisions, behavioral/process lessons, pointers to spec/PR artifacts), commits summary to `.squad/log/{date}-cycle-{spec_id}-retro-summary.md`, archives raw log files from the completed cycle. Active log directory retains only current-cycle entries after this step.

3. **Charter Update Check** *(≤20 min)* — Tariq checks whether any canonical charter changed since last reconciliation (`git log --oneline .squad/agents/ --since={last-reconciliation-sha}`). If changes found: reconciliation performed per charter reconciliation protocol before retro proceeds. If no changes: "No reconciliation required" note committed to `decisions.md`.

4. **Handoff Artifact Close** *(≤15 min)* — Scribe archives all `.squad/inbox/handoff-{spec_id}-summary.md` files for the completed cycle to `.squad/archive/`. The source `specs/{spec_id}/handoff-espresso-logs.md` in the spec repo is updated with `status: archived`. Commits per repo. No push without operator authorization.

5. **Artifact Hygiene** *(≤20 min)* — Scribe identifies candidates for pruning (draft/superseded spec artifacts not referenced by any active spec, stale `.squad/sessions/` entries, duplicate governance files). Scribe produces a written inventory — does NOT delete without explicit per-item operator authorization. Operator reviews inventory and authorizes deletions.

6. **Privacy Scan** *(≤10 min)* — Privacy gate scan is run against all modified `.squad/**` artifacts. Zero findings required to close the retro. If findings: operator-authorized remediation before retro is closed. Scan command targets prohibited patterns from `.squad/privacy-gate.md`.

**Output artifacts:**

| Artifact | Path | Owner |
|----------|------|-------|
| Retro summary log | `.squad/log/{date}-cycle-{spec_id}-retro-summary.md` | Scribe |
| Updated decisions ledger | `.squad/decisions.md` | Scribe |
| Reconciliation record | `.squad/decisions.md` entry `RECONCILE-{date}` | Tariq |
| Archived handoff summaries | `.squad/archive/handoff-{spec_id}-summary.md` | Scribe |
| Artifact hygiene inventory | `.squad/log/{date}-hygiene-inventory.md` | Scribe |
| Privacy scan result | `.squad/log/{date}-privacy-scan.md` | Scribe |

**espresso-logs-specific context:**

- Decision inbox: `.squad/decisions/inbox/` — processed at Step 1
- Session logs: `.squad/log/` — archived at Step 2
- Handoff inbox: `.squad/inbox/` — `handoff-{spec_id}-summary.md` files archived to `.squad/archive/` at Step 4
- Privacy gate reference: `.squad/privacy-gate.md` — scanned at Step 6

# Decision Drop — Squad Governance Spec Routing

**Date:** 2026-06-06T22:03:49-07:00
**Agent:** Tariq (routing)
**Repo:** espresso-logs (drop location)
**Session state at routing time:** Ralph CLEAR; no pushes authorized

---

## Request Summary

Operator requests a Squad-built spec for cross-repo Squad governance work, covering:

1. Charter drift across `coffee_tracker`, `espresso-logs`, `tf-infra`
2. CI/test/infra debug loops taking too many iterations to clear
3. No mechanism for parallel implementation across repos once tasks are decomposed
4. Squad ceremonies and charters currently locked into `coffee_tracker`; desired model is hub-and-spoke: `coffee_tracker` owns specs and Squad invocation through task decomposition, then hands off to repo-local Squad members
5. Missing privacy/security gates in `tf-infra` and `espresso-logs` to prevent sensitive artifact leakage to public-facing repos
6. Missing retro ceremony: no mechanism to capture and then prune decision drops, inbox logs, and artifacts post-cycle
7. No state-of-the-union cleanup: unsecure/unnecessary artifacts may exist; sustainability question around automation vs. GitHub Actions cost

---

## Classification

**`status: SPECKIT_REQUIRED`**

---

## Rationale

This is a multi-repo, cross-cutting governance feature with at minimum:
- New Squad agent protocols (charter normalization, hub-and-spoke handoff)
- New per-repo Squad infrastructure in `espresso-logs` and `tf-infra`
- Privacy/security gate definitions (scope, trigger conditions, enforcement mechanism TBD)
- New retro ceremony design (cadence, artifact scope, pruning rules TBD)
- Artifact cleanup and automation tradeoff analysis

None of these are bounded single-file changes. All touch shared Squad process contracts that span three repos. SpecKit is required. Priya owns specify + clarify.

---

## Hub Constraint

**SpecKit hub: `coffee_tracker`.**
Spec, plan, tasks, and all gate artifacts (`aria-gate.md`, `quinn-gate.md`) must land in `coffee_tracker`. This drop is written to `espresso-logs` as a local routing record only.

---

## Scope (for Priya's specify phase)

- Cross-repo charter normalization (`coffee_tracker`, `espresso-logs`, `tf-infra`)
- Hub-and-spoke Squad handoff protocol (post task-decomposition repo-local execution)
- Privacy/security gate design for `espresso-logs` and `tf-infra` Squad artifacts
- Retro ceremony design (capture + prune cycle)
- Artifact state-of-the-union: audit and sustainable cleanup model
- Automation tradeoff: scheduled/manual cleanup vs. GitHub Actions cost

---

## Open Questions for Priya (specify/clarify)

These must be resolved before spec freeze:

1. **Charter normalization scope:** Should repo-local charters in `espresso-logs` and `tf-infra` be full mirrors of `coffee_tracker` charters, or lean profiles that reference the hub? What is the update propagation mechanism when the hub charter changes?
2. **Hub-and-spoke handoff trigger:** At what exact point in the task lifecycle does ownership transfer from `coffee_tracker` Squad to repo-local Squad? After `tasks.md` is committed? After Quinn gate? Both?
3. **Repo-local Squad membership:** `espresso-logs` and `tf-infra` — which agents are instantiated locally vs. proxy back to `coffee_tracker`? Is Quinn always repo-local? Is Tariq always hub-side?
4. **Privacy/security gate definition:** What constitutes a "sensitive" artifact? PII? Credentials? Internal architecture decisions? What is the gate mechanism — file naming conventions, a pre-commit hook, a CI check, a manual review step?
5. **Retro ceremony cadence:** Per implementation cycle (after each `tasks.md` closes)? Per sprint? Per calendar interval? Operator-triggered only?
6. **Pruning rules:** What gets pruned in retro? Only `inbox/` after merge? Also `log/`? Under what retention policy? Who approves prune?
7. **Cleanup automation:** Is the operator willing to accept GitHub Actions minutes for scheduled cleanup, or is this strictly operator-triggered? Should this be a `gh workflow dispatch` only?
8. **Coffee Tracker main ahead-2 state:** Two local governance/triage commits exist on `coffee_tracker` main that have not been pushed. Does this spec need to account for resolving that state, or is that handled independently?

---

## No-Push Constraint

No pushes authorized for this session. This drop is committed locally only. It will be merged into `decisions.md` at session close by Scribe.

---

## Known Blockers

None. Session is clear to proceed to SpecKit in `coffee_tracker`.

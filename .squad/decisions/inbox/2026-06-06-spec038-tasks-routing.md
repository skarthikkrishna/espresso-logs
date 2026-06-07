# Routing Decision Drop — Spec-038 Tasks Phase

**Timestamp:** 2026-06-06T22:37:02-07:00  
**Agent:** Tariq  
**Session:** Continuation of Spec-038 cross-repo Squad governance  

---

## Request

Operator: "Let's go for it — When will we start making changes to the other repos?"

Context confirmed at routing time:
- Ralph session-open: CLEAR
- Spec-038 status: specified + clarified + planned
- Plan commit: `b29c3209189f25208dd4e2468b79b21687fe48fc`
- Artifacts verified: `specs/038-cross-repo-squad-governance/plan.md`, `compliance.md`
- Aria design gate: not applicable (no user-facing UI; Maya confirmed)
- No `tasks.md` exists yet — implementation not yet authorised

---

## Classification

**status: SPECKIT_REQUIRED**

Rationale: This is an active SpecKit cycle. Spec-038 has completed specify → clarify → plan phases. The mandatory next phase is **tasks generation** (`speckit.tasks` / Tariq). Implementation in any repo — espresso-logs, tf-infra, or coffee_tracker — is not authorised until `tasks.md` is committed and the Quinn gate (`specs/038/quinn-gate.md`) is approved and verified via `git ls-files`.

---

## Scope

- **Owning worktree:** `/Users/krishna/Documents/Development/GitHub/coffee_tracker-spec-038`
- **Branch:** `spec/038-cross-repo-squad-governance`
- **Next phase:** `speckit.tasks` — Tariq generates `specs/038-cross-repo-squad-governance/tasks.md`
- **Repos affected (post-tasks, post-Quinn):** coffee_tracker, espresso-logs, tf-infra
- **Current authorisation level:** tasks generation only; zero implementation edits

---

## Timing Answer — When Do Other Repos Start Changing?

Other repos (espresso-logs, tf-infra) begin receiving implementation changes **only after all of the following are satisfied:**

1. `tasks.md` committed to the worktree branch (`speckit.tasks` phase complete)
2. Quinn gate file `specs/038-cross-repo-squad-governance/quinn-gate.md` present and `status: APPROVED` or `APPROVED_WITH_NOTES`
3. `git ls-files specs/038-cross-repo-squad-governance/quinn-gate.md` in the worktree returns non-empty
4. Implementation fan-out authorised: Alex (backend tasks), Finn (frontend tasks, if any), Quinn (test/process tasks) spawned by the coordinator

No implementation changes to espresso-logs or tf-infra are permitted before those four conditions are met.

---

## No-Push Constraint

No `git push` is authorised in any repo at this time. Commits accumulate locally. Push occurs only at the end of a complete work unit, after all four local CI checks pass and the operator gives explicit affirmative.

---

## Next Action

Coordinator to invoke `speckit.tasks` (Tariq as owning agent) in the coffee_tracker worktree to generate `tasks.md`. No other action permitted.

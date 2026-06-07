# Routing Decision Drop — Spec-038 Plan Phase

**Timestamp:** 2026-06-06T22:23:39-07:00  
**Agent:** Tariq  
**Session context:** Operator invoked "Let's go for it" following Priya's clarify completion on Spec-038.

---

## Request

Advance Spec-038 (`Cross-Repo Squad Governance, Handoff, Privacy Gates, and Artifact Hygiene`) from the `clarified` state into the **plan phase**.

## Classification

`status: SPECKIT_REQUIRED`

## Rationale

- Spec-038 was initiated through the full SpecKit workflow (specify → clarify), both commits verified (`e5ebd8d` specify, `f993f85` clarify).
- Spec frontmatter confirms `status: clarified`; no `[NEEDS CLARIFICATION]` markers remain.
- This is a cross-repo governance feature of non-trivial scope; direct implementation is not permitted.
- The next mandatory SpecKit gate is the **plan phase**, owned by Maya via `speckit.plan`.
- No prior plan or compliance artifacts exist under `specs/038-cross-repo-squad-governance/`.

## Scope of this routing decision

**Authorized:** Plan phase only — Maya produces `plan.md` and `compliance.md` in the Coffee Tracker worktree.  
**Not authorized:** tasks generation, implementation fan-out, Aria gate, Quinn gate, PR creation, or any `git push`.

Subsequent phases require explicit operator authorization at each gate.

## Worktree

- **Repo:** `coffee_tracker` (isolated worktree)
- **Path:** `/Users/krishna/Documents/Development/GitHub/coffee_tracker-spec-038`
- **Branch:** `spec/038-cross-repo-squad-governance`
- **Spec path:** `specs/038-cross-repo-squad-governance/spec.md`

## Constraints

- Primary Coffee Tracker worktree is on a stale incident branch with local-only state and an untracked RCA file — **do not touch it**.
- No pushes are authorized in either repo for any reason during this session unless the operator explicitly authorises after all four local CI checks pass.

## Next owner

**Maya** via `speckit.plan` (sync, blocking).

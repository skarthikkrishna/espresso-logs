# Tariq Routing Decision — Cross-Repo Governance Proposal

**drop_id:** 2026-06-07-tariq-routing-cross-repo-governance-proposal  
**timestamp:** 2026-06-07T04:38:00Z  
**author:** Tariq (routing agent)  
**repo_context:** skarthikkrishna/espresso-logs  
**status:** DIRECT_PERMITTED

---

## Operator Request Summary

Compound request covering:
1. Merge and clean coffee_tracker incident branch on remote; rebase espresso-logs; prune all stale local branches across repos.
2. Cross-repo state-of-union review (coffee_tracker, espresso-logs, tf-infra).
3. Squad proposal (no implementation) covering:
   - Charter drift remediation across three repos
   - CI/test/infra loop reduction strategy
   - Multi-repo independence: espresso-logs and tf-infra get their own squad ceremonies/charters
   - coffee_tracker retains SpecKit; implementation triggers handoff to code/infra repos
   - Explicit privacy/security gates in tf-infra and espresso-logs to prevent ceremony artifact leaks to public repos
   - Retro ceremony with artifact pruning to manage context bloat in coffee_tracker
   - Sustainable long-term cleanup process (e.g. GitHub Actions post-merge retro)
   - General artifact hygiene and security review across all three repos

---

## Classification

**`status: DIRECT_PERMITTED`**

---

## Rationale

1. **Git cleanup** (rebase, prune, branch deletion) is operational maintenance. No SpecKit artifact is created or modified. Bounded, reversible, and entirely pre-push (no remote push without explicit operator confirmation).
2. **State-of-union investigation** is discovery/research only. No code or infra change.
3. **Proposal production** is explicitly scoped to a proposal document authored by Squad agents. The operator has not authorized implementation of any charter, workflow, or GitHub Action. Once a proposal is accepted, any implementation touching code/infra will require a SpecKit cycle (specify → clarify → plan → Aria gate → tasks → Quinn gate → implement). That gate is not waived by this drop.
4. The scope is cross-cutting governance (Tariq domain) + architecture standards (Maya domain) + session continuity (Ralph domain) — all of which permit direct Squad engagement for proposal work without a full SpecKit cycle.

---

## Explicit Scope Confirmation

### IN SCOPE (this session)

| Area | What is permitted |
|------|------------------|
| espresso-logs local | Rebase `main` from `origin/main`; prune stale local branches. **No push.** |
| espresso-logs branches | Safe to prune: any local branch whose remote tracking ref is merged or gone. `fix/prod-shot-save-detail` (PR #105 open) must NOT be deleted or rebased — active workstream. |
| coffee_tracker local | Review `incident/prod-shot-save-detail-logs` state (1 commit ahead, untracked RCA file); propose merge path. Actual push requires operator confirmation. |
| tf-infra | Read-only state-of-union. No changes. No .squad directory exists — note this as a gap. |
| Proposal document | Squad agents (Tariq, Maya, Ralph) produce a written proposal covering all 8 governance areas. Committed locally to coffee_tracker or espresso-logs as appropriate. Not pushed. |
| Artifact hygiene review | Identify insecure, unnecessary artifacts in all three repos. No deletion without operator confirmation. |

### OUT OF SCOPE (this session — requires separate authorization + SpecKit)

- Implementing any charter changes in any repo
- Creating or modifying GitHub Actions workflows
- Changing any `.squad/agents/` content
- Any push to any remote without explicit operator affirmative reply
- Touching `fix/prod-shot-save-detail` branch (active PR #105)

---

## Concurrent Workstream Gate

**PR #105** (`fix/prod-shot-save-detail`, espresso-logs) is open and active — spec-037 implementation workstream. This is NOT a blocker for the governance proposal work, which is orthogonal. The operator instruction to "poll until cleared" applies if any git operations on shared branches would conflict. The specific constraint: do not rebase or delete `fix/prod-shot-save-detail` locally. All other branch cleanup is safe to proceed.

**coffee_tracker `incident/prod-shot-save-detail-logs`** is 1 commit ahead of origin with an untracked RCA file. Before proposing a merge path, the untracked file state must be inspected and resolved (commit or discard) by the operator. No push proceeds without confirmation.

---

## No-Push Constraint (Rule 10 — Inviolable)

No `git push` to any remote on any branch in any repository may be executed as part of this session without:
1. All four local CI checks passing (ruff check, ruff format --check, mypy --strict, pytest) — for app repos.
2. Explicit operator affirmative reply to a push confirmation question.

This constraint is binding on the coordinator AND all implementation agents spawned during this session.

---

## Next Steps (post-routing)

1. Spawn Ralph to verify session open (CLEAR/BLOCKED).
2. Perform local git cleanup on espresso-logs (rebase main, prune merged/gone branches — skip `fix/prod-shot-save-detail`).
3. Inspect coffee_tracker `incident/prod-shot-save-detail-logs` state; surface untracked RCA file to operator.
4. Spawn Maya + Tariq (in parallel or serial as coordinator sees fit) to produce cross-repo state-of-union and governance proposal.
5. Proposal delivered as a document committed locally. No push until operator confirms.

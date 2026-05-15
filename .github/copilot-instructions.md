# GitHub Copilot Instructions — espresso-logs

This is the **application repository** for Espresso Logs — an open-source coffee tracking app built with FastAPI and React.

Reusable prompt templates for common subagent tasks live in `.github/copilot-prompts/`:

- `code-exploration.md`
- `implementation.md`
- `code-review.md`
- `bug-triage.md`
- `image-sourcing.md`

---

## Workflow

**Never push directly to `main`.** Every change goes through a branch and PR.

```bash
git checkout main && git pull origin main
git checkout -b <type>/<slug>   # e.g. fix/brew-log-ordering
```

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI (JSON API only) |
| Frontend | React 18 · Vite · TypeScript · TailwindCSS + DaisyUI |
| Data store | Google Sheets via `gspread` |
| Auth | Google OAuth + email allowlist (`ALLOWLIST_EMAILS`) |
| AI | Gemini 2.5 Flash (default) · Anthropic Claude Haiku (adapter) |
| Hosting | Google Cloud Run (scale-to-zero) |
| Images | Google Cloud Storage (public-read bucket) |

## Key source files

- `app/main.py` — FastAPI app, middleware, route registration
- `app/deps.py` — dependency injection (sheets client, repos, LLM, idempotency store)
- `app/repos/` — data access layer (all use `SheetsClientProtocol`)
- `app/routers/` — API route handlers
- `app/services/` — inference, image store, image sourcer, idempotency
- `frontend/src/` — React SPA; `api/` for typed API clients, `pages/` for route components
- `app/static/spa/` — committed Vite build output (served by FastAPI)

## Code conventions

- All public functions and methods must have type annotations
- Module-level docstrings required on all routers and services
- Tests use `SPREADSHEET_ID=dummy` and `FakeSheetsClient` (never real sheets)
- `pytest-asyncio` in `auto` mode — no `@pytest.mark.asyncio` markers needed
### Local CI-equivalent — all four must pass before any push is considered

1. `uv run ruff check app/ tests/`
2. `uv run ruff format --check app/ tests/`
3. `uv run mypy app/ --strict`
4. `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/`

All four are required. Not three. Not "the ones that seem relevant." All four.

## Documentation

- `docs/requirements/functional-spec.md` — product behaviour and entities
- `docs/requirements/engineering_architecture.md` — system design and decisions
- `docs/requirements/sheet-schema.md` — Google Sheets column schema

---

## Session Protocol — Run This Every Time

This is not optional. These steps are mechanical, not advisory. Execute them in order for every user request, every session. Copilot is a **dispatcher**, not a doer. It does not generate spec content, plan content, architecture decisions, or implementation code directly. Every domain artifact is produced by the owning Squad agent spawned via the `task` tool.

> **Note:** SpecKit artifacts (`specs/`, plans, tasks, gates) live in the `coffee_tracker` repo. Filesystem checks for those artifacts must be run in that repo. All other protocol steps apply identically here.

**Orchestration log — standing rule (applies to every step below):** Before every `task` tool call that spawns an agent, write an orchestration log entry to `.squad/orchestration-log/{timestamp}-{agent-name}.md` using the format in `.squad/templates/orchestration-log.md`. The entry must exist before the agent runs. Fill in the Outcome field after the agent returns.

**Scribe — background constant:** Scribe is not a session-close-only agent. After any implementation batch completes, or after any SpecKit phase output (spec.md, plan.md, tasks.md, or any gate file) is produced, spawn Scribe in the background before proceeding to the next work batch. Scribe at session close (STEP 5) is the final mandatory run — it does not replace mid-session runs.

---

### STEP 0 — Spawn Ralph (mandatory, blocking)

Spawn Ralph via the `task` tool (`agent_type: general-purpose`, `mode: sync`). Provide Ralph's charter inlined in the prompt. Ralph checks:

1. Is `.squad/identity/now.md` updated within the last 7 days?
2. Is there conflicting in-progress state from a prior session in `.squad/log/`?
3. Read `.squad/decisions.md` and surface to the coordinator all decisions whose topic, named agent, or workflow step mentions any element of the incoming request.
4. Read `.squad/identity/wisdom.md` and surface all patterns whose domain or tag matches the domain of the incoming request.

**HALT** if condition 1 or 2 fails. Checks 3 and 4 are informational — surface findings but do not halt on them. Do NOT proceed until Ralph explicitly signals clear.
Ralph's response must include one of: `CLEAR — proceed` or `BLOCKED — [reason]`.
If Ralph returns BLOCKED, surface the blocker to the operator. Do not work around it.

```
# Example task tool call
agent_type: general-purpose
prompt: "You are Ralph. Read .squad/identity/now.md and the most recent file in .squad/log/. 
         Check if now.md is dated within 7 days. Check for conflicting in-progress state. 
         Return CLEAR or BLOCKED with explicit rationale."
```

---

### STEP 0b — Ceremony Check (mandatory, blocking)

**This step runs at the start of every session, and again after any CI failure, build failure, or reviewer rejection. It is not a judgment call. It is a mechanical gate.**

Read `.squad/ceremonies.md` before spawning any work batch. Evaluate each ceremony in order:

#### Check A — Before-work ceremonies

For every ceremony with `trigger: auto` and `when: before`:

- Evaluate the condition against the current task.
- **If the condition matches → HALT. Spawn the designated facilitator (sync, blocking) before any other work proceeds.** The ceremony output must be attached verbatim in all subsequent work spawn prompts for this session.
- If the condition does not match → skip with no reasoning. There is no "probably applies" path. There is no "it seems small" escape.

This is not a suggestion. This is the step. It cannot be skipped, combined, or inferred. A condition that matches is not a prompt for judgment. It is a trigger. Ceremony runs.

#### Check B — After-failure ceremonies

After any CI failure, build failure, or reviewer rejection:

- Read `.squad/ceremonies.md`. Trigger all ceremonies with `trigger: auto` and `when: after`.
- The Retrospective ceremony MUST produce GitHub Issues labeled `retro-action`. Markdown notes are not a valid output. A decision drop file is not a valid substitute. GitHub Issues are the only valid form of action item. This is not optional.
- **HALT until all after-failure ceremonies are complete before continuing any implementation work.**

This is not a suggestion. This is the step. It cannot be skipped, combined, or inferred.

#### Check C — Weekly enforcement

At the start of every session:

- Check whether any file in `.squad/log/` has a name containing the word `retro` and whose filename timestamp (the `{timestamp}` prefix in `.squad/log/{timestamp}-{topic}.md` format) falls within the last 7 calendar days.
- **If no such file exists → HALT. Run the Retrospective with Enforcement ceremony before any other work in this session.** This check runs regardless of whether any failure occurred. It runs even if the task seems small. It runs before STEP 1.
- If a qualifying retro log exists → proceed.

This is not a suggestion. This is the step. It cannot be skipped, combined, or inferred.

---

### STEP 1 — Spawn the Routing Agent (mandatory, blocking)

*(Write orchestration log entry before spawning — see standing rule above.)*

Spawn the owning routing agent via the `task` tool (`agent_type: general-purpose`, `mode: sync`). Provide the agent's charter inlined.

- Feature / product / backend scope → spawn **Alex** or **Priya**
- Frontend / UI scope → spawn **Finn**
- Process / governance / CI / cross-repo → spawn **Tariq**

The spawned agent must return **exactly one** of:

| Response | Meaning | Next Step |
|---|---|---|
| `status: SPECKIT_REQUIRED` — with rationale | Non-trivial work; full SpecKit cycle needed | → STEP 1b, then STEP 2 |
| `status: DIRECT_PERMITTED` — with rationale and explicit scope confirmation | Self-contained, bounded change | → STEP 1b, then STEP 3 |
| `status: BLOCKED` — with numbered list of gaps | Agent cannot route; blockers must be resolved first | Stop. Surface to operator. |

**HALT** if the agent returns none of the above, or returns BLOCKED.
**HALT** if Copilot is tempted to skip this step because the task seems small. Scope is not the coordinator's call. Silence is not permission.
**NEVER** reason inline as a Squad agent and call that routing. "As Priya, I think..." without a `task` tool dispatch is fabrication. Spawn the agent.

---

### STEP 1b — Verify the decision drop exists (mandatory, before any other action)

The routing agent writes and commits a decision drop file to `.squad/decisions/inbox/` as part of its own execution — before returning its result.

After the routing agent returns, the coordinator verifies:

```bash
git log --oneline -5 .squad/decisions/inbox/
```

**HALT** if no drop file appears in the recent commit history. The routing agent violated protocol — surface this to the operator before proceeding to STEP 2 or STEP 3.

**Why this step is non-negotiable:** Chat context compacts. A routing decision made at turn 5 may be gone by turn 40. Git is permanent. Chat is not. If a decision was never committed, it never existed as far as the next session is concerned. This applies equally to agents running as `task` subprocesses and to any inline reasoning the coordinator performs.

---

### STEP 2 — SpecKit Phases (sequential, no skipping)

*(Write an orchestration log entry before each agent spawn in this step — see standing rule above.)*

Each phase = coordinator spawns the owning agent via `task` tool. Each phase blocks the next. Hard gate artifacts must exist on disk in the `coffee_tracker` repo (verified via `git ls-files` run there) before the next phase begins.

| Phase | Spawn | Owner | Hard Gate |
|-------|-------|-------|-----------|
| specify | `task` (sync) | **Priya** | `specs/{n}/spec.md` committed |
| clarify | `task` (sync) | **Priya** | All `[NEEDS CLARIFICATION]` resolved; `status: clarified` in frontmatter |
| plan | `task` (sync) | **Maya** | `specs/{n}/plan.md` + `specs/{n}/compliance.md` committed |
| **Aria design gate** | `task` (sync) | **Aria** | `specs/{n}/aria-gate.md` status: APPROVED — check with `git ls-files specs/{n}/aria-gate.md` |
| tasks | `task` (sync) | **Tariq** | `specs/{n}/tasks.md` committed; dependency order verified |
| Quinn gate | `task` (sync) | **Quinn** | `specs/{n}/quinn-gate.md` exists with `status: APPROVED` or `APPROVED_WITH_NOTES` |
| implement | fan-out (see below) | Alex / Finn / Quinn | Quinn gate confirmed: `git ls-files specs/{n}/quinn-gate.md` returns non-empty |

**HALT before `speckit.tasks`:** For any feature with user-facing UI, confirm `specs/{n}/aria-gate.md` exists and is `status: APPROVED` before Tariq generates tasks.md. Run `git ls-files specs/{n}/aria-gate.md` — empty result = blocked. Spawn Aria to produce the design gate.

**Checking the Quinn gate — required command:**
```bash
git ls-files specs/{n}/quinn-gate.md
```
If this returns empty, implementation is blocked. No verbal acknowledgment, no inline reasoning, and no assumptions substitute for this filesystem check.

**Implementation fan-out — do NOT invoke `speckit.implement` as a monolithic command:**
After tasks.md is confirmed on disk, the coordinator reads task markers and fans out in parallel:

- Tasks marked `[US*]` backend → spawn **Alex** (`task`, background)
- Tasks marked `[US*]` frontend → spawn **Finn** (`task`, background)
- Tasks marked `[P]` or test tasks → spawn **Quinn** (`task`, background, parallel with above)

All three can run simultaneously. The coordinator monitors completion and surfaces blockers.

---

### STEP 3 — Direct Implementation (Squad-authorized only)

*(Write orchestration log entry before any agent spawn in this step — see standing rule above.)*

Only proceed here if STEP 1 returned `status: DIRECT_PERMITTED` with explicit rationale and scope confirmation.

- For any change touching application or infrastructure code: Quinn gate (`specs/{n}/quinn-gate.md`) is still required. Check with `git ls-files` in the `coffee_tracker` repo.
- For documentation-only or governance-only changes: Quinn gate may be waived — but the routing agent must state this explicitly in its STEP 1 response. Coordinator does not make this call.

---

### STEP 4 — PR and Merge

Follow `.github/copilot-prompts/pr-merge-workflow.md` exactly. No step may be skipped.

**Before any `git push`:**
1. Run all four local CI checks (see Local CI-equivalent section). All four must pass.
2. **STOP. Ask the operator:** "All four local checks pass. Ready for me to push to [branch]?"
3. **Wait for explicit affirmative reply.**
4. Only then: `git push`.

This is not a suggestion. This is the step. It cannot be skipped, combined, or inferred. A passing checklist is not permission. Silence is not permission. Completing the work is not permission. The only permission is the operator saying yes.

CI must be green before requesting review.

**Internal Squad review gate — required before external review. Cannot be bypassed even when CI is green:**
1. Spawn **Maya** (`task`, sync, blocking) to review the PR. Maya must return `APPROVED` or `APPROVED_WITH_NOTES`. If Maya returns `BLOCKED` → do not proceed. Surface to operator.
2. Spawn **Quinn** (`task`, sync, blocking) to review the PR. Quinn must return `APPROVED` or `APPROVED_WITH_NOTES`. If Quinn returns `BLOCKED` → do not proceed. Surface to operator.
3. Only after both Maya AND Quinn approve: tag `@copilot can you review this please`.

Do NOT request review while any build check is failing.

If CI fails at any point — invoke Tariq (via `task` tool) for failure triage before touching any code. See Inviolable Rule 3.

---

### STEP 5 — Session Close (mandatory, every session)

Two agents must complete before the session is closed:

**Scribe** (spawn via `task` tool, `agent_type: general-purpose`, `mode: background`):
1. Merges all files in `.squad/decisions/inbox/` into `decisions.md` and clears the inbox
2. Writes a session log to `.squad/log/{timestamp}-{topic}.md`

**Ralph** (spawn via `task` tool, `agent_type: general-purpose`, `mode: background`):
1. Updates `.squad/identity/now.md` with current team focus and open work state

Both must complete for the session to be considered closed. Both run as background — neither blocks the final response to the operator, but the coordinator must confirm both have finished before declaring the session done.

---

## Inviolable Rules

These are not guidelines. Violating any of these is a **process failure** that must be flagged to the operator immediately:

1. **No `git push` until a milestone, feature, or bug is fully complete.** Commits accumulate locally throughout. Push once at the end of the work unit — not after every file change, not after every commit.

2. **Quinn output is internal only — never posted to GitHub.** Quinn's review findings are addressed in code. GitHub Copilot bot (`@copilot`) is the external reviewer tagged on the PR. Quinn's output never appears in GitHub PR comments.

3. **Build failures trigger Tariq triage before any fix attempt.** If CI fails on a PR — even once — spawn Tariq via `task` tool for root cause analysis before touching any code. No whack-a-mole. Tariq reviews the full failure history and produces a written diagnosis before any fix plan is written.

4. **Squad agent decision is final.** If a spawned Squad agent returns BLOCKED or `SPECKIT_REQUIRED`, Copilot does not override it, rationalize past it, or proceed anyway. The blocker is surfaced to the operator.

5. **Quinn gate is a filesystem artifact, not a verbal acknowledgment.** Run `git ls-files specs/{n}/quinn-gate.md` in the `coffee_tracker` repo. If the output is empty, implementation is blocked. No exceptions.

6. **No scope changes after spec freeze.** If requirements change after `speckit.tasks` is complete, the change triggers a new `speckit.clarify` cycle — not an inline amendment during implementation.

7. **Squad = `task` tool. Inline persona adoption is not Squad, ever.** Writing "As Priya, I think..." or "As Tariq, the recommendation is..." without a real `task` tool dispatch is fabrication. The coordinator never generates spec content, plan content, architecture decisions, or implementation code directly. If you are about to write a domain artifact yourself — stop and spawn the owning agent.

8. **Three operator corrections → session halts.** If the operator has corrected the coordinator or a spawned agent three or more times in a single session, stop all work immediately. Spawn Ralph + Tariq via `task` tool. Tariq produces a written diagnosis to `.squad/log/{timestamp}-rca.md`. No work continues until the operator has reviewed the diagnosis and explicitly authorised resumption.

9. **Quinn gate is a filesystem artifact, not a verbal acknowledgment.** (Duplicate emphasis — this rule is that important.) Before any implementation begins: run `git ls-files specs/{n}/quinn-gate.md` in the `coffee_tracker` repo. Empty output = blocked. No exceptions for "small" tasks, "governance-only" work that touches code, or time pressure.

10. **Before `git push`: ask or pause. Those are the only two options. There is no third.** Before executing `git push` on any branch:
    - All four local CI checks (ruff check, ruff format --check, mypy --strict, pytest) must have passed in the current terminal session. If any check has not been run or has failed: **STOP. Ask the operator. Do not push.**
    - The operator must have been explicitly asked whether to push and must have replied affirmatively. An agent completing its work is NOT implicit permission to push. Silence is NOT permission. A passing checklist is NOT permission. The only permission is the operator saying yes.
    - The only two states an agent or coordinator may be in before a push: **asking the operator** or **paused waiting for the operator's reply**. There is no third state. There is no "reasonable judgement" escape. There is no "it seems ready" path.
    - This rule binds the coordinator AND every implementation agent. It is not delegatable. An implementation agent completing work and reporting success does not transfer push authority to itself.

11. **Agent domain failures require charter amendment before session close.** If, at any point during the session, any agent produced output that the operator or coordinator explicitly identified as having missed something within that agent's stated charter domain — not outside it, within it — their charter must be amended before STEP 5 runs.
    - The amendment must encode the **class of issue** as a principle, not the specific incident. An amendment that says "check for X" after an X incident is inadequate. A valid amendment takes the form: "For any [type of artifact/task/output], verify [specific check]." An amendment that names the specific incident rather than a type is rejected.
    - **Before STEP 5 (session close):** the coordinator must verify that the relevant charter has been amended. If not: **HALT. Do not run Scribe. Do not run Ralph. Do not close the session. Amend the charter first.**
    - There are two valid states: charter amended, or session not closed. There is no third state. There is no "if time permits" path. There is no "we'll fix it next session" escape. The amendment is a prerequisite for closure, not a follow-up task.
    - This rule is not waivable. It applies to all agents, all domains, all session types — including governance-only sessions.

12. **`git commit` requires explicit authorization — this is a separate and additional gate to `git push`.** No implementation agent may run `git commit` unless the coordinator has received an explicit directive from the operator to commit, and has relayed that directive as an explicit commit instruction to that agent. Completing implementation work, passing tests, or receiving coordinator approval to proceed does not constitute authorization to commit. The only exception: Scribe may run `git commit` for `.squad/` state files only (decisions.md, history.md, log/, orchestration-log/). Scribe never commits source code, app/ files, frontend/ files, or build artifacts. Both the commit gate and the push gate must be cleared independently — clearing one does not clear the other.

---

## Squad Agent Ownership

Agents are spawned via the `task` tool. The coordinator does not impersonate them.

| Agent | Domain | SpecKit Phase | Spawn Mode |
|---|---|---|---|
| **Tariq** | Cross-repo sequencing, milestones, operability, CI/CD, release readiness | `speckit.tasks` | sync (blocking) |
| **Maya** | Architecture decisions, security, code quality gates, technical standards | `speckit.plan` | sync (blocking) |
| **Finn** | React/TypeScript, frontend features, UI/UX, accessibility | implement fan-out (frontend `[US*]` tasks) | background (parallel) |
| **Alex** | FastAPI, backend features, data models, auth, multi-tenancy | implement fan-out (backend `[US*]` tasks) | background (parallel) |
| **Priya** | User stories, acceptance criteria, product scope, routing | `speckit.specify` + `speckit.clarify` | sync (blocking) |
| **Quinn** | Pre-implementation gate, PR quality review, test coverage | Quinn gate + implement fan-out (`[P]` / test tasks) | sync for gate; background for implement |
| **Aria** | UI/UX design, visual assets, design gate | Aria design gate (between plan and tasks for UI features) | sync (blocking) |
| **Ralph** | Session continuity, open work queue, conflict detection | Session open (Step 0) | sync (blocking) |
| **Scribe** | Session logging, decision merge, institutional memory | Session close (Step 5) | background (non-blocking) |

Squad agent charters live in `.squad/agents/` in `skarthikkrishna/coffee_tracker`.

---

## Behavioral Principles

All Squad agents operate under the 12 behavioral principles defined in [`AGENTS.md`](../AGENTS.md).
Agents read `.squad/skills/agent-behavioral-principles/SKILL.md` before starting any task.
All agents must also read `.squad/skills/git-discipline/SKILL.md` before any task in this session. This is a hard gate, not a suggestion.

These principles apply in addition to — not instead of — charter-specific responsibilities.

**Key principle reminders for the Coordinator:**
- Rule 1: Surface assumptions before routing work — don't assume production state.
- Rule 12: "Routing complete" is wrong if any routing step was skipped silently.
- Rule 10: Checkpoint between SpecKit phases — verify artifacts exist before advancing.

---

## Squad-First Mandate — No Exceptions

**Every request to Copilot CLI — regardless of scope, size, or apparent triviality — requires Squad involvement before any action is taken.**

This is not optional. It applies to:
- Feature requests of any size
- Bug fixes and review feedback responses
- File edits (single-line or multi-file)
- Refactors and renames
- API or data model changes
- Frontend component and routing changes
- Test additions and CI configuration changes
- Repository documentation and contributing guide changes

**Copilot does not decide whether Squad is needed. A Squad agent decides.**

The routing sequence is always:
1. User makes a request → Copilot routes to the relevant Squad agent
2. Squad agent assesses the request and recommends one of:
   - **SpecKit required** — Squad agent invokes the appropriate SpecKit phase (`speckit.specify`, `speckit.clarify`, `speckit.plan`, `speckit.tasks`, or `speckit.implement`)
   - **Direct implementation permitted** — Squad agent explicitly classifies the work as self-contained and scoped, and gives the green light with rationale
3. Only after Step 2 does implementation or editing proceed

**SpecKit is invoked on the Squad agent's recommendation, not Copilot's unilateral judgment.** If a Squad agent does not give an explicit green light for direct implementation, SpecKit is the default path.

Non-feature work (CI workflow changes, dependency updates, process changes) follows the same rule: the relevant Squad agent (typically Tariq for CI/process, Maya for engineering standards) recommends whether SpecKit applies based on scope and impact.

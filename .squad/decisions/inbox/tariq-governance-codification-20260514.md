# Decision Drop — Governance Codification
**Author:** Tariq (TPM)
**Date:** 2026-05-14
**Session context:** Governance failure post-mortem — M4 Design Review bypass + Retrospective bypass after PR #62 CI failures

---

## What changed

### 1. `.github/copilot-instructions.md` — STEP 0b added

A new mandatory protocol step **STEP 0b — Ceremony Check** was inserted between STEP 0 (Ralph) and STEP 1 (Routing Agent). It defines three binary gates:

- **Check A (before-work):** Evaluate all `trigger: auto, when: before` ceremonies against the current task. Condition matches → spawn facilitator sync/blocking before any work. No judgment path.
- **Check B (after-failure):** After any CI failure, build failure, or reviewer rejection → trigger all `when: after` auto ceremonies. Retrospective output MUST be GitHub Issues labeled `retro-action`. Markdown and decision drops are not valid substitutes.
- **Check C (weekly):** At session start, check for a retro log in `.squad/log/` within the last 7 days. None found → run Retrospective with Enforcement before any other work. No exceptions.

All three gates are phrased as binary: condition matches = ceremony runs. No "probably applies" path. No "it seems small" escape. Language mirrors the existing STEP 4 push gate by design.

### 2. `.github/copilot-instructions.md` — Inviolable Rule 11 added

Rule 11 encodes the meta-requirement for charter amendments. If any agent produced output during the session that missed something within their stated charter domain, their charter must be amended before STEP 5 (session close). The amendment must encode the **class of issue** — not the specific incident. Two valid states: charter amended, or session not closed. No "if time permits" path exists.

This is deliberately generic. It does not name Quinn, Alex, or any specific incident. It applies to all agents, all domains, all session types. The owning agent writes their own charter amendment; Tariq writes the meta-rule requiring it to happen.

### 3. `.squad/ceremonies.md` — Rework Rate item added

Agenda item 5 added to the Retrospective with Enforcement ceremony:

> Rework Rate: run `npx github:bradygaster/squad rework` and record the output in the session log. Review against healthy thresholds (Rework Rate ≤15%, Review Cycles ≤1.0, Rejection Rate ≤20%). Any metric in the 🔴 range requires a GitHub Issue labeled `retro-action` before the ceremony closes.

---

## Why these changes

**Root cause 1 — Ceremonies were governance documentation, not governance.** `.squad/ceremonies.md` existed but was not referenced anywhere in `.github/copilot-instructions.md`, the operative protocol file. The coordinator has no mechanism to enforce what isn't in copilot-instructions.md. STEP 0b closes this gap by making ceremony evaluation a blocking protocol step with binary conditions and no interpretation path.

**Root cause 2 — Charter patching was forensic, not structural.** Post-incident, the reflex was to add agent-specific, incident-specific checks ("check for async injection sites"). Karthik explicitly rejected this as overfitted. Rule 11 encodes the structural fix: any domain miss by any agent → charter amendment required before session close → amendment must encode a principle broad enough to cover the class of issue, not just the triggering incident.

**Root cause 3 — No quantitative health signal in retrospectives.** Rework Rate tracking adds a measurable signal to the weekly ceremony, making degradation patterns visible before they compound.

---

## Decisions made

1. STEP 0b uses binary condition language intentionally — "Condition matches = ceremony runs" — with no judgment path. This is the only acceptable formulation given Karthik's explicit requirement: "There should be no room for interpretation or fuzziness."

2. Rule 11 deliberately avoids naming specific agents. The rule is structural: it binds the coordinator to verify charter amendment before any session close. The actual charter content is owned by the relevant agent in their next session.

3. Retrospective output format is specified as GitHub Issues only (not markdown, not decision drops). This is consistent with the existing `ceremonies.md` rationale: "0% completion across 6 retros using markdown checklists, 100% after switching to GitHub Issues."

---

## Priya review flag

**Item for Priya to verify — clarity / no-interpretation-room compliance:**

STEP 0b Check A reads: "Evaluate the condition against the current task." The word "evaluate" could be interpreted as a judgment step. Recommend Priya review whether this needs tighter language — e.g., "Compare the condition text character-by-character against the task description. If the condition text describes the task, the condition matches." If any ambiguity exists in what "matches" means for a given ceremony condition, the ceremony condition itself should be rewritten to be unambiguous before being relied upon as a gate.

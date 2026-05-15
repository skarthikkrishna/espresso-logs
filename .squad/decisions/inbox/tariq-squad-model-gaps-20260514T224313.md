# Decision Drop — Squad Operational Model Gaps Closed

**Agent:** Tariq (TPM)  
**Date:** 2026-05-14T22:43:13-07:00  
**Task:** Close 7 gaps identified in gap analysis of `.github/copilot-instructions.md` vs Squad operational model

---

## Decisions Made

### Gap 1 — Inviolable Rule 12: `git commit` requires explicit authorization
Added as Rule 12 in Inviolable Rules. Principle: `git commit` by any implementation agent requires explicit coordinator or operator authorization, independent of the `git push` gate. Scribe exception scoped to `.squad/` state files only.

### Gap 2 — Behavioral Principles: git-discipline/SKILL.md reference
Added hard gate: all agents must read `.squad/skills/git-discipline/SKILL.md` before any task. Placed immediately after the existing agent-behavioral-principles/SKILL.md reference.

### Gap 3 — Orchestration log standing rule + per-step callouts
Added standing rule to Session Protocol preamble. Added one-line callouts in STEP 1, STEP 2, and STEP 3 referencing the standing rule. Format source: `.squad/templates/orchestration-log.md`.

### Gap 4 — STEP 4: Internal Maya + Quinn review gate before external @copilot
Inserted mandatory two-reviewer internal gate block in STEP 4, after CI-green requirement, before the @copilot tag instruction. Explicitly marked as separate from CI and non-bypassable.

### Gap 5 — STEP 0 Ralph: read decisions.md at session open
Added check 3 to Ralph's responsibilities list: read `.squad/decisions.md` and surface relevant decisions to coordinator.

### Gap 6 — STEP 0 Ralph: read wisdom.md at session open
Added check 4 to Ralph's responsibilities list: read `.squad/identity/wisdom.md` and surface relevant patterns. Both checks 3 and 4 are informational (no halt). HALT condition text updated to clarify it applies to checks 1 and 2 only.

### Gap 7 — Session protocol: Scribe runs after substantial work, not just at session close
Added standing paragraph to Session Protocol preamble. Principle: Scribe is a background constant; spawn after any substantial work batch before proceeding. STEP 5 is the final mandatory run, not the only run.

---

## Rule numbering
Last existing rule before this session: Rule 11. Gap 1 was assigned Rule 12. No renumbering required.

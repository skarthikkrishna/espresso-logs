---
updated_at: 2026-06-15
focus_area: spec-043 component-system rebuild — foundation + catalog summary DONE; rollout phases pending
milestone: foundation built + committed locally (71f60d2, NOT pushed); p2b–p10 rollout phases ready for intake
action: continue rollout per docs/requirements/component-rebuild/00-HANDOFF.md (Aria-design new components → Finn build → localhost gate)
---

# Current Team Focus — 2026-06-15

## Active thread

- **spec-043 — Kaapi Kadai Component-System Rebuild:** work remains local on `feat/043-design-coherence`.
- **Current state:** foundation and catalog summary are DONE and committed locally at `71f60d2`. The two-page prototype (Brew-log detail + Catalog detail) was approved by the operator. Plan was approved (2026-06-15T11:05:00). Foundation built (Phase 0/1/2a). Four detail-page regressions fixed. Catalog summary migrated. All reusable components built to spec.
- **Immersive shell vision:** LIST/summary pages are card-less with blurred background; DETAIL pages + entity CARDS use the glass takeover-card treatment.
- **Push state:** no push, PR, or deploy has occurred. Single PR to `household_fixes` (NOT main). Pushes require explicit operator approval after local CI-equivalent validation.

## Done this session

- Prototype-first two-page redo (Catalog detail + Brew-log detail) approved by operator (v3 "almost perfect").
- P2 universal light/dark toggle seed: ToneContext + localStorage persistence (dark + beige tones, AA-compliant, tone-aware components).
- Plan authoring + approval: spec approach (c), single PR, phase-gated localhost review, tone persistence, shell deferred.
- Foundation (Phase 0/1/2a) built: ~84 `--kk-tc-*` tokens, tone classes, shared reusable component library, 4-layer architecture.
- Foundation fixes: 4 detail-page regressions fixed (monogram style, bean-icon consistency, section-header hierarchy, extraction-readout spacing).
- Catalog summary migrated: monogram full-bleed fill, 2-line header (title + descriptor).
- Reference docs promoted to `docs/requirements/component-rebuild/`: handoff, surface map, principles northstar, technical architecture, rollout checklist, northstar screenshots.
- All 13 decision drops merged into `.squad/decisions.md`; inbox cleared.

## Next actions (phases p2b–p10, per rollout checklist)

1. **Phase p2b–p4:** Hardware detail + Hardware list (new card-less LIST shell) → Household detail → Household list (new LIST shell) → Brew-log add (form-focused detail) → Compass Chart extraction viz post-review.
2. **Phase p5–p7:** Roast detail + Roast list → Grinder detail + Grinder list → Home dashboard (new LIST shell).
3. **Phase p8–p10:** Settings → onboarding → edge-case coverage + one-off retirement + ESLint no-one-off gate verification.

**Per-phase loop (NEW operator-approved workflow):**
- For each page, identify NEW components (not in anchors).
- **Aria designs each new component** (principled opinion + templatization).
- Finn extends shared library + migrates page.
- Show on localhost → operator approval → proceed.

## Continuation point

**READ THIS FIRST:** `docs/requirements/component-rebuild/00-HANDOFF.md`

This file has:
- Full foundation summary + phase descriptions.
- V2 surface map (62 endpoints, per-page coverage matrix).
- Aria principles northstar (12 principles, palette snapshot, AA specs).
- Maya technical architecture (4-layer hierarchy, shell definitions, ToneContext spec).
- Tariq phase sequencing (p2b–p10, gating criteria).
- Quinn northstar screenshots (8 images for visual regression baseline).

## Continuity notes

- Do NOT skip the 00-HANDOFF.md. Next session resumes from there.
- Single PR to `household_fixes` (NOT main). Commits accumulate locally on feat/043-design-coherence.
- Phase-gated localhost review required after each deployable phase.
- Tone persistence → localStorage `.kk-tone-preference` (seed for P2 site-wide light/dark mode).
- App-shell (nav + GSAP motion) left AS-IS (no tone extension into shell; deferred to P2).
- HeroVisualFrame / CompassChart: post-build Aria design-review required (screenshot principle-review vs northstar; if clash, return fix recommendations).
- Foundation is principle-grounded per Aria northstar; zero one-offs; 100% reusable-component mandate enforced by per-page/per-endpoint coverage checklist + future ESLint no-one-off gate.
- Before any push: run all four local CI-equivalent checks (`ruff check`, `ruff format --check`, `mypy --strict`, pytest). All four must pass. Then ask operator explicitly for push approval.
- No push, PR, or deploy authorized until explicit operator approval.

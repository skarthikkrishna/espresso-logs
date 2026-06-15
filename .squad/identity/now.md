---
updated_at: 2026-06-15T16:05:00Z
focus_area: spec-043 component-rebuild PAUSED (2026-06-15) — home/dashboard + catalog-summary RED; detail pages GREEN
milestone: foundation committed (71f60d2, GREEN); dashboard WIP committed (1c07b78, RED); rollout halted pending RED rework
action: restart per docs/requirements/component-rebuild/00-HANDOFF.md ⛔ PAUSED section (fix RED pages: beige-grey frost, EntityCard presence, hero viz removal, bag monogram bug, CTA strength)
---

# Current Team Focus — 2026-06-15 (PAUSED)

## ⛔ STATUS: PAUSED — spec-043 rollout halted; home/dashboard + catalog-summary marked RED

- **Branch:** `feat/043-design-coherence` off `household_fixes` (local only, no push).
- **Pause reason:** Operator ran out of time after identifying critical issues on home/dashboard + catalog-summary pages. Both pages need rework before rollout continues.
- **Pause date/time:** 2026-06-15T16:05:00Z.

## Pages status

### ✅ GREEN (approved, committed at 71f60d2)
- **Brew-log detail:** glass takeover card, tone-aware, approved "almost perfect."
- **Catalog detail:** glass takeover card, tone-aware, approved.
- **Foundation (Phase 0/1/2a):** Tone system library + ToneContext + reusable components + shared EntityCard. Ready for production. Zero one-offs.

### 🔴 RED (need rework — DO NOT proceed past)
- **Home/Dashboard** (`/`, Dashboard.tsx):
  1. Remove 2D coffee-graphics hero viz entirely (operator dislikes it).
  2. Restore color/contrast (page reads monochromatic after immersive beige tone introduced).
  3. BEIGE "light mode" reads GREY/muddy (immersive beige frost ~55% too transparent over blurred photo). Fix: raise opacity to match detail-page natural beige (~78%).
  4. Bag monograms show "RE" (bug: should show per-bag initials).
  5. "Log a shot" primary CTA weak (plain text, should be button).
  6. EntityCards faint on dark tone (increase glass presence).

- **Catalog summary** (`/catalog`, CatalogList.tsx):
  1. BEIGE "light mode" reads GREY/muddy (same immersive beige frost issue as home). Fix: raise opacity to natural beige (~78%).
  2. EntityCards faint on dark tone (increase glass presence).

### 🚫 NOT STARTED (rollout phases p2b–p10 paused)
- Hardware detail/list, Household detail/list, Brew-log add, Roast detail/list, Grinder detail/list, Settings, Onboarding, edge-case coverage.

## Root causes (operator findings)

1. **Immersive BEIGE frost transparency:** ~55% `rgba(245,235,220,0.55)` over blurred dark photo lets dark bleed through → GREY muddy read. Detail takeover cards' ~78% `rgba(245,235,220,0.78)` are clean + natural. **Reusable component fix** (ImmersiveListShell) → fixes BOTH home + catalog simultaneously.
2. **Hero viz visual clash:** 2D coffee graphics render as bright white/cream panel floating on dark tone → jarring, not immersive. Operator decision: remove entirely. (Aria fix-spec §B viz-integration is now moot.)
3. **Monochromatic appearance:** Faint cards + low-contrast text + lack of warm accents (roast chips, etc.) on beige tone → reads washed-out. Restore contrast + ensure warm elements show.
4. **Bag monogram bug:** Data derivation pulling "REady to brew" or wrong field instead of per-bag initials.

## Open RED feedback consolidated (restart to-do list)

**Catalog summary — RED:**
1. Raise immersive beige opacity to natural beige (~78%) → fixes muddy GREY read. [Aria fix-spec §A, now docs/rebuild-plan]
2. Increase EntityCard glass presence on dark tone. [Aria fix-spec §E, now docs/rebuild-plan]

**Home/Dashboard — RED:**
1. REMOVE hero viz entirely (DashboardHero3D, DashboardHeroMotion, DashboardHeroFallback, HeroVisualFrame).
2. Restore color/contrast (beige opacity fix + card presence + warm accents visible).
3. BEIGE opacity fix (same as catalog summary). [Aria fix-spec §A]
4. Bag monogram bug fix (show per-bag initials, not "RE").
5. "Log a shot" CTA → make it a proper primary button.
6. EntityCard dark-tone presence. [Aria fix-spec §E]

## Continuation point

**READ THIS FIRST:** `docs/requirements/component-rebuild/00-HANDOFF.md` — scroll to ⛔ **PAUSED** section.

This file has:
- Full foundation summary + phase descriptions.
- V2 surface map (62 endpoints, per-page coverage matrix).
- Aria principles northstar (12 principles, palette snapshot, AA specs).
- Maya technical architecture (4-layer hierarchy, shell definitions, ToneContext spec).
- Tariq phase sequencing (p2b–p10, gating criteria).
- Quinn northstar screenshots (8 images for visual regression baseline).
- Aria fix-spec for §A (beige opacity) + §E (EntityCard dark presence) archived at `docs/requirements/component-rebuild/07-dashboard-and-beige-fixes.md`.

## Restart workflow

1. Apply Aria fix-spec fixes (docs/rebuild-plan §A + §E): immersive BEIGE frost opacity + EntityCard dark presence.
2. Remove hero viz from Dashboard.tsx.
3. Fix bag monogram derivation + "Log a shot" CTA button.
4. Re-verify BOTH tones (beige natural not grey; color/contrast restored; cards present) on localhost.
5. Get operator approval before resuming rollout (p2b–p10 per Tariq checklist).

## Continuity notes

- Do NOT skip the 00-HANDOFF.md. Next session resumes from the ⛔ PAUSED section.
- Single PR to `household_fixes` (NOT main). Commits accumulate locally on feat/043-design-coherence.
- Nothing has been pushed. All work is local.
- Before any push: run all four local CI-equivalent checks (`ruff check`, `ruff format --check`, `mypy --strict`, pytest). All four must pass. Then ask operator explicitly for push approval.
- No push, PR, or deploy authorized until explicit operator approval.

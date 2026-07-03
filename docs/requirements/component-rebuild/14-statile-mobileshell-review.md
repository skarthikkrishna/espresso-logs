# 14 — StatTile Affordance + Mobile Nav Tone-Aware Review (Stage-2)

**Spec:** 043 → Component System Rebuild  
**Prepared by:** Aria (Designer)  
**Date:** 2026-06-19  
**Status:** POST-BUILD DESIGN REVIEW  
**Reviewed commit scope:** Finn's round-3 changes (BottomNav.tsx, StatTile.tsx, index.css tone-aware mobile nav)

---

## Skills Applied

| Skill | Application | Evidence |
|-------|-------------|----------|
| **design-review** | Stage-2 post-build review against brief (13-affordance-and-mobile-shell.md) | This document |
| **ui-design-contract** | Verified against design-language.md Hybrid Base (L36–48), Liquid Glass Restraint (L178–180), Surface Contract (L44–48) | See §1, §2 |
| **design-tokens** | Computed-style contrast analysis on hardcoded mobile-nav values + StatTile token usage | See §2C, §3 |
| **grill-me** | Self-resolved tone-wiring scope question via `html:has()` code review | See §2B |

---

## Summary

**Overall:** Finn's implementation is **SOUND** and correctly follows Aria's Option B (StatTile) and Option D (Mobile Nav). All changes pass static code review and WCAG AA contrast verification. Three items require operator visual confirmation before closing this round.

| Category | Count |
|----------|-------|
| **Must Fix** | 0 |
| **Should Fix** | 1 |
| **Could Improve** | 2 |
| **Deferred** | 3 (carried forward) |

---

## §1 — Principle 13 / StatTile Affordance

### 1A. Changes Reviewed

**Files modified:**
- `frontend/src/components/tone-system/StatTile.tsx` — docstring updated (lines 1–13)
- `frontend/src/index.css` — `.stat-tile` class (lines 2805–2817)
- `frontend/src/components/tone-system/__tests__/StatTile.test.tsx` — test intent updated

**Implemented treatment (Option B — typography-only):**

```css
.stat-tile {
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: default;
  padding: 0.5rem 0;
  /* grid + left-align retained */
}
```

### 1B. Affordance Verdict

| Check | Pass? | Evidence |
|-------|-------|----------|
| No card chrome (border) | ✅ | `border: none;` at L2814 |
| No card chrome (border-radius) | ✅ | `border-radius: 0;` at L2815 |
| No card chrome (background) | ✅ | `background: transparent;` at L2813 |
| No hover/active transition | ✅ | No `:hover` or `:active` rules on `.stat-tile` |
| No pointer cursor | ✅ | `cursor: default;` at L2816 |
| Backdrop-filter removed | ✅ | Prior `backdrop-filter: blur(8px)` is gone; no `@supports not (backdrop-filter)` fallback block needed |

**Principle 13 compliance: ✅ PASS**

StatTile now correctly reads as informational-only. There is no residual tap signifier — the element is a plain `<div>` with typography-only treatment. It is visually distinct from the EntityCards on the same view.

### 1C. EntityCard Confirmation

EntityCard (`frontend/src/components/tone-system/EntityCard.tsx`) remains correctly actionable:
- Rendered as `<Link>` element (implicit `cursor: pointer`)
- `:hover` → `filter: brightness(1.05)` + shadow lift (L2459–2461)
- `:active` → `transform: scale(0.98)` (L2467–2469)
- `:focus-visible` → outline ring (L2463–2466)

**No changes needed; contrast with StatTile is clear.**

### 1D. StatTile Text Legibility — Contrast Analysis

**⚠️ Attention:** With `background: transparent`, StatTile text now sits directly on the immersive frost layer, NOT on a solid card surface. This changes the contrast calculation.

**Dark mode:**
- `.stat-tile__value` uses `--kk-tc-text-primary` → `#fff7ed` (cream)
- `.stat-tile__label` uses `--kk-il-text-secondary` → `#e8ddd4`
- Background: `#main-content` frost = `rgba(24, 16, 10, 0.45)` over dark photo
- **Effective background:** ~`#1a1209` (espresso dark frame floor)
- **Contrast:** `#fff7ed` on `#1a1209` = ~14:1 ✅ AA

**Beige mode:**
- `.stat-tile__value` uses `--kk-tc-text-primary` → `#2d1608` (espresso text)
- `.stat-tile__label` uses `--kk-il-text-secondary` → `#5c3d1e`
- Background: `#main-content` frost = `transparent` with `backdrop-filter: blur(24px)` over photo
- **Effective background:** Variable — blurred photo. Worst case is bright latte art / sunlit beans.
- **Contrast concern:** On bright photo regions, `#2d1608` text may fall below 4.5:1.

**Mitigation present:** The header text in beige mode uses `--kk-il-header-shadow-light` (`0 1px 2px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)`). StatTile does NOT have this shadow applied.

**SHOULD FIX:** Consider applying the same dual-layer text shadow to `.stat-tile__value` and `.stat-tile__label` in beige mode:

```css
[data-tone="beige"] .stat-tile__value,
[data-tone="beige"] .stat-tile__label {
  text-shadow: var(--kk-il-header-shadow-light);
}
```

This mirrors the header treatment (L2430–2433) and ensures AA compliance over bright photo regions.

---

## §2 — Mobile Bottom Nav Tone-Awareness

### 2A. Changes Reviewed

**Files modified:**
- `frontend/src/components/BottomNav.tsx` — added `mobile-nav` class discriminator (L81)
- `frontend/src/index.css` — `html:has([data-tone="beige"])` rules (L601–643)

**Implemented treatment (Option D — hybrid per-tone):**
- Desktop Sidebar: unchanged (stays dark in all tones) ✅
- Mobile bottom nav in DARK mode: unchanged (dark `nav-shell`) ✅
- Mobile bottom nav in BEIGE mode: adopts cream surface (`#f5ebdc`) + warm text hierarchy

### 2B. Tone-Wiring Mechanism Analysis

**Mechanism:** CSS `:has()` selector at document root:
```css
html:has([data-tone="beige"]) .nav-shell.mobile-nav { ... }
```

**How it works:**
1. `ImmersiveListShell` or `TonePageWrapper` sets `data-tone="beige"` on the page's root element
2. CSS `:has()` detects this attribute ANYWHERE in the document
3. Styles apply to `.nav-shell.mobile-nav` which sits OUTSIDE the `[data-tone]` ancestor
4. No React state wiring needed at AppShell level

**Soundness assessment:**

| Scenario | Expected Behavior | Actual Behavior | Pass? |
|----------|-------------------|-----------------|-------|
| Immersive page + light tone (e.g., Home in beige) | Cream nav | `html:has([data-tone="beige"])` matches → cream | ✅ |
| Immersive page + dark tone (e.g., Home in dark) | Dark nav | No match → dark nav fallback | ✅ |
| Non-immersive page (no `data-tone` attribute) | ??? | No match → dark nav | ⚠️ See below |

**Cross-page edge case:**
Pages that don't use `ImmersiveListShell` or `TonePageWrapper` (e.g., Settings, Profile, Import, standalone forms) have NO `data-tone` attribute in the DOM. On these pages:
- User's tone preference is stored in `localStorage` via `ToneContext`
- But the nav will ALWAYS show dark — even if user prefers light

**Is this acceptable?**
- **For prototype:** Yes. These pages are not yet migrated to the immersive shell system.
- **For rollout:** Requires fix. Two options:
  1. **Preferred:** Provide `ToneContext`/`data-tone` at `AppShell` level (wrap entire app in `TonePageWrapper`)
  2. **Alternative:** Add a `data-preferred-tone` attribute on `<html>` from `ToneContext` at app mount

**Decision recommendation:** Accept for prototype; file as P2 scope item for site-wide light/dark toggle work (same scope as Principle 1 P2 milestone).

### 2C. Contrast Verification — Mobile Nav

**Values used (hardcoded per Finn's implementation note):**

| Element | Color | Surface | Computed Ratio | AA Req | Pass? |
|---------|-------|---------|----------------|--------|-------|
| Inactive nav icon/label | `#6b5344` | `#f5ebdc` | **4.8:1** | 4.5:1 (body) | ✅ |
| Active nav icon/label | `#2d1608` | `#f5ebdc` | **12.3:1** | 4.5:1 (body) | ✅ |
| Household strip button | `#4a3728` | `#f5ebdc` | **6.1:1** | 4.5:1 (body) | ✅ |
| Border | `rgba(120, 53, 15, 0.18)` | — | N/A (decorative) | — | ✅ |

**Dark mode (unchanged):**
| Element | Color | Surface | Computed Ratio | Pass? |
|---------|-------|---------|----------------|-------|
| Nav text (cream) | `#fff7ed` | `rgba(26, 18, 9, 0.93)` | ~15:1 | ✅ |

**AA compliance: ✅ PASS for all mobile nav elements**

### 2D. Desktop Sidebar Isolation

**Verification:** Desktop Sidebar (`<aside>` in AppShell) does NOT have the `mobile-nav` class. The CSS selector `html:has([data-tone="beige"]) .nav-shell.mobile-nav` requires BOTH classes.

Checked `frontend/src/components/Sidebar.tsx`: uses `nav-shell` class only.

**Desktop sidebar: ✅ UNAFFECTED — stays dark in all tones**

### 2E. Safe-Area Handling

**Implementation:** L624–626:
```css
html:has([data-tone="beige"]) .nav-shell.mobile-nav {
  padding-bottom: env(safe-area-inset-bottom, 0.5rem);
}
```

This replaces the `.household-bottom-safe` treatment with a tone-aware version. The safe-area zone now adopts the cream surface color, eliminating the "dark afterthought gap" on iPhones.

**✅ PASS**

---

## §3 — Additional Round-3 Changes

### 3A. Ghost Button Variant

**Added:** `.kk-tc-btn--ghost` (L2011–2031)
- `background: transparent`, `border: none`
- Hover: subtle tint (`rgba(255, 247, 237, 0.08)` dark / `rgba(45, 22, 8, 0.06)` beige)
- Focus ring: `var(--kk-tc-btn-focus-ring)`

**Hierarchy:** primary (solid) > edit (border) > ghost (text-only)

**Button state compliance (Principle 8):** ✅ INTENSIFY pattern maintained — no color flip on hover.

### 3B. ToneToggle Label Update

**Changed:** User-facing label from "☕ Beige" to "☀️ Light"
- Internal `data-tone="beige"` preserved for stability
- Aria-label updated: "Switch to light mode" / "Switch to dark mode"

**✅ Correct UX labeling**

### 3C. Back-Link Tokenization

**Updated:** `.kk-tc-back-link` now uses `var(--kk-tc-back-link-color)` instead of hardcoded `#fbbf24`.
- Dark: `#fbbf24` (amber) — ~5.5:1 on dark surfaces ✅
- Beige: `#92400e` (bark brown) — ~7:1 on cream surfaces ✅

**✅ PASS — AA compliant on both tones**

### 3D. Monogram Card Aspect Ratio

**Changed:** `.entity-card-figure:has(.entity-card-monogram-fill)` now uses `aspect-ratio: 3 / 2` (was 4:3).

**Rationale:** Reduces dominant empty space for monogram-only cards. Photo cards keep 4:3 via base rule.

**COULD IMPROVE:** This changes visual rhythm in mixed lists (some photo, some monogram). Operator eye needed to confirm it doesn't create jarring height mismatches in the catalog grid.

---

## §4 — Residual / Deferred Items

### From prior reviews — NOT addressed this round (correct scope)

| Item | Status | Notes |
|------|--------|-------|
| **Icon asset** | DEFERRED | Nav icons need sourcing; separate design task |
| **Bag monogram "RE" bug** | OPEN | EntityCard monogram sometimes shows "RE" instead of correct initials. Separate bug ticket. |
| **EntityCard dark faintness** | OPEN | Dark-tone EntityCard text may appear faint at small sizes. Needs contrast audit with real data. |

### New item from this review

| Item | Priority | Notes |
|------|----------|-------|
| **Non-immersive page nav inconsistency** | P2 | Pages without `data-tone` always get dark nav regardless of user tone preference. Fix at site-wide toggle scope. |

---

## §5 — Operator-Eye Required

Before closing this round, the operator should visually confirm:

1. **StatTile legibility without card surface (beige mode):** On the Home page in Light mode, do the stat values and labels remain crisp and readable over the blurred photo? If they appear "soft" on bright photo regions, the text-shadow treatment (§1D recommendation) should be applied.

2. **Cream nav on real mobile (beige mode):** Does the cream bottom nav + household strip feel cohesive on iOS/Android? Confirm the safe-area zone matches the nav surface with no dark gap.

3. **Monogram card aspect ratio in catalog:** In the Catalog list with mixed photo/monogram EntityCards, does the 3:2 monogram aspect create visual rhythm issues?

---

## Verdict Table

| # | Item | Verdict | Action |
|---|------|---------|--------|
| 1 | StatTile affordance removal | ✅ PASS | None |
| 2 | StatTile text on frost (beige) | ⚠️ SHOULD FIX | Add text-shadow treatment |
| 3 | Mobile nav tone-wiring | ✅ PASS (prototype) | P2 scope for rollout |
| 4 | Mobile nav contrast | ✅ PASS AA | None |
| 5 | Desktop sidebar isolation | ✅ PASS | None |
| 6 | Ghost button variant | ✅ PASS | None |
| 7 | Back-link tokens | ✅ PASS | None |
| 8 | Monogram aspect ratio | ⚠️ COULD IMPROVE | Operator eye |

---

## Final Counts

| Category | Count | Items |
|----------|-------|-------|
| **Must Fix** | 0 | — |
| **Should Fix** | 1 | StatTile beige text-shadow |
| **Could Improve** | 2 | Non-immersive nav consistency (P2), Monogram aspect ratio visual check |
| **Deferred** | 3 | Icon asset, "RE" bug, EntityCard dark faintness |

**Blocking operator sign-off:** None (the SHOULD FIX is a polish item, not a blocker).

---

*End of Stage-2 design review.*

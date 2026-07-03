# Aria Design Fixes — Dashboard + Catalog Immersive Issues

**Version:** 1.0  
**Date:** 2026-06-15  
**Author:** Aria (Designer)  
**Scope:** Fix A (beige frost), Fix B (hero viz integration), Fix E (entity card dark presence)  

---

## §A — Immersive Shell BEIGE Frost Correction (Highest Priority)

### Problem
The `ImmersiveListShell` beige frost (currently `rgba(245, 235, 220, 0.55)`) over the blurred DARK route photo allows the dark to bleed through → reads as muddy GREY, not the clean natural beige of the detail pages.

The detail-page takeover card beige surface is `rgba(245, 235, 220, 0.78)` and reads as a clean, natural, neutral beige.

### Root Cause Analysis
| Surface | Opacity | Result |
|---------|---------|--------|
| `.kk-takeover-card.kk-tc--beige` (detail) | **0.78** | Clean natural beige |
| `#main-content:has(.immersive-list-shell[data-tone="beige"])` (list) | **0.55** | Dark bleed → muddy grey |

The 23-point opacity gap is the issue. At 0.55, the dark photo bleeds through the beige tint. Raising opacity to match detail pages will produce the clean beige without muddy bleed.

### Fix
Raise the beige frost opacity from **0.55 → 0.78** (matching the takeover card exactly). Accept reduced photo show-through — the operator explicitly prefers a clean beige "light mode" surface over photo visibility.

#### CSS Changes

**File:** `frontend/src/index.css`

**1. Token declaration** (line ~2189):
```css
/* BEFORE */
[data-tone="beige"] {
  --kk-il-frost-tint: rgba(245, 235, 220, 0.55);

/* AFTER */
[data-tone="beige"] {
  --kk-il-frost-tint: rgba(245, 235, 220, 0.78);
```

**2. #main-content frost application** (line ~2227–2230):
```css
/* BEFORE */
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  backdrop-filter: blur(var(--kk-il-frost-blur));
  -webkit-backdrop-filter: blur(24px);
  background: rgba(245, 235, 220, 0.55);  /* ← muddy */
  box-shadow: none;
}

/* AFTER */
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  backdrop-filter: blur(var(--kk-il-frost-blur));
  -webkit-backdrop-filter: blur(24px);
  background: rgba(245, 235, 220, 0.78);  /* ← clean beige */
  box-shadow: none;
}
```

**3. Fallback (@supports)** (line ~2241–2242):
```css
/* BEFORE */
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  background: rgba(245, 235, 220, 0.92);

/* AFTER — keep 0.92 (already solid enough) — NO CHANGE NEEDED */
```

**4. Reduced transparency (@media)** (line ~2255–2258):
```css
/* BEFORE */
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  background: rgba(245, 235, 220, 0.92);

/* AFTER — keep 0.92 — NO CHANGE NEEDED */
```

### Contrast Verification (AA)
Text on beige frost uses `--kk-il-text-primary: #2d1608` (espresso brown).

| Background | Text | Contrast |
|------------|------|----------|
| `rgba(245, 235, 220, 0.78)` over dark photo | `#2d1608` | **≥7:1** ✅ AA large + AAA normal |

The raised opacity increases contrast by reducing dark bleed — AA improves, does not degrade.

### Pages Affected
- Dashboard (Home) — `/`
- Catalog List — `/catalog`

Both use `ImmersiveListShell[data-tone="beige"]` and will receive the fix via the shared token/rule.

---

## §B — HeroVisualFrame Tone-Aware Integration

### Problem
The `HeroVisualFrame` / `DashboardHeroFallback` renders as a bright white/cream panel that **pops** as a floating rectangle on the (especially DARK) immersive frost. The palette is warm/on-brand, but the contained bright surface doesn't visually **belong** on the dark frost.

### Current State
**Base `.hero-visual-frame`** (line ~491–500):
```css
.hero-visual-frame {
  background: var(--kaapi-content-surface);  /* warm cream ~#fff7ed */
  border: 1px solid var(--kaapi-content-border);
  box-shadow: var(--kaapi-content-shadow);
}
```

**Fallback gradient** (`DashboardHeroFallback.tsx` line 17):
```tsx
bg-[radial-gradient(circle_at_50%_35%,rgba(245,158,11,0.20),rgba(26,18,9,0.18)_42%,rgba(8,5,3,0.62)_100%)]
```
This fallback gradient is already dark-to-amber — but the outer `HeroVisualFrame` background (cream) overrides it visually because the fallback `fill` mode sets `absolute inset-0` inside the frame.

**Existing tone-aware border/shadow** (lines 2651–2658) adjusts framing but NOT the surface fill.

### Fix — Tone-Aware Surface Fill
Make the `HeroVisualFrame` **surface** adapt to tone:
- **DARK tone:** Use a dark espresso/charcoal surface so the viz blends INTO the dark frost instead of popping as a bright block.
- **BEIGE tone:** Keep the warm cream surface (matches the light frost).

#### CSS Changes

**File:** `frontend/src/index.css` — add surface override (after line ~2658)

```css
/* ── HeroVisualFrame: tone-aware SURFACE in immersive shell ──────────────── */
/* On DARK frost, use a dark espresso surface so the viz frame integrates with
   the dark immersive background rather than popping as a bright cream block.
   BEIGE tone keeps the default warm cream surface. */

.immersive-list-shell[data-tone="dark"] .hero-visual-frame {
  /* Tone-aware surface — dark espresso base */
  background: #1a120c;  /* --kk-tc-surface-solid dark */
  /* Border/shadow already set above — no duplication */
}

/* BEIGE: no surface override needed — default --kaapi-content-surface (cream) is correct */
```

**Rationale for `#1a120c`:**
- Matches `--kk-tc-surface-solid` (dark takeover card solid).
- The fallback gradient inside already transitions from amber → dark charcoal — placing it on a dark surface allows the gradient to read correctly.
- The espresso cup SVG art uses `#f5e6d3` (cream) strokes which will POP correctly on dark background (high contrast).

#### Framing Adjustment (Optional Enhancement)
To further soften containment, reduce the dark-tone box-shadow spread:

```css
/* CURRENT (line ~2652–2653) */
.immersive-list-shell[data-tone="dark"] .hero-visual-frame {
  border-color: rgba(255, 248, 240, 0.08);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

/* ENHANCED — softer shadow, borderless look */
.immersive-list-shell[data-tone="dark"] .hero-visual-frame {
  background: #1a120c;
  border-color: rgba(255, 248, 240, 0.05);  /* ← subtler edge */
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);  /* ← softer depth */
}
```

This makes the frame feel more like an embedded zone than a floating panel.

### Contrast Verification
The SVG espresso art uses cream strokes (`#f5e6d3`) on dark background (`#1a120c`):
- Contrast: **≥10:1** ✅ (exceeds AAA)

The amber accent stroke (`#f59e0b`) on `#1a120c`:
- Contrast: **~6:1** ✅ (AA large text, decorative OK)

Art legibility maintained.

### Summary Table

| Tone | Surface | Border | Shadow | Result |
|------|---------|--------|--------|--------|
| **DARK** | `#1a120c` (espresso) | `rgba(255,248,240,0.05)` | `0 2px 16px rgba(0,0,0,0.25)` | Integrated, not floating |
| **BEIGE** | `var(--kaapi-content-surface)` (cream) | `rgba(92,64,51,0.12)` | `0 4px 16px rgba(92,64,51,0.15)` | Warm inset paper — unchanged |

---

## §E — EntityCard Dark-Tone Presence Boost

### Problem
Glass EntityCards blend too much into the dark immersive frost — low visual presence, hard to distinguish as discrete interactive cards.

### Current State
**EntityCard surface** (from `[data-tone="dark"]` line ~2167):
```css
--kk-tc-surface: rgba(24, 16, 10, 0.72);
--kk-tc-border: 1px solid rgba(255, 247, 237, 0.08);
--kk-tc-bevel-shadow:
  inset 1px 1px 0 0 rgba(255, 247, 237, 0.12),
  inset -1px -1px 0 0 rgba(0, 0, 0, 0.25),
  0 8px 32px -4px rgba(0, 0, 0, 0.5);
```

The 0.08 border opacity and 0.72 surface opacity are subtle — cards disappear into the 0.45 dark frost.

### Fix — Increase Dark-Tone Card Presence
Boost surface opacity, border luminance, and add a subtle outer glow to lift cards off the frost without losing the blended glass feel.

#### CSS Changes

**File:** `frontend/src/index.css` — modify `[data-tone="dark"]` block (lines ~2167–2173)

```css
/* BEFORE */
[data-tone="dark"] {
  /* ... */
  --kk-tc-surface: rgba(24, 16, 10, 0.72);
  --kk-tc-border: 1px solid rgba(255, 247, 237, 0.08);
  --kk-tc-bevel-shadow:
    inset 1px 1px 0 0 rgba(255, 247, 237, 0.12),
    inset -1px -1px 0 0 rgba(0, 0, 0, 0.25),
    0 8px 32px -4px rgba(0, 0, 0, 0.5);

/* AFTER */
[data-tone="dark"] {
  /* ... */
  --kk-tc-surface: rgba(24, 16, 10, 0.78);  /* ← +6% opacity for presence */
  --kk-tc-border: 1px solid rgba(255, 247, 237, 0.12);  /* ← +4% luminance */
  --kk-tc-bevel-shadow:
    inset 1px 1px 0 0 rgba(255, 247, 237, 0.15),  /* ← +3% inner highlight */
    inset -1px -1px 0 0 rgba(0, 0, 0, 0.25),
    0 6px 20px -2px rgba(0, 0, 0, 0.45),  /* ← tighter, stronger lift */
    0 0 0 1px rgba(255, 247, 237, 0.04);  /* ← subtle outer ring */
```

### Rationale
| Change | Before | After | Effect |
|--------|--------|-------|--------|
| Surface opacity | 0.72 | 0.78 | Cards more distinct from frost |
| Border opacity | 0.08 | 0.12 | Visible card edge |
| Inner highlight | 0.12 | 0.15 | Glass bevel catches light |
| Shadow | 8px blur, -4px spread | 6px blur, -2px spread | Tighter lift = more presence |
| Outer ring | none | 0.04 | Subtle definition ring |

### Beige Tone — No Change Needed
The beige EntityCards on beige frost (Fix A raises beige opacity to 0.78) already have sufficient presence. The light-on-light glass reads correctly. If desired, Finn can verify post-deployment and request a beige nudge, but the dark-tone fix is the priority.

### Contrast Verification
Text on boosted dark card (`rgba(24, 16, 10, 0.78)`) uses `--kk-tc-text-primary: #fff7ed`:
- Contrast: **≥12:1** ✅ (exceeds AAA)

Tertiary text (`#c4b5a8`) on the same surface:
- Contrast: **≥5.5:1** ✅ (AA normal)

All AA requirements maintained.

---

## Noted Bugs (Out of Scope — Finn Handles)

1. **Bag monogram shows "RE" wrongly** — data/logic bug, not design.
2. **"Log a shot" primary CTA is weak plain text** — styling/component bug, not design.

These are implementation bugs; no design spec needed.

---

## Implementation Checklist for Finn

- [ ] **Fix A:** Update `rgba(245, 235, 220, 0.55)` → `0.78` in both `[data-tone="beige"]` token AND `#main-content:has(.immersive-list-shell[data-tone="beige"])` rule
- [ ] **Fix B:** Add `.immersive-list-shell[data-tone="dark"] .hero-visual-frame { background: #1a120c; }` after existing border/shadow rule; optionally soften border/shadow
- [ ] **Fix E:** Update `[data-tone="dark"]` tokens: surface 0.72→0.78, border 0.08→0.12, bevel-shadow adjustments
- [ ] Verify both tones on Dashboard + Catalog List at desktop + mobile
- [ ] Confirm AA contrast holds (should improve, not degrade)

---

*End of fix spec.*

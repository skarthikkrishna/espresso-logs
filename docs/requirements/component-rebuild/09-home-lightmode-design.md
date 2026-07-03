# Aria Design Direction — Home Page Light Mode Fix

**Version:** 2.0 (Skill-Chain Upgrade)  
**Date:** 2026-06-19  
**Author:** Aria (Designer)  
**Supersedes:** `07-dashboard-and-beige-fixes.md` §A (that fix was WRONG — do NOT raise frost to 0.78)  

---

## Skills Applied + Evidence

| Skill | What I Checked | Finding / Evidence |
|-------|----------------|-------------------|
| **1. ui-design-contract** | Read `design-language.md` (canonical); verified blur scope rules | Blur permitted ONLY on `#main-content` and modal backdrops (§Liquid Glass Restraint, lines 178–260). Cards/rows/lists MUST be solid surfaces with `--kaapi-content-*` tokens. Current beige frost tint on `#main-content` IS allowed, but value creates monochromatic problem. |
| **2. reuse-before-create** | Searched `index.css` for existing tone tokens | Found: `--kk-il-frost-tint` (L2189), `--kk-tc-back-link` (L1305 — hardcoded, NOT tokenized), `--kk-tc-roast-*-border` (L2208), `--kk-tc-chip-verified/danger` (L1458–1463). Reuse: all color pops exist; back-link needs TOKEN extraction. |
| **3. grill-me** | Explored decision tree; answered own questions via codebase | Q: "Exact light-mode scrim value?" A: Explored photo scrim gradient (L2286) — beige `rgba(245,235,220,0.10–0.14)`. Q: "Does hero need replacement?" A: Explored `DashboardHeroMotion.tsx` import (Dashboard.tsx L8/L158) — operator says REMOVE; 3D optional. |
| **4. design-brief** | Grounded in existing brief (`design-language.md` + `02-principles-northstar.md`) | This repo uses `docs/requirements/component-rebuild/` + `design-language.md` as the brief. Key constraint: "Hybrid base" principle (L36–48) = espresso-dark frame + solid light content surfaces. This IS the Light mode intent — the frost-tint is over-applied. |
| **5. information-architecture** | Applied to home page content hierarchy | StatTiles + actions = ambient chrome on frost (NOT a card cluster). Active Bags / Recent Shots = independent items → individual cards with gaps. Matches CatalogList.tsx pattern (L12–21: each item is an `EntityCard` in grid). |
| **6. design-tokens** | Audited existing tokens, identified GAPS | GAP 1: `--kk-il-frost-tint` beige value too opaque. GAP 2: `--kk-tc-back-link-color` MISSING (hardcoded `#fbbf24`). GAP 3: No neutral scrim token for photo overlay. EXTEND: Add `--kk-il-frost-tint-light-mode: transparent` + `--kk-tc-back-link-color` + `--kk-il-photo-scrim-neutral`. |

---

## Operator Diagnosis Summary (Binding)

The operator paused spec-043 and re-diagnosed the Light mode issue. This diagnosis is **binding** — the prior fix in `07-dashboard-and-beige-fixes.md` §A (raise beige frost 0.55→0.78) is **SUPERSEDED and WRONG**:

1. **A. The background AND card are both getting the beige veil** → monochromatic, no separation.
2. **B. Card-clustering principle:** "When content is clustered together, a singular card is good. Otherwise, gaps are nice — kind of like the catalog summary page."
3. **C. Home light mode "goes almost monochromatic with the lack of color"** — detail pages have color pops (Delete=red, roast chip, espresso-rating=green, extraction-zone=amber). Restore color on home.
4. **D. Back button is fairly unreadable in both dark and light mode** — shared component fix.
5. **E. Rename "Beige Mode" → "Light Mode"** (label + aria-label authorized).
6. **F. Remove 2D DashboardHeroMotion** — rich 3D authorized but optional.

---

## A. Light-Mode Background Layering

### Design-Language Principle (Cited)

> **Liquid Glass Restraint:** "Real blur/glass is confined to chrome, overlays, modals, and sheets. Repeated operational content cards/rows are solid; no `backdrop-filter` on content cards..." (design-language.md L62)

> **Blur scope baseline:** "`backdrop-filter` is allowed only on AppShell/chrome, modal/dialog backdrops, overlays, and sheet chrome." (design-language.md L536–539)

**The `#main-content` frost IS an approved blur surface** — the problem is not blur but the **beige tint value** (`rgba(245,235,220,0.55)`) that combines with the beige photo scrim and beige card surface to produce monochromatic layering.

### Root Cause Diagnosis

| Layer | Current Value (Light) | Problem |
|-------|----------------------|---------|
| Photo scrim | `linear-gradient(rgba(245,235,220,0.10), rgba(245,235,220,0.14))` | Adds beige cast |
| `#main-content` frost | `background: rgba(245,235,220,0.55)` | Adds beige veil |
| EntityCard surface | `rgba(245,235,220,0.78)` | Same warm cream |
| **Result** | Beige + beige + beige | No separation; all surfaces blend |

**Design Intent:** Let the **blurred photo provide moody depth**; the **cream card becomes the elevated bright reading surface** that separates from the atmospheric background.

### Token Changes — Concrete Values

#### 1. `--kk-il-frost-tint` — change to TRANSPARENT

**File:** `frontend/src/index.css` L2189 (in `[data-tone="beige"]` block)

| Token | Current | New |
|-------|---------|-----|
| `--kk-il-frost-tint` | `rgba(245, 235, 220, 0.55)` | `transparent` |
| `--kk-il-frost-tint-solid` | `rgba(245, 235, 220, 0.92)` | UNCHANGED (fallback) |

```css
/* index.css ~L2186–2190 */
[data-tone="beige"] {
  --kk-il-frost-tint: transparent;  /* WAS: rgba(245, 235, 220, 0.55) */
  --kk-il-frost-tint-solid: rgba(245, 235, 220, 0.92);  /* unchanged fallback */
  /* ... */
}
```

#### 2. `#main-content` frost rule — consume token

**File:** `frontend/src/index.css` L2227–2232

```css
/* CURRENT (WRONG) */
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  backdrop-filter: blur(var(--kk-il-frost-blur));
  -webkit-backdrop-filter: blur(24px);
  background: rgba(245, 235, 220, 0.55);  /* ← hardcoded beige veil */
  box-shadow: none;
}

/* NEW — transparent frost, blur only */
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  backdrop-filter: blur(var(--kk-il-frost-blur));
  -webkit-backdrop-filter: blur(24px);
  background: transparent;  /* ← no tint; blur does the work */
  box-shadow: none;
}
```

**Rationale:** Blur softens the photo naturally. The beige veil was over-brightening the entire viewport. By removing it, the blurred photo provides moody depth; the cream EntityCards pop as elevated reading surfaces.

#### 2. Photo scrim — shift to NEUTRAL (not beige)

The `linear-gradient` overlay on the photo currently applies a beige tint (`rgba(245,235,220,0.10–0.14)`). Replace with a **neutral warm-grey** that doesn't compete with the card's cream:

**File:** `frontend/src/index.css` (~lines 2286–2291)

```css
/* CURRENT (adds beige layer) */
.app-bg.bg-dashboard:has(~ main .immersive-list-shell[data-tone="beige"]) {
  background-image:
    linear-gradient(rgba(245, 235, 220, 0.10), rgba(245, 235, 220, 0.14)),
    url('/static/img/hero-dashboard.jpg');
}

/* NEW — neutral warm-grey scrim */
.app-bg.bg-dashboard:has(~ main .immersive-list-shell[data-tone="beige"]) {
  background-image:
    linear-gradient(rgba(180, 170, 160, 0.18), rgba(180, 170, 160, 0.22)),
    url('/static/img/hero-dashboard.jpg');
}
```

Similarly for catalog (~lines 2271–2276):

```css
.app-bg.bg-catalog:has(~ main .immersive-list-shell[data-tone="beige"]) {
  background-image:
    linear-gradient(rgba(180, 170, 160, 0.18), rgba(180, 170, 160, 0.22)),
    url('/static/img/hero-catalog.jpg');
}
```

**Rationale:** `rgba(180, 170, 160, ...)` is a warm taupe-grey — neutral enough to not compete with cream cards, warm enough to stay cohesive with the coffee palette. The opacity (~0.18–0.22) maintains photo legibility while slightly desaturating the blurred image.

**⚠️ OPERATOR CHECK:** The exact neutral scrim value (`180,170,160`) may need tuning. This is a candidate — if it reads too grey or too muddy on the actual photo, try:
- Warmer variant: `rgba(190, 175, 160, 0.16)` (closer to taupe)
- Cooler variant: `rgba(170, 165, 160, 0.20)` (closer to stone grey)

The principle: **neutral, not beige.**

#### 3. `--kk-il-frost-tint` token — set to transparent

The token should reflect the transparent frost. Update in `[data-tone="beige"]` block (~line 2189):

```css
[data-tone="beige"] {
  --kk-il-frost-tint: transparent;  /* was rgba(245, 235, 220, 0.55) */
  --kk-il-frost-tint-solid: rgba(245, 235, 220, 0.92);  /* fallback unchanged */
  /* ... other tokens unchanged */
}
```

#### 4. Fallbacks — no change needed

The `@supports not (backdrop-filter)` and `@media (prefers-reduced-transparency)` fallbacks use solid `0.92` opacity — that's correct for degraded contexts where blur isn't available. Leave unchanged.

#### 5. Dark tone — NO CHANGE

The dark tone (`rgba(24,16,10,0.45)` frost + `0.28–0.32` scrim) is working correctly. Do not regress it.

### AA Expectations

| Surface | Text | Expected Contrast |
|---------|------|-------------------|
| **EntityCard** `rgba(245,235,220,0.78)` | `#2d1608` (espresso) | **≥8:1** ✅ AAA |
| **Background (blurred photo + neutral scrim)** | No text rendered directly on background | N/A |
| **StatTile/SectionHeader** on transparent frost | `--kk-il-text-primary` (`#2d1608`) | Depends on photo — verify visually |

**Note:** Text on the immersive frost (section headers, stat labels) must remain AA. The transparent frost may require ensuring these elements sit on their own surface or have sufficient shadow/outline if the photo beneath is too bright. **Visual verification required** — this is an emergent legibility case.

---

## B. Card-Clustering / Layout Rhythm (Information Architecture Skill)

### Design-Language Principle (Cited)

> **PRINCIPLE 2: Single Surface, Single Layer:** "Content is differentiated by typography and spacing ONLY — NO sub-cards, NO inset wells, NO hairline divider boxes... Sections are separated by vertical whitespace (32px gap), not borders or boxes." (02-principles-northstar.md L59–77)

### Operator Guidance (Binding)

"When content is clustered together, making it a singular card is a good idea. Otherwise, having some gaps is still nice — kind of like the catalog summary page."

### Information Architecture Analysis

| Content Type | Clustering Pattern | Treatment |
|--------------|-------------------|-----------|
| **Tightly related form/data** | High cohesion | → Single card (e.g., detail page = one `TakeoverCard`) |
| **Independent items in collection** | Low cohesion, repeated | → Individual cards with gaps (e.g., catalog grid) |
| **Summary/ambient chrome** | Context, not content | → Directly on frost, no card |

### Dashboard Layout Application

| Zone | Content Type | Treatment | Code Evidence |
|------|--------------|-----------|---------------|
| **Stats row** (3 StatTiles) | Ambient summary | Directly on frost, no wrapper | `Dashboard.tsx` L152–156: StatTiles in `.stat-tile-row` |
| **Hero actions** | Navigation chrome | Directly on frost | `Dashboard.tsx` L160–167: ToneButtons in `.hero-actions` |
| **Active Bags** | Independent collection | Grid of EntityCards with gaps | `Dashboard.tsx` L196: `.entity-card-grid` |
| **Recent Shots** | Independent collection | List of ShotRows with gaps | `Dashboard.tsx` L220+: ShotRow list |

**Verdict: NO structural changes required.** The Dashboard already follows the catalog-list pattern (CatalogList.tsx uses `EntityCard` grid). The problem was color/contrast, not structure. Layout matches principle.

---

## C. Restore Color on Home Light Mode (Design Tokens Skill)

### Design-Language Principle (Cited)

> **Semantic colour usage guide:** "Color is minimal and semantic. Amber (`primary` / `accent`) is the brand and CTA anchor, not a page wash. Cool accents are restrained tools for information, status, taste, chart depth, and approved extraction/depth glints." (design-language.md L138–143)

### Token Audit — Existing Color Pop System

| Element | Token | Value (Light Mode) | Status |
|---------|-------|--------------------|--------|
| **RoastChip Light** | `--kk-tc-roast-light-bg` | `#f5e6d3` (pale cream) | ✅ Exists |
| **RoastChip Medium** | `--kk-tc-roast-medium-bg` | `#a67c52` (copper) | ✅ Exists |
| **RoastChip Dark** | `--kk-tc-roast-dark-bg` | `#3d2314` (espresso) | ✅ Exists |
| **Verified chip** | `--kk-tc-chip-verified-text` | `#166534` (forest green) | ✅ Exists (L1459) |
| **Danger chip** | `--kk-tc-chip-danger-text` | `#b91c1c` (deep red) | ✅ Exists (L1463) |
| **Primary CTA** | `--kk-tc-primary-btn-bg` | `#92400e` (dark amber) | ✅ Exists (L1487) |
| **Monogram tile** | `--kk-tc-monogram-tile-bg` | `rgba(120, 53, 15, 0.10)` | ✅ Exists (L1504) |

**Verdict:** All color-pop tokens EXIST. The monochromatic problem is NOT missing color tokens — it's the beige background drowning out the color differentiation.

### Visual Restoration Logic

Once §A (transparent frost + neutral scrim) is applied:
1. **Cream EntityCards** pop against neutral-blurred photo (separation restored)
2. **RoastChips** pop against cream card surface (e.g., copper Medium chip on cream)
3. **Primary CTAs** (dark amber) contrast against neutral-blurred background
4. **Verified/danger chips** provide semantic color pops within cards

### Potential Adjustments (Post-Build Visual Check)

| Element | Risk | Mitigation (if needed) |
|---------|------|------------------------|
| **Light RoastChip** on cream | Very subtle (pale-on-pale) | Border already exists: `--kk-tc-roast-light-border: rgba(45, 22, 8, 0.2)` (L2208) |
| **StatTile labels** on transparent frost | Photo may compete | Add subtle text-shadow if AA fails visual check |

**No token additions required for §C.** Changes cascade from §A.

---

## D. Back Link Readability (Design Tokens Skill — NEW TOKENS)

### Design-Language Principle (Cited)

> **Reuse before creating:** "Reuse existing DaisyUI v5, Tailwind v4, `espresso-dark`, and documented spec-030/current contract classes such as `.btn-bevel`, `.input-styled`, `.glass-card`... If a new token, class, or pattern seems necessary, route back to Aria before implementation." (ui-design-contract SKILL.md L32–35)

### Problem — Token Audit

**File:** `frontend/src/index.css` L1305–1313

```css
.kk-tc-back-link {
  font-size: 14px;
  color: #fbbf24;  /* ← HARDCODED — violates token audit rule */
  text-decoration: none;
  transition: color 150ms;
}
```

**Gap Identified:** `--kk-tc-back-link-color` does NOT exist. Hardcoded `#fbbf24` fails AA on cream backgrounds (Light mode contrast ratio ≈ 2.5:1 — FAIL).

### Solution — New Token Definitions

**Reuse-before-create check:** Existing `--kk-tc-link` token exists in `.kk-tc--dark` (L1356) but is amber. Need tone-specific back-link tokens.

#### Token Additions

| Token | Dark Value | Light Value | Reuse Source |
|-------|------------|-------------|--------------|
| `--kk-tc-back-link-color` | `#fbbf24` (amber) | `#92400e` (bark) | `--color-secondary` |
| `--kk-tc-back-link-hover` | `#fcd34d` (light amber) | `#78350f` (dark bark) | — |

#### CSS Changes

**In `.kk-takeover-card.kk-tc--dark`** (L1348+):
```css
--kk-tc-back-link-color: #fbbf24;
--kk-tc-back-link-hover: #fcd34d;
```

**In `.kk-takeover-card.kk-tc--beige`** (L1425+):
```css
--kk-tc-back-link-color: #92400e;
--kk-tc-back-link-hover: #78350f;
```

**In `[data-tone="dark"]`** (L2158+):
```css
--kk-tc-back-link-color: #fbbf24;
--kk-tc-back-link-hover: #fcd34d;
```

**In `[data-tone="beige"]`** (L2186+):
```css
--kk-tc-back-link-color: #92400e;
--kk-tc-back-link-hover: #78350f;
```

**Update `.kk-tc-back-link` rule** (L1305):
```css
.kk-tc-back-link {
  font-size: 14px;
  color: var(--kk-tc-back-link-color, #fbbf24);  /* token with fallback */
  text-decoration: none;
  transition: color 150ms;
}
.kk-tc-back-link:hover {
  color: var(--kk-tc-back-link-hover, #fcd34d);
}
```

### Contrast Verification

| Tone | Background | Link Color | Ratio | Verdict |
|------|------------|------------|-------|---------|
| **Dark** | `rgba(24,16,10,0.45)` frost | `#fbbf24` | ~5.5:1 | ✅ AA |
| **Light** | Transparent frost / cream card | `#92400e` | ~7:1 | ✅ AAA |

`#92400e` (bark brown) = existing `--color-secondary` from espresso-dark theme — cohesive, approved.

---

## E. "Light Mode" Rename

### Design-Language Principle (Cited)

> **iOS Readiness:** "Every interactive element is Safari/WebKit-safe... `appearance: none; -webkit-appearance: none`..." (design-language.md L326–336)

Aria-label accessibility is part of iOS Readiness.

### Changes

**File:** `frontend/src/components/tone-system/ToneToggle.tsx` L19–21

```tsx
/* CURRENT */
aria-label={`Switch to ${tone === 'dark' ? 'beige' : 'dark'} tone`}
{tone === 'dark' ? '☕ Beige' : '🌑 Dark'}

/* NEW */
aria-label={`Switch to ${tone === 'dark' ? 'light' : 'dark'} mode`}
{tone === 'dark' ? '☀️ Light' : '🌑 Dark'}
```

### Internal Token Rename: DEFER

| Factor | Assessment |
|--------|------------|
| **Scope** | `data-tone="beige"` in ~30+ CSS rules, 5+ components |
| **Risk** | High — grep/replace across CSS + TSX + tests |
| **Benefit** | Cleaner P2 site-wide light/dark toggle |
| **Operator guidance** | "Preserve the palette snapshot" |

**Decision:** Keep `data-tone="beige"` internally. User-facing label = "Light"; code token = `beige`. Add comment in ToneToggle.tsx:

```tsx
// User-facing: "Light" — internal token remains "beige" for stability (P2 rename candidate)
```

---

## F. Hero Removal & Replacement

### Design-Language Principle (Cited)

> **WebGL Surface Cap:** "Two foreground three.js surfaces plus one shared app-shell `KaapiAmbientLayer` context... Per-card 3D, per-route canvases, modal WebGL, and route-specific ambient canvases remain prohibited." (design-language.md L268–294)

### Operator Directive (Binding)

"Definitely get rid of the 2D monstrosity animation of coffee on the home page."  
"If you want to have 3js, GSAP and some more rich 3D modeling — I'm OK with that."

### Grill-Me Analysis — Hero Replacement Decision Tree

| Question | Explored | Answer |
|----------|----------|--------|
| Is `DashboardHero3D` production-ready? | Viewed component structure | No — basic cup scene, needs polish |
| Does existing code have WebGL fallback? | Checked `DashboardHeroFallback.tsx` exists | Yes — static fallback exists |
| Is hero required for home page function? | Dashboard.tsx L145–168 | No — stats + actions work without viz |
| Time budget for this fix cycle? | Operator context | Light mode fix priority; 3D = separate pass |

**Decision: (a) Clean hero-less layout NOW; (c) Rich 3D as separate prototype.**

### Implementation

**File:** `frontend/src/pages/Dashboard.tsx` L158

```tsx
/* DELETE THIS LINE */
<DashboardHeroMotion maxHeight={240} />
```

**DO NOT delete** the hero component files (`DashboardHeroMotion.tsx`, `DashboardHero3D.tsx`, `DashboardHeroFallback.tsx`, `HeroVisualFrame.tsx`). They become dormant code for future 3D work.

### Hero Zone Layout (Post-Removal)

```
┌─────────────────────────────────────────┐
│  StatTile  │  StatTile  │  StatTile     │  ← stats row
├─────────────────────────────────────────┤
│  [gap]                                  │
├─────────────────────────────────────────┤
│  [Log a shot]   [Manage catalog]        │  ← hero actions
└─────────────────────────────────────────┘
```

More content above the fold. Clean, functional, calm.

---

## Implementation Checklist for Finn

### §A — Background Layering (Highest Priority)

| Task | File | Line(s) | Status |
|------|------|---------|--------|
| Set `--kk-il-frost-tint: transparent` | `index.css` | 2189 | ☐ |
| Change `#main-content` beige rule → `background: transparent` | `index.css` | 2227–2231 | ☐ |
| Replace dashboard photo scrim with neutral `rgba(180,170,160,0.18–0.22)` | `index.css` | 2286–2291 | ☐ |
| Replace catalog photo scrim with neutral `rgba(180,170,160,0.18–0.22)` | `index.css` | 2271–2276 | ☐ |

### §B — Layout

| Task | Status |
|------|--------|
| No change required — existing layout correct | ✅ N/A |

### §C — Color

| Task | Status |
|------|--------|
| Verify RoastChips pop after §A fix | ☐ Visual check |
| Verify StatTile labels AA on transparent frost | ☐ Visual check |

### §D — Back Link

| Task | File | Line(s) | Status |
|------|------|---------|--------|
| Add `--kk-tc-back-link-color` + `hover` to `.kk-tc--dark` | `index.css` | ~1375 | ☐ |
| Add `--kk-tc-back-link-color` + `hover` to `.kk-tc--beige` | `index.css` | ~1455 | ☐ |
| Add tokens to `[data-tone="dark"]` | `index.css` | ~2160 | ☐ |
| Add tokens to `[data-tone="beige"]` | `index.css` | ~2190 | ☐ |
| Update `.kk-tc-back-link` to use tokens | `index.css` | 1305–1313 | ☐ |

### §E — Rename

| Task | File | Line | Status |
|------|------|------|--------|
| Label: `☕ Beige` → `☀️ Light` | `ToneToggle.tsx` | 21 | ☐ |
| aria-label: `beige` → `light` | `ToneToggle.tsx` | 19 | ☐ |
| Add comment re: P2 rename | `ToneToggle.tsx` | top | ☐ |

### §F — Hero

| Task | File | Line | Status |
|------|------|------|--------|
| DELETE `<DashboardHeroMotion maxHeight={240} />` | `Dashboard.tsx` | 158 | ☐ |
| Keep hero files dormant (DO NOT delete) | N/A | — | ✅ N/A |

---

## Stage-2 Design Review Checklist (Post-Build)

After Finn implements, Aria will run this checklist via screenshot + Playwright computed-style assertions.

### Visual Verification (Screenshots)

| Page | Tone | What to Verify |
|------|------|----------------|
| Dashboard | Light | Cream cards pop against neutral-blurred photo; no monochromatic beige |
| Dashboard | Dark | No regression; existing treatment preserved |
| CatalogList | Light | Same fix cascades via shared CSS rules |
| CatalogList | Dark | No regression |
| Any detail page | Both | Back link readable (bark on cream; amber on dark) |

### Playwright Computed-Style Assertions

```typescript
// 1. #main-content frost — Light mode MUST be transparent
await page.goto('/');
await page.locator('[data-testid="tone-toggle"]').click(); // switch to Light
const mainContent = page.locator('#main-content');
const bgColor = await mainContent.evaluate(el => getComputedStyle(el).backgroundColor);
expect(bgColor).toBe('rgba(0, 0, 0, 0)'); // transparent or 'transparent'

// 2. Back link color — Light mode MUST be bark brown (#92400e)
const backLink = page.locator('.kk-tc-back-link').first();
const linkColor = await backLink.evaluate(el => getComputedStyle(el).color);
expect(linkColor).toMatch(/rgb\(146,\s*64,\s*14\)/); // #92400e

// 3. EntityCard surface — Light mode cream opacity
const card = page.locator('.entity-card').first();
const cardBg = await card.evaluate(el => getComputedStyle(el).backgroundColor);
expect(cardBg).toMatch(/rgba\(245,\s*235,\s*220,\s*0\.78\)/);

// 4. Dark mode — no regression
await page.locator('[data-testid="tone-toggle"]').click(); // switch to Dark
const darkFrost = await mainContent.evaluate(el => getComputedStyle(el).backgroundColor);
expect(darkFrost).toMatch(/rgba\(24,\s*16,\s*10,\s*0\.45\)/);
```

### Contrast Checks

| Element | Background | Foreground | Expected Ratio |
|---------|------------|------------|----------------|
| Back link (Light) | Transparent frost | `#92400e` | ≥4.5:1 (AA) |
| Back link (Dark) | `rgba(24,16,10,0.45)` | `#fbbf24` | ≥4.5:1 (AA) |
| Section header (Light) | Transparent frost | `#2d1608` | Visual check (photo-dependent) |
| EntityCard text | `rgba(245,235,220,0.78)` | `#2d1608` | ≥7:1 (AAA) |

---

## Open Questions for Operator

1. **Neutral scrim value:** `rgba(180,170,160,0.18–0.22)` is the candidate warm taupe-grey. After visual test, if it reads too grey/muddy, alternatives:
   - Warmer: `rgba(190, 175, 160, 0.16)`
   - Cooler: `rgba(170, 165, 160, 0.20)`
   
   **Q: Does the candidate value look right on the actual dashboard photo?**

2. **StatTile/SectionHeader on transparent frost:** Text legibility on transparent frost depends on the underlying photo brightness. If AA fails on bright photos, mitigation options:
   - Add subtle `text-shadow: 0 1px 2px rgba(0,0,0,0.15)` to text
   - Add semi-transparent pill background to StatTile labels
   
   **Q: After visual test, are StatTile labels readable? If not, which mitigation preferred?**

---

*End of design direction — Version 2.0 (Skill-Chain Upgrade)*

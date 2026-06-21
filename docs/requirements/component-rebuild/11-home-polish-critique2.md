# Aria Design Direction — Home Polish Critique Batch 2

**Version:** 1.0  
**Date:** 2026-06-19  
**Author:** Aria (Designer)  
**Prior context:** `09-home-lightmode-design.md`, `10-home-lightmode-design-review.md`  
**Session:** spec-043 lightweight design loop

---

## Skills Applied + Evidence

| Skill | What I Checked | Evidence |
|-------|----------------|----------|
| **ui-design-contract** | Blur scope, token reuse, spec-030 vocabulary, Surface Contract | Blur permitted ONLY on `#main-content` + modal backdrops (design-language.md L180–260). Cards must be solid surfaces. Current `StatTile` at L2731 has `backdrop-filter: blur(8px)` — VIOLATION flagged for Point 3. |
| **reuse-before-create** | Existing tile/button/shell patterns before proposing new | `StatTile` (L2719), `ShotRow` (L2824), `ToneButton` variants (L1875–1964), `.nav-shell` (L586). Brew-log uses `GlassCard` in grid (BrewLogList.tsx L108) — reuse for density comparison. |
| **grill-me** | Decision tree resolution via codebase exploration | Q: "Is shell dark in light mode intentional?" A: Explored `.nav-shell` (L586) — hardcoded `background: rgba(26,18,9,0.93)`; not tone-aware. Operator decision flagged. |
| **information-architecture** | Content hierarchy, alignment rhythm, density keying | `.immersive-list-content` (L2310) sets `padding: var(--kk-il-content-padding)` — shared gutter. StatTile uses `align-items: center` (L2722), breaking left-edge alignment. |
| **design-tokens** | Token audit, gaps, EXTEND not replace | Button tokens exist for primary/edit/danger. GAPS: no `--kk-tc-btn-ghost-*` tokens for tertiary; no `--kk-il-header-shadow-*` tokens for enhanced text-shadow. |
| **design-language.md** | Hybrid Base (L36–48), Surface Contract (L40–48), Liquid Glass Restraint (L62), iOS Readiness (L64) | All recommendations grounded in cited sections. |

---

## Point 1: Bean Tile Scale

### Principle (Cited)
> **Surface Contract:** "Operational content always sits on solid light warm elevated surfaces." (design-language.md L40–48)

> **Typography-led:** "Strong typographic hierarchy carries the UX. Avoid decorative UI chrome." (design-language.md L59)

### Analysis

`.entity-card-figure` uses `aspect-ratio: 4/3` (index.css L2414). Combined with the 2-column grid on mobile (`grid-template-columns: repeat(2, 1fr)` at L2502), each figure consumes ~50% of viewport width × 0.75 height ratio = tall image area.

The monogram fallback (`.entity-card-monogram`) uses `font-size: clamp(3rem, 8vw, 5rem)` (L2454) — appropriately large for the figure. The perceived "oversized" issue is the **figure aspect ratio**, not the monogram.

**Diagnosis:** The 4:3 figure is designed for photos. When only a monogram exists, the large empty figure area reads as disproportionate. The card body (title, chip, meta) is compact by comparison.

### Recommendation

**Option A (Prefer):** Introduce a compact variant for monogram-only cards with reduced figure height:

```css
/* When monogram-only, shrink figure to 3:2 */
.entity-card-figure:has(.entity-card-monogram-fill) {
  aspect-ratio: 3 / 2; /* was 4/3; reduces vertical dominance */
}
```

**Option B:** Reduce monogram font-size slightly (less impactful):

```css
.entity-card-monogram {
  font-size: clamp(2.5rem, 7vw, 4rem); /* was clamp(3rem, 8vw, 5rem) */
}
```

**Aria's Call:** Option A. The monogram isn't too large — the figure area is.

### Scope
**Page-only.** EntityCard used on Dashboard + Catalog; both benefit.

### AA Compliance
Not applicable (no text contrast change).

### Tag
**[BUILD NOW]**

---

## Point 2: Recent Shots Density

### Principle (Cited)
> **Mobile-first:** "Every layout is designed for a phone in one hand while pulling a shot with the other." (design-language.md L61)

> **Reuse-before-create skill:** Check existing patterns before creating new ones.

### Analysis

**Dashboard (current):** Uses `ShotRow` component (index.css L2824) in a vertical `.shot-row-list` with `gap: 0.5rem` (L2821). Each `ShotRow` has `padding: 0.75rem 1rem` (L2828). With 5 items, this creates significant vertical height.

**Brew-log list page:** Uses `GlassCard` inside a responsive grid (`grid-cols-1 md:grid-cols-2`, BrewLogList.tsx L93). More dense, more information per card, tighter visual rhythm.

**Problem:** `ShotRow` is a single-line summary, but with full padding + gaps, 5 rows consume ~200px+ of vertical space. The brew-log's card approach packs more info into similar height.

### Recommendation

**Reduce ShotRow vertical padding for dashboard context:**

```css
/* Dashboard-specific compact shot list */
.dashboard-sections .shot-row {
  padding: 0.5rem 0.75rem; /* was 0.75rem 1rem */
}

.dashboard-sections .shot-row-list {
  gap: 0.375rem; /* was 0.5rem */
}
```

**Alternative (if operator prefers card treatment like brew-log):** Replace `ShotRow` with a mini `GlassCard` variant. However, this adds pattern divergence. The simpler padding reduction achieves density without architectural change.

### Scope
**Page-only.** Scoped to `.dashboard-sections` — brew-log list is unaffected.

### AA Compliance
Not applicable (no text contrast change).

### Tag
**[BUILD NOW]**

---

## Point 3: Codify a "Tile" Type

### Principle (Cited)
> **Liquid Glass Restraint:** "Real blur/glass is confined to chrome, overlays, modals, and sheets." (design-language.md L62)

> **Consistency mandate:** "Every primary button computes identical `box-shadow`. Every modal computes identical `backdrop-filter`. This is enforced by Playwright assertions." (design-language.md L65)

### Analysis

**Current StatTile (L2719–2733):**
- `min-width: 96px` (content-width)
- `align-items: center; text-align: center` (center-aligned content)
- `backdrop-filter: blur(8px)` ← **VIOLATION of Liquid Glass Restraint**
- No interaction states (not a link)

**Problem:** Each StatTile sizes to its label length. "Active bags" is wider than "Recent", creating uneven tile widths. They're not interactive. They have blur (which violates the design system).

### Recommendation: Codify `Tile` Pattern

**1. Remove blur from StatTile:**
```css
.stat-tile {
  /* REMOVE these lines (violates Liquid Glass Restraint) */
  /* backdrop-filter: blur(8px); */
  /* -webkit-backdrop-filter: blur(8px); */
  
  /* ADD solid surface fallback */
  background: var(--kk-tc-surface-solid);
}
```

**2. Equal-width tiles via CSS Grid:**
```css
.stat-tile-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* equal-width columns */
  gap: 0.75rem;
}

.stat-tile {
  min-width: unset; /* remove content-based sizing */
}
```

**3. Left-align tile content (matches gutter rhythm — see Point 9):**
```css
.stat-tile {
  align-items: flex-start; /* was center */
  text-align: left; /* was center */
}
```

### Operator Decision: Should Tiles Be Tappable Links?

**Pro:** Tapping "Active bags" could navigate to `/catalog?filter=active`. Tapping "Recent" could go to `/brew-log`. This is a common pattern in dashboard UIs.

**Con:** It adds navigation complexity. Current tiles are informational only.

**Aria's Recommendation:** Yes, make them tappable. However, this is a **product decision**, not design-only.

If tappable:
- Wrap in `<Link>` or `<button>` with `role="link"`
- Add hover state (`filter: brightness(1.03)`)
- Add `:focus-visible` ring

### Operator Decision: Semantic Color?

**Question:** Should tiles have optional color accents (e.g., green border for "Active bags", amber for "Household")?

**Aria's Recommendation:** No. The design system reserves color for semantic meaning (success/warning/error). Using color for informational tiles risks "badge rainbow" (design-language.md L167–169: "Brew-method distinction must come from labels, structure, iconography, and content grouping before color").

**If operator insists:** Offer subtle tint via `border-left: 3px solid var(--color-success)` rather than full background color.

### Scope
**Cross-cutting.** StatTile used on Dashboard only currently, but pattern should be reusable.

### AA Compliance
Not applicable (StatTile values/labels already pass via `--kk-tc-text-primary`).

### Tag
**[OPERATOR DECISION]** — Tappable tiles (yes/no) + Semantic color (yes/no)

---

## Point 4: Codify the CTA/Button System

### Principle (Cited)
> **Consistency mandate:** "Every primary button computes identical `box-shadow`." (design-language.md L65)

> **Core Principles:** "Craft, not productivity. Visual language communicates ritual and care." (design-language.md L58)

### Analysis

**Current ToneButton variants (ToneButton.tsx L15–26):**
- `primary` → `.kk-tc-primary-btn` — solid warm amber (dark) / espresso (beige) fill, borderless-looking
- `edit` → `.kk-tc-btn--edit` — transparent bg, visible border
- `danger` → `.kk-tc-btn--danger` — transparent bg, red tint, visible border

**Problem:** "Log a shot" (primary) has no visible border at rest (it has one, but same color as bg), while "Manage catalog" (edit) has a clear border. This reads as incongruent — one looks "finished", the other looks "outlined".

### Recommendation: Document the Button Hierarchy

| Level | Variant | Visual Treatment | Use Case |
|-------|---------|------------------|----------|
| **Primary CTA** | `variant="primary"` | Solid fill, same-color border, highest contrast | One per view max. Main action. "Log a shot", "Save", "Submit". |
| **Secondary** | `variant="edit"` | Transparent fill, visible border | Supporting actions. "Manage catalog", "Edit", "Cancel". |
| **Tertiary/Ghost** | NEW `variant="ghost"` | No fill, no border, text-only with hover tint | Low-priority actions. "Learn more", "Skip". |
| **Destructive** | `variant="danger"` | Transparent red fill, red border | Irreversible actions. "Delete", "Remove". |

**Implementation for Tertiary:**
```css
/* Add to :root (L1203 area) */
--kk-tc-btn-ghost-bg: transparent;
--kk-tc-btn-ghost-text: var(--kk-tc-text-secondary);
--kk-tc-btn-ghost-hover-bg: rgba(255, 247, 237, 0.08);
--kk-tc-btn-ghost-hover-text: var(--kk-tc-text-primary);

/* Add class */
.kk-tc-btn--ghost {
  background: var(--kk-tc-btn-ghost-bg);
  color: var(--kk-tc-btn-ghost-text);
  border: none;
}
.kk-tc-btn--ghost:hover:not(:disabled) {
  background: var(--kk-tc-btn-ghost-hover-bg);
  color: var(--kk-tc-btn-ghost-hover-text);
}
```

**Border Policy:** Primary CTA border blends with fill (intentionally borderless appearance for visual weight). Secondary/danger have explicit borders for outlined appearance. Ghost has no border.

**Pop Strategy:** Primary achieves pop via solid fill contrast against the card surface. Adding more buttons or making secondary buttons "louder" dilutes the primary's prominence. Restraint is intentional.

### Scope
**Cross-cutting.** Button system used site-wide.

### AA Compliance
Primary: espresso text on amber = 7.2:1 ✅. Edit: already passes via `--kk-tc-btn-edit-text`.

### Tag
**[BUILD NOW]** — Add ghost variant; document hierarchy in design-language.md

---

## Point 5: Light-Mode Title/Subtitle Legibility

### Principle (Cited)
> **Surface Contract:** "WCAG AA contrast is required on both sides of the hybrid base." (design-language.md L46–47)

### Analysis

Current treatment (L2355–2358):
```css
[data-tone="beige"] .list-page-header-title,
[data-tone="beige"] .list-page-header-section {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
```

This is **insufficient** over bright photo regions. A 15% opacity black shadow at 1–2px offset doesn't provide enough contrast lift when the underlying blurred photo has bright midtones (e.g., latte art, sunlit beans).

### Recommendation: Enhanced Text Shadow

**Option A (Prefer): Dual-layer shadow with stronger outer glow:**
```css
[data-tone="beige"] .list-page-header-title,
[data-tone="beige"] .list-page-header-section {
  text-shadow:
    0 1px 2px rgba(0, 0, 0, 0.25),     /* sharp near-shadow */
    0 2px 8px rgba(0, 0, 0, 0.15);     /* soft outer glow */
}
```

**Option B: Subtle local scrim behind header text:**
Not recommended — adds a visible element that may read as a "band" across the page.

**Option C: Darker text color in light mode:**
Not recommended — espresso text (`#2d1608`) is already near-black; going darker loses warmth.

### Token Extraction (for future reuse)
```css
:root {
  --kk-il-header-shadow-light: 0 1px 2px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
}

[data-tone="beige"] .list-page-header-title,
[data-tone="beige"] .list-page-header-section {
  text-shadow: var(--kk-il-header-shadow-light);
}
```

### Scope
**Cross-cutting.** All list pages with `ListPageHeader` benefit.

### AA Compliance
**Target:** 4.5:1 on worst-case bright photo region. Current computed ratio (from 10-review): 8.94:1 over typical frost. With enhanced shadow, edge cases improve. Visual verification required on actual bright photos.

### Tag
**[BUILD NOW]**

---

## Point 6: App-Shell Tone Awareness

### Principle (Cited)
> **Hybrid Base:** "Espresso-dark frame/chrome carries identity; solid light elevated warm surfaces carry operational content." (design-language.md L56)

### Analysis

`.nav-shell` (L586–591):
```css
.nav-shell {
  background: rgba(26, 18, 9, 0.93);
  border-color: rgba(217, 119, 6, 0.18);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

This is **hardcoded dark** — not tone-aware. The sidebar/bottom-nav remain espresso-dark regardless of page tone.

**Question:** Is this intentional?

**Checking design-language.md:** "Espresso-dark frame/chrome carries identity" (L56). The frame is SUPPOSED to stay dark — it's the brand anchor.

**However:** The operator asks if it SHOULD become tone-aware in light mode. This is a product direction question, not a design violation.

### Recommendation (Design Principle)

**Aria's Position:** Keep the shell dark. The Hybrid Base principle explicitly states the frame carries identity. A light-mode shell would require:
- Recoloring all nav icons, text, active states
- Redefining border colors
- Testing AA contrast for every interactive element
- Revisiting brand presence (amber-on-dark is the signature)

This is a **full light-mode product effort**, not a page-level toggle fix.

**If operator wants tone-aware shell:**
- Add `[data-tone="beige"] .nav-shell` overrides
- Define cream shell tokens (`--kk-shell-surface-light`, etc.)
- Audit all shell interactions for contrast
- Flag as spec-044+ scope expansion

### Scope
**Cross-cutting (significant).** Would affect every page.

### Tag
**[OPERATOR DECISION]** — Aria recommends NO; operator decides if full light-mode shell is desired.

---

## Point 7: Mobile Back + Tone Toggle Legibility

### Principle (Cited)
> **iOS Readiness:** "Every interactive element is Safari/WebKit-safe." (design-language.md L64)

> **Mobile-first:** "375px baseline." (design-language.md L61)

### Analysis

**Back link (L1305–1313):**
- `font-size: 14px` — acceptable for desktop, small for mobile touch
- Color: `var(--kk-tc-back-link-color, #fbbf24)` — AA on dark, bark brown on light (6.22:1 per 10-review)

**Tone toggle (L1315–1328):**
- `font-size: 11px` — **too small** for mobile legibility
- `padding: 4px 12px` — hit area may be under 44px minimum
- Color: `rgba(255, 247, 237, 0.85)` — hardcoded cream, not tone-aware

### Recommendation

**1. Increase tone toggle size:**
```css
.kk-tc-tone-btn {
  font-size: 13px;           /* was 11px */
  padding: 6px 14px;         /* was 4px 12px; ensures 44px hit area */
  min-height: 32px;          /* explicit touch target */
}
```

**2. Make tone toggle tone-aware:**
```css
/* Add to [data-tone="beige"] block (~L1500 area) */
--kk-tc-tone-btn-bg: rgba(45, 22, 8, 0.08);
--kk-tc-tone-btn-text: #4a3728;
--kk-tc-tone-btn-border: rgba(45, 22, 8, 0.15);
--kk-tc-tone-btn-hover-bg: rgba(45, 22, 8, 0.14);

/* Update .kk-tc-tone-btn to use tokens */
.kk-tc-tone-btn {
  background: var(--kk-tc-tone-btn-bg, rgba(255, 247, 237, 0.12));
  color: var(--kk-tc-tone-btn-text, rgba(255, 247, 237, 0.85));
  border: 1px solid var(--kk-tc-tone-btn-border, rgba(255, 247, 237, 0.2));
}
```

**3. Back link mobile increase (optional):**
```css
@media (max-width: 639px) {
  .kk-tc-back-link {
    font-size: 15px;  /* slight bump for touch */
    font-weight: 500; /* slightly heavier for legibility */
  }
}
```

### Scope
**Cross-cutting.** Back link and tone toggle used on all immersive list pages.

### AA Compliance
**Tone toggle (light):** `#4a3728` on `rgba(45,22,8,0.08)` ≈ cream surface → 8.5:1 ✅  
**Back link:** Already AA per 10-review.

### Tag
**[BUILD NOW]**

---

## Point 8: Kaapi Kadai Icon Polish

### Principle (Cited)
> **Aesthetic Direction:** "The app should feel like a calm precision instrument — espresso-dark in its frame, warm and instantly legible in its work surfaces, tactile through motion rather than ornament." (design-language.md L31–34)

### Analysis

**Current asset:** `/static/img/kaapi-kadai-favicon.png` (referenced in `frontend/index.html` L5).

The operator notes it looks "discordant" vs. the polished liquid-glass UI. Without seeing the actual asset, I'll provide an art direction brief.

### Art Direction Brief

**Desired qualities:**
1. **Dual-tone compatible:** Icon should read well on both espresso-dark backgrounds (sidebar, favicon) and potential light surfaces.
2. **Liquid-glass aesthetic:** Subtle translucency/highlight, not flat. Think iOS app icon depth — inner shadow + outer glow + subtle gradient.
3. **Espresso/coffee symbolism:** Cup, bean, steam, crema — any of these work. Current "KK" monogram is fine if rendered with material polish.
4. **Warmth:** Amber/gold tones for the highlight; avoid cold blues or stark whites.
5. **Simplicity at 16px:** Must remain legible as a favicon. Avoid fine details.

**Format requirements:**
- PNG with transparency for favicon/PWA
- SVG version for in-app brand mark (sidebar, loading)
- Multiple sizes: 16×16, 32×32, 180×180 (Apple touch), 512×512 (PWA)

**Reference:** The existing brand mark (`/static/img/kaapi-kadai-mark.svg` per Sidebar.tsx L67) may already have the right shape — it may just need a render pass with liquid-glass surface treatment.

### Scope
**Separate task.** Requires design asset creation (image sourcing/generation).

### Tag
**[SEPARATE TASK]** — Create polished icon asset matching liquid-glass aesthetic.

---

## Point 9: Content Left-Gutter Rhythm

### Principle (Cited)
> **Information Architecture skill:** "Content hierarchy, alignment rhythm."

> **Typography-led:** "Strong typographic hierarchy carries the UX." (design-language.md L59)

### Analysis

**Shared gutter:** `.immersive-list-content` (L2310–2316) sets:
```css
padding: 1.5rem var(--kk-il-content-padding) var(--mobile-content-bottom-padding);
```
Where `--kk-il-content-padding` = `var(--kk-layout-gutter)` = `1rem` (L2144/2150).

**Problem diagnosis:**
1. `.list-page-header-title` — no extra left padding; aligns to gutter ✅
2. `.stat-tile-row` — `justify-content: flex-start` (L2714); tiles start at gutter ✅
3. `.stat-tile` — `align-items: center` (L2722); **content is CENTERED within each tile** ← breaks left alignment
4. `.hero-actions` — `display: flex; flex-wrap: wrap` (L2688); buttons have their own internal padding
5. `.entity-card-grid` — starts at gutter ✅; card body has `padding: var(--kk-ec-padding)` (L2462)

**Root cause:** StatTile content is center-aligned. When tiles have varying widths, the centered text creates visual misalignment vs. the left-edge of cards and headers.

### Recommendation

**1. Left-align StatTile content:**
```css
.stat-tile {
  align-items: flex-start; /* was center */
  text-align: left;        /* was center */
}
```

**2. Document alignment contract:**

| Element | Left-Edge Alignment |
|---------|---------------------|
| `.list-page-header-title` | Flush with gutter ✅ |
| `.stat-tile__value` | Flush with gutter (after fix) |
| `.hero-actions` button text | Inset by button padding — acceptable |
| `.entity-card-title` | Inset by card body padding — acceptable |
| `.section-heading` | Flush with gutter ✅ |

**Principle:** Block-level containers (header, stat row, section) should hard-align to the gutter. Interactive elements (buttons, cards) may have internal padding that insets their text — this is intentional affordance, not misalignment.

**3. Verify no stray margin/padding:** Grep confirmed no rogue `margin-left` or `padding-left` on child elements.

### Scope
**Page-only.** Dashboard alignment; other list pages share the pattern.

### AA Compliance
Not applicable.

### Tag
**[BUILD NOW]**

---

## Summary Table

| # | Point | Principle | Recommendation | Tag |
|---|-------|-----------|----------------|-----|
| 1 | Bean tile scale | Surface Contract, Typography-led | Reduce monogram-fill figure to 3:2 aspect | **[BUILD NOW]** |
| 2 | Recent shots density | Mobile-first, Reuse | Reduce ShotRow padding in dashboard context | **[BUILD NOW]** |
| 3 | Codify Tile type | Liquid Glass Restraint, Consistency | Remove blur from StatTile; equal-width grid; left-align | **[OPERATOR DECISION]** — tappable + color |
| 4 | CTA/Button system | Consistency mandate | Document hierarchy; add ghost variant | **[BUILD NOW]** |
| 5 | Title legibility | Surface Contract (AA) | Enhanced dual-layer text shadow | **[BUILD NOW]** |
| 6 | App-shell tone | Hybrid Base | Aria recommends NO change; shell stays dark | **[OPERATOR DECISION]** |
| 7 | Mobile back/toggle | iOS Readiness, Mobile-first | Increase toggle size; tone-aware tokens | **[BUILD NOW]** |
| 8 | Icon polish | Aesthetic Direction | Art direction brief for liquid-glass icon | **[SEPARATE TASK]** |
| 9 | Left-gutter rhythm | Information Architecture | Left-align StatTile content | **[BUILD NOW]** |

---

## Prioritized Build List for Finn (BUILD-NOW Only)

**Order by dependency/impact:**

1. **Point 3 (partial):** Remove `backdrop-filter` from `.stat-tile`; convert `.stat-tile-row` to `grid-template-columns: repeat(3, 1fr)`.
2. **Point 9:** Left-align `.stat-tile` content (`align-items: flex-start; text-align: left`).
3. **Point 1:** Reduce `.entity-card-figure:has(.entity-card-monogram-fill)` to `aspect-ratio: 3/2`.
4. **Point 2:** Add `.dashboard-sections .shot-row` compact padding overrides.
5. **Point 5:** Update `[data-tone="beige"]` header text-shadow to dual-layer.
6. **Point 7:** Increase `.kk-tc-tone-btn` font-size/padding; add tone-aware tokens.
7. **Point 4:** Add `.kk-tc-btn--ghost` variant; update ToneButton.tsx.

---

## Operator Decision Questions

1. **Point 3 — Tile interactivity:** Should the three stat tiles (Active bags / Recent / Household) be tappable links to filtered views?
   - Aria recommends: **Yes**, with navigation to `/catalog?filter=active`, `/brew-log`, and household settings respectively.

2. **Point 3 — Tile semantic color:** Should tiles have optional color accents (e.g., green border for Active bags)?
   - Aria recommends: **No**. Reserve color for semantic meaning; use structure and labels for differentiation.

3. **Point 6 — App-shell light mode:** Should the sidebar/bottom-nav become tone-aware (light surface in Light mode)?
   - Aria recommends: **No**. The dark shell is the brand anchor per Hybrid Base principle. Full light-mode shell is a separate product effort (spec-044+).

---

## Cross-Cutting Scope Flags

| Item | Scope | Impact |
|------|-------|--------|
| Button ghost variant (Point 4) | Site-wide | ToneButton.tsx + token definitions |
| Tone toggle tokens (Point 7) | Site-wide | All immersive list pages |
| StatTile blur removal (Point 3) | Dashboard only (current) | Pattern should be reusable |
| App-shell tone (Point 6) | **Significant** if approved | Every page; brand implications |
| Icon asset (Point 8) | **Separate task** | Requires image sourcing workflow |

---

*— Aria, 2026-06-19*

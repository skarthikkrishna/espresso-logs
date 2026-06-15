# Aria Foundation Fixes + List-vs-Detail North-Star

**Spec:** 043 → Foundation Regression Fixes + Architectural North-Star  
**Prepared by:** Aria (Designer)  
**Date:** 2026-06-15  
**Status:** FIX-SPEC + DESIGN NORTH-STAR ADDENDUM  
**References:** aria-principles-northstar.md, northstar-screenshots/, operator decision drop 2026-06-15T12-10-33

---

## §A — FIX-SPEC: 4 Detail-Page Regressions

The refactor onto the shared `tone-system` component library introduced 4 regressions from the approved northstar. These must be restored before the list-phase rollout proceeds.

---

### Fix #1: Catalog Detail Lost the Monogram Tile Style

**Problem:** The extracted `TitleIcon` placeholder regressed. The northstar (catalog-dark-desktop.png, catalog-beige-desktop.png) shows a 64×64 rounded-rect tile with:
- Tinted warm background (tone-aware: translucent espresso on DARK, translucent amber on BEIGE)
- A centered **monogram letter** (first letter of bean name) OR the ☕ fallback
- The monogram letter uses display font weight, warm amber/espresso color

**Current state:** `.kk-tc-title-icon-placeholder` renders a simple square with a ☕ emoji fallback, but:
- The monogram letter logic is MISSING — the placeholder always shows ☕, never the bean's first letter
- The background tint is too subtle (12% primary)
- The icon/letter lacks the proper styling (should be large, display-weighted, warm-colored)

**Intended design (from northstar):**

| Aspect | DARK Tone | BEIGE Tone |
|--------|-----------|------------|
| Tile size | 64×64px, 8px radius | Same |
| BG (no image) | `rgba(245, 158, 11, 0.15)` — warm amber tint | `rgba(120, 53, 15, 0.10)` — espresso tint |
| BG (with image) | `color-mix(in srgb, var(--kk-tc-text-primary) 8%, transparent)` (subtle fallback while loading) | Same |
| Monogram letter | 24px, font-weight 700, `--kk-tc-text-primary` | Same |
| ☕ fallback | Shown ONLY when no bean name exists | Same |

**Component/token changes for Finn:**

1. **TitleIcon.tsx** — Add an optional `monogram?: string` prop:
   ```tsx
   interface TitleIconProps {
     src?: string | null
     alt?: string
     monogram?: string // If set, show this letter instead of fallback
     fallback?: ReactNode // Still available as escape hatch (defaults to ☕)
     // ... rest
   }
   ```
   Placeholder render:
   ```tsx
   <div className="kk-tc-title-icon-placeholder">
     {monogram ? (
       <span className="kk-tc-title-icon-monogram">{monogram}</span>
     ) : (
       fallback ?? <span aria-hidden="true">☕</span>
     )}
   </div>
   ```

2. **index.css** — Add `.kk-tc-title-icon-monogram` class + adjust placeholder BG tokens:
   ```css
   .kk-tc-title-icon-placeholder {
     /* ... existing size/radius ... */
     background: var(--kk-tc-monogram-tile-bg); /* NEW TOKEN */
     /* ... */
   }
   .kk-tc-title-icon-monogram {
     font-size: 1.5rem;
     font-weight: 700;
     font-family: var(--font-display);
     color: var(--kk-tc-text-primary);
     user-select: none;
   }
   ```

3. **Tone token additions** (in the `:root` and `.kk-tc--dark`/`.kk-tc--beige` blocks):
   ```css
   .kk-tc--dark {
     --kk-tc-monogram-tile-bg: rgba(245, 158, 11, 0.15); /* warm amber */
   }
   .kk-tc--beige {
     --kk-tc-monogram-tile-bg: rgba(120, 53, 15, 0.10); /* warm espresso */
   }
   ```

4. **CatalogDetail.tsx** — Pass monogram prop:
   ```tsx
   <TitleIcon
     src={item.image_path && item.image_path !== brokenImageSrc ? item.image_path : null}
     alt={item.bean_name}
     monogram={item.bean_name?.charAt(0)?.toUpperCase()}
     onError={() => setBrokenImageSrc(item.image_path!)}
   >
   ```

**Contrast verification (AA):**
- Monogram letter `--kk-tc-text-primary` on amber-tinted BG: ≈7:1 DARK, ≈8:1 BEIGE ✓

---

### Fix #2: Brew-Log Detail Needs Monogram/Bean Icon Next to Title

**Problem:** Brew-log detail (brewlog-dark-desktop.png, brewlog-beige-desktop.png) currently shows just the title stack (`TitleBlock`) with NO icon beside it. Catalog detail HAS the icon — this is a consistency gap.

**Intended design:** Brew-log detail title section should have the same flex layout as catalog:
- Left: `TitleIcon` (64×64 tile) showing either:
  - The associated bean's image (if brew-log entry references a bean with an image), OR
  - A monogram of the bean name, OR
  - ☕ fallback (if no bean association)
- Right: `TitleBlock` (title = `shot.bag_display`, subtitle = `shot.date`)

**Data source for icon:**
- Brew-log entries reference a bag/bean via `shot.bag_display` (e.g., "PW_TEST_Roaster — PW_TEST_Bean")
- The API does NOT currently return a bean image URL for brew-log entries — this would require an API join or a lookup
- **Pragmatic decision:** Use a **monogram** derived from `shot.bag_display` (first letter of the BEAN portion, which is after the " — " separator, or first letter of the whole string if no separator)

**Component changes for Finn:**

1. **BrewLogDetail.tsx** — Wrap title section with icon:
   ```tsx
   // Helper to extract bean portion for monogram
   const beanMonogram = useMemo(() => {
     if (!shot.bag_display) return undefined
     const parts = shot.bag_display.split(' — ')
     const beanName = parts.length > 1 ? parts[1] : parts[0]
     return beanName?.charAt(0)?.toUpperCase()
   }, [shot.bag_display])

   // In JSX:
   <Section isTitle>
     <div className="flex items-start gap-4">
       <TitleIcon monogram={beanMonogram} />
       <TitleBlock title={shot.bag_display} subtitle={shot.date} />
     </div>
   </Section>
   ```

2. **Section.tsx** (if needed) — The `isTitle` section already uses flex. Verify the flex container CSS `.kk-tc-section--title` includes `align-items: flex-start` and appropriate gap.

**No new tokens needed** — reuses the monogram tile system from Fix #1.

---

### Fix #3: Markdown Heading Hierarchy Inverted

**Problem:** In the AI Feedback section, the LLM-generated markdown's own heading (e.g., "Shot Analysis & Recommendation") renders as LARGE serif text (1.375em = ~21px on base 15px) — **bigger and more prominent than the section header** ("AI FEEDBACK" at 13px uppercase). This inverts the hierarchy: the section header should be the anchor; markdown content should sit UNDER it.

**Northstar reference:** brewlog-dark-desktop.png shows "AI FEEDBACK" as the dominant structural label, with the AI content below it as readable prose — not competing for attention.

**Root cause:** Current `.kk-tc-markdown h1` is `1.375em` with no ceiling. The section header is `0.8125rem` (13px). The markdown h1 is larger than the section header.

**Intended design:** Markdown headings within `.kk-tc-markdown` must:
1. Use **body font** (`var(--font-body)`, i.e., Inter), NOT display font
2. Scale **modestly** — h1 should be no larger than body size + 10%
3. Have **muted weight** (500, not 600/700) to read as sub-structure
4. Never compete visually with `.kk-tc-section-header`

**Token/CSS changes for Finn:**

```css
/* Replace the current heading rules in index.css under .kk-takeover-card .kk-tc-markdown */

.kk-takeover-card .kk-tc-markdown h1,
.kk-takeover-card .kk-tc-markdown h2,
.kk-takeover-card .kk-tc-markdown h3,
.kk-takeover-card .kk-tc-markdown h4,
.kk-takeover-card .kk-tc-markdown h5,
.kk-takeover-card .kk-tc-markdown h6 {
  font-family: var(--font-body); /* NOT display — body font only */
  color: var(--kk-tc-text-secondary); /* Muted, not primary */
  font-weight: 500; /* Reduced from 600 */
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  line-height: 1.35;
}

/* Modest scale: h1 = body+10%, h2 = body+5%, h3-h6 = body or smaller */
.kk-takeover-card .kk-tc-markdown h1 { font-size: 1.1em; }  /* was 1.375em */
.kk-takeover-card .kk-tc-markdown h2 { font-size: 1.05em; } /* was 1.25em */
.kk-takeover-card .kk-tc-markdown h3 { font-size: 1em; }    /* was 1.125em */
.kk-takeover-card .kk-tc-markdown h4,
.kk-takeover-card .kk-tc-markdown h5,
.kk-takeover-card .kk-tc-markdown h6 { font-size: 0.9375em; }
```

**Rationale:** The section header is the structural anchor (uppercase, tracking, tertiary color). Markdown headings are *content* headings — they organize the prose but should not compete with the page structure. By capping h1 at 1.1em (≈16.5px) and using body font + muted weight, they read as sub-headings within the section, not competing landmarks.

**Contrast verification:** `--kk-tc-text-secondary` on glass surface: ≈7:1 DARK, ≈5.5:1 BEIGE ✓

---

### Fix #4: Extraction Readout Spacing Broken

**Problem:** The extraction readout (the "highlight" of brew-log detail per operator) has lost its spacing:
- "Brew ratio1:1.9" — label and value jammed together, no gap
- "Extraction zoneSweet & balancedIdeal extraction" — the zone chip, zone label, and guidance text all run together with no margins

**Northstar reference:** brewlog-dark-desktop.png shows:
- "BREW RATIO" eyebrow label, then `1:2.0` value on its own line with clear vertical separation
- "EXTRACTION ZONE" eyebrow label, then the zone chip ("Sour" in yellow), then guidance text below with margin

**Root cause:** The current CSS resets in `.kk-takeover-card .kk-extraction-readout` removed padding/border/margin-top, but the component's internal structure relies on `flex-direction: column` + `gap: 0.35rem` which may have been overridden or insufficient. Also, the zone chip inline rendering lacks explicit margin.

**Component/CSS changes for Finn:**

1. **index.css** — Ensure internal structure gaps are preserved under takeover-card:
   ```css
   .kk-takeover-card .kk-extraction-readout {
     border: none;
     background: transparent;
     padding: 0;
     margin-top: 0;
     color: var(--kk-tc-text-primary);
     /* Preserve grid gap from base */
     gap: 0.75rem;
   }

   .kk-takeover-card .kk-extraction-readout__metric,
   .kk-takeover-card .kk-extraction-readout__zone {
     display: flex;
     flex-direction: column;
     gap: 0.35rem; /* RESTORE internal gap */
   }

   /* Zone chip needs inline margin when followed by guidance */
   .kk-takeover-card .kk-zone-chip {
     margin-bottom: 0.25rem; /* breathing room above guidance */
   }

   .kk-takeover-card .kk-extraction-readout__guidance {
     margin-top: 0.25rem; /* additional separation from chip */
   }
   ```

2. **ExtractionReadout.tsx** — Verify structure is:
   ```
   .kk-extraction-readout (grid, gap 0.75rem)
     └─ .kk-extraction-readout__metric (flex-col, gap 0.35rem)
          └─ __eyebrow (BREW RATIO)
          └─ __value (1:2.0)
     └─ .kk-extraction-readout__zone (flex-col, gap 0.35rem)
          └─ __eyebrow (EXTRACTION ZONE)
          └─ .kk-zone-chip (Sweet & balanced)
          └─ __guidance (text — if present)
   ```
   The JSX is correct — the issue is CSS cascade. Finn should verify that `.kk-takeover-card .kk-extraction-readout__metric` rules are not being overridden by a more specific selector or reset.

**Specific check:** Inspect whether any `:not()` or cascade issue is nullifying the `gap` property. Add `!important` temporarily to debug, then remove once cascade is fixed.

---

## §B — List-vs-Detail North-Star + Card-less Immersive LIST Shell

### The Operator's North-Star (verbatim)

> "The detail view of anything - Hardware, household, brew log, catalog bean etc and any cards on the UI, catalog cards, hardware cards, home page cards, etc should follow the glass design you have going on. For the 'main' or summary pages just listing things - it should continue to feel immersive and blended by just adding a blur on the background and having everything without a card (like it is today in prod, but with the aesthetic guidelines of our new workstream)."

### Architectural Primitive: List vs Detail vs Entity Card

This north-star defines three distinct surface treatments:

| Surface Type | Treatment | Examples |
|--------------|-----------|----------|
| **DETAIL pages** | Glass takeover card (existing system: `.kk-takeover-card` with bevel, blur, single glass surface) | Brew-log detail, Catalog bean detail, Hardware detail, Household detail |
| **ENTITY CARDS** (anywhere) | Glass card treatment (same visual language: blur, bevel, translucent surface) — but SMALLER, discrete, reusable | Catalog cards on list page, Hardware cards, Dashboard/home cards |
| **LIST / SUMMARY pages** | Card-less immersive shell: blurred background, content sits directly ON the blurred surface, NO page-level takeover card | Brew-log list, Catalog list, Hardware list, main/home screens when showing lists |

### Resolution: Entity Cards ON a Card-less List Page

The operator's statement contains an apparent tension:
- "entity cards should follow the glass design" → entity items ARE glass cards
- "list pages should be without a card" → the PAGE has no wrapper card

**Resolution (Aria's interpretation, confirmed by northstar intent):**

On a LIST page (e.g., Catalog list showing multiple beans):
1. The **PAGE** has NO takeover card — it's an immersive, card-less shell
2. The **ENTITY ITEMS** (each bean card, each hardware card) ARE rendered as discrete **glass EntityCards** sitting on the immersive background
3. The glass EntityCards use the SAME visual language (blur, bevel, translucent surface) as the detail page takeover card — but scoped to each item, not full-page

**Visual model:**
```
┌─────────────────── viewport ───────────────────────┐
│ .app-bg (route photo, blurred at page level)       │
│ ┌─────────────────────────────────────────────────┐│
│ │ Page header: "Catalog" / "COFFEE LIBRARY"       ││  ← sits on blur, no card
│ │                                                 ││
│ │ ┌───────────┐  ┌───────────┐  ┌───────────┐    ││  ← EntityCards (glass)
│ │ │ Bean 1    │  │ Bean 2    │  │ Bean 3    │    ││
│ │ │ (glass)   │  │ (glass)   │  │ (glass)   │    ││
│ │ └───────────┘  └───────────┘  └───────────┘    ││
│ │                                                 ││
│ └─────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────┘
```

**This reconciles the operator's two statements:**
- The PAGE is "without a card" — the immersive blur is the page surface
- Entity items ARE "glass" — each EntityCard is a mini-glass takeover

### The Card-less Immersive LIST Shell

**Re-scoping the Option-B work:** The earlier Option-B contract (`aria-contract-v2-optionB-r2.md`) specified a card-less full-bleed frosted treatment for DETAIL pages. This was mis-scoped — detail pages use the glass takeover card. However, that work is NOT wasted: the card-less frosted treatment IS the correct model for LIST pages.

**List Shell Specification:**

1. **Background:** Route photo with **page-level blur** applied via CSS:
   ```css
   .kk-list-shell {
     position: relative;
     min-height: 100vh;
   }
   .kk-list-shell::before {
     content: '';
     position: absolute;
     inset: 0;
     background: inherit; /* or set explicitly per route */
     filter: blur(24px);
     z-index: -1;
   }
   ```
   Or use `backdrop-filter` on a full-page frosted layer (simpler).

2. **Page-level frost:** A translucent overlay that sits on the blurred background:
   ```css
   .kk-list-shell__frost {
     background: var(--kk-list-frost-tint); /* tone-aware */
     min-height: 100vh;
     padding: var(--kk-list-padding);
   }
   ```
   Token values:
   - DARK: `rgba(24, 16, 10, 0.45)` — warm espresso tint over blurred photo
   - BEIGE: `rgba(245, 235, 220, 0.55)` — warm cream tint over blurred photo

3. **Content sits directly on frost:** Headers, filters, and list content have NO card wrapper. They use the same typography tokens (`--kk-tc-*`) with verified contrast against the frosted surface.

4. **Entity cards ARE glass:** Each list item uses a **glass EntityCard** component:
   ```css
   .kk-entity-card {
     background: var(--kk-tc-surface);
     backdrop-filter: blur(var(--kk-tc-blur));
     border-radius: var(--kk-tc-card-radius);
     box-shadow: var(--kk-tc-bevel-shadow);
     padding: var(--kk-tc-card-padding);
   }
   ```
   These are scoped cards (not full-page takeover) but use the SAME glass tokens.

5. **Legibility:** The page-level frost + entity card glass creates a double-layer effect. AA is maintained because:
   - Page-level frost is lighter (0.45–0.55 alpha) to not compete with card glass
   - Entity card glass uses the existing verified takeover surface values
   - Text ON the page (headers, filters, empty states) uses `--kk-tc-text-*` tokens against the frost, which must pass AA — frost tint must be high enough

### Legibility Verification for List Shell

| Element | Surface | Text Token | DARK Contrast | BEIGE Contrast |
|---------|---------|------------|---------------|----------------|
| Page header | Frost layer | `--kk-tc-text-primary` | ≥8:1 | ≥7:1 |
| Filter/meta | Frost layer | `--kk-tc-text-secondary` | ≥5:1 | ≥4.5:1 |
| Entity card title | EntityCard glass | `--kk-tc-text-primary` | ≥12:1 | ≥11:1 |
| Entity card meta | EntityCard glass | `--kk-tc-text-tertiary` | ≥6:1 | ≥5:1 |

The frost layer needs a solid fallback (`--kk-list-frost-solid`) for `@supports not (backdrop-filter)` and `prefers-reduced-transparency`.

### Principles Northstar Addendum

Add to **aria-principles-northstar.md** under Principle 2 (Single Surface):

---

**PRINCIPLE 2B: List Shell vs Detail Shell — Page Surface Architecture**

**Statement:** The app has TWO shell types:
1. **DETAIL SHELL** — A glass takeover card containing ALL page content (existing Principle 2)
2. **LIST SHELL** — A card-less immersive surface where content sits on a blurred/frosted page background, with entity items rendered as discrete glass EntityCards

**Application Rule:**
- Detail pages (single-entity view: brew-log detail, catalog bean, hardware detail, household detail) use the DETAIL SHELL (glass takeover card)
- List pages (multi-entity listing: brew-log list, catalog list, hardware list, dashboard) use the LIST SHELL (card-less immersive + glass EntityCards)
- Entity cards on list pages use the SAME glass visual language as the detail takeover card (blur, bevel, translucent surface) but scoped to each item

**Violation Examples:**
- List page with a full-page takeover card wrapping the list ❌
- Detail page without a takeover card (content floating on blur) ❌
- List page where entity items are NOT glass cards (e.g., flat rows with no surface treatment) ❌
- Entity cards using a DIFFERENT visual language than detail takeover cards ❌

---

### EntityCard Component Specification

A new reusable component for the rollout:

```tsx
// frontend/src/components/tone-system/EntityCard.tsx
interface EntityCardProps {
  children: ReactNode
  className?: string
  'data-testid'?: string
}

export function EntityCard({ children, className, 'data-testid': testId }: EntityCardProps) {
  return (
    <div className={['kk-entity-card', className].filter(Boolean).join(' ')} data-testid={testId}>
      {children}
    </div>
  )
}
```

CSS:
```css
.kk-entity-card {
  background: var(--kk-tc-surface);
  backdrop-filter: blur(var(--kk-tc-blur));
  -webkit-backdrop-filter: blur(var(--kk-tc-blur));
  border-radius: 12px; /* slightly smaller than takeover */
  box-shadow: var(--kk-tc-bevel-shadow);
  padding: 1rem 1.25rem;
  color: var(--kk-tc-text-primary);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.kk-entity-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--kk-tc-bevel-shadow), 0 8px 24px rgba(0,0,0,0.12);
}

/* Fallback for no blur */
@supports not (backdrop-filter: blur(1px)) {
  .kk-entity-card {
    background: var(--kk-tc-surface-solid);
  }
}
```

### Rollout Sequencing Impact

This north-star refines Maya's shell architecture and Tariq's phase sequencing:

| Phase | Shell | Status |
|-------|-------|--------|
| Foundation (current) | DETAIL SHELL on brew-log + catalog detail | In progress (fixes pending) |
| Phase 2: List rollout | LIST SHELL on brew-log list + catalog list | Blocked on this north-star + EntityCard |
| Phase 3: Hardware | DETAIL SHELL on hardware detail; LIST SHELL on hardware list | Future |
| Phase 4: Dashboard/Home | LIST SHELL | Future |

---

## Summary

### §A Fixes (for Finn)

| # | Issue | Component/File | Change |
|---|-------|----------------|--------|
| 1 | Catalog monogram tile | `TitleIcon.tsx`, `index.css` | Add `monogram` prop, `.kk-tc-title-icon-monogram` class, `--kk-tc-monogram-tile-bg` token per tone |
| 2 | Brew-log title icon | `BrewLogDetail.tsx` | Wrap `TitleBlock` with `TitleIcon` + extract monogram from `bag_display` |
| 3 | Markdown heading hierarchy | `index.css` (.kk-tc-markdown h1–h6) | Scale down to 1.1em max, use body font, weight 500, secondary color |
| 4 | Extraction readout spacing | `index.css` (.kk-takeover-card .kk-extraction-readout__*) | Restore `gap: 0.35rem` on metric/zone containers, add chip/guidance margins |

### §B North-Star (for Maya/Tariq/Finn)

| Concept | Binding Rule |
|---------|--------------|
| Detail pages | Glass takeover card (existing) |
| Entity cards | Glass EntityCard (same visual language, smaller scope) |
| List pages | Card-less immersive shell + glass EntityCards |
| Resolution | Page = no card; Entity items = glass cards ON the immersive background |

### Open Questions (none blocking)

All ambiguities have been resolved by this spec. No blocking questions for the operator.

The entity-card-on-list resolution is a design OPINION consistent with the operator's statement — if the operator disagrees (e.g., wants entity items to also be card-less rows), that would be a separate clarification cycle.

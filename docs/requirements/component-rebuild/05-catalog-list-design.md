# Aria Design Contract — Catalog List Page

**Version:** 1.0  
**Date:** 2025-06-15  
**Page:** `/catalog` (`CatalogList.tsx`)  
**North-Star:** Immersive list shell (card-less) + glass entity cards  

---

## §1 Immersive List Shell

### 1.1 Concept

The Catalog List page is the **first LIST page** in the rebuild. It establishes the **card-less immersive pattern**: the route photo (`.app-bg.bg-catalog`) reads as a blurred immersive background, with content floating directly on it — NO page-level wrapper card.

This contrasts with DETAIL pages (CatalogDetail, BrewDetail) which use a single `TakeoverCard` containing all content.

### 1.2 Background + Blur Treatment

```
┌──────────────────────────────────────────────────────────────┐
│  .app-bg.bg-catalog (route photo, full viewport)            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  .immersive-frost-layer (full viewport overlay)        │ │
│  │  backdrop-filter: blur(24px)                           │ │
│  │  background: var(--kk-il-frost-tint)                   │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  ListPageHeader (eyebrow + title + section)      │  │ │
│  │  │  Search input                                    │  │ │
│  │  │  EntityCard grid                                 │  │ │
│  │  │  FAB (fixed position)                            │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 New Token Set: Immersive List Shell

Define in `:root` (alongside takeover card tokens):

```css
/* Immersive List Shell — geometry */
--kk-il-frost-blur: 24px;
--kk-il-content-max-width: 1200px;
--kk-il-content-padding: var(--kk-layout-gutter);

/* DARK tone frost tint */
[data-tone="dark"] {
  --kk-il-frost-tint: rgba(24, 16, 10, 0.45);
  --kk-il-text-primary: #fff7ed;       /* same as takeover */
  --kk-il-text-secondary: #d6cbbf;
  --kk-il-text-tertiary: #a89585;
}

/* BEIGE tone frost tint */
[data-tone="beige"] {
  --kk-il-frost-tint: rgba(245, 235, 220, 0.55);
  --kk-il-text-primary: #2d1608;       /* same as takeover */
  --kk-il-text-secondary: #5c3d1e;
  --kk-il-text-tertiary: #8b6b4a;
}
```

### 1.4 Frost Layer CSS

```css
.immersive-frost-layer {
  position: fixed;
  inset: 0;
  z-index: 0;
  backdrop-filter: blur(var(--kk-il-frost-blur));
  -webkit-backdrop-filter: blur(var(--kk-il-frost-blur));
  background: var(--kk-il-frost-tint);
}

/* Solid fallback for no backdrop-filter support */
@supports not (backdrop-filter: blur(1px)) {
  .immersive-frost-layer {
    background: var(--kk-il-frost-tint-solid, rgba(24, 16, 10, 0.85));
  }
}

/* Reduced transparency preference */
@media (prefers-reduced-transparency: reduce) {
  .immersive-frost-layer {
    backdrop-filter: none;
    background: var(--kk-il-frost-tint-solid, rgba(24, 16, 10, 0.85));
  }
}
```

### 1.5 Legibility System

Text on the immersive frost layer uses the same text tokens as the takeover card. The frost tint provides sufficient contrast:

| Element | Token | DARK | BEIGE | Contrast |
|---------|-------|------|-------|----------|
| Page title | `--kk-il-text-primary` | #fff7ed | #2d1608 | ≥8:1 / ≥7:1 |
| Eyebrow/section | `--kk-il-text-tertiary` | #a89585 | #8b6b4a | ≥4.5:1 |
| Body text | `--kk-il-text-secondary` | #d6cbbf | #5c3d1e | ≥7:1 |

The 24px blur + 45%/55% frost tint ensures the background photo is visible but heavily diffused, allowing text to be AA-legible without a containing card.

### 1.6 Content Container

```css
.immersive-list-content {
  position: relative;
  z-index: 1;
  max-width: var(--kk-il-content-max-width);
  margin: 0 auto;
  padding: var(--kk-il-content-padding);
  padding-top: calc(var(--kk-topbar-height) + var(--kk-layout-gutter));
}
```

---

## §2 Glass EntityCard

### 2.1 Concept

The `EntityCard` is a **reusable glass card** for catalog beans, hardware items, and home page summaries. It uses the same glass visual language as the `TakeoverCard` but at a smaller, card-grid scale.

### 2.2 Visual Anatomy

```
┌─────────────────────────────────────────────┐
│  ┌─────────────────────────────────────┐    │ ← glass surface
│  │                                     │    │    (same tokens as TakeoverCard)
│  │         FIGURE                      │    │
│  │    (image or TitleIcon monogram)    │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  EYEBROW (roaster name)                     │ ← text-tertiary, eyebrow-xs
│  TITLE (bean name)                          │ ← text-primary, title-md
│  ┌────────────┐                             │
│  │ RoastChip  │                             │ ← reuse existing RoastChip
│  └────────────┘                             │
└─────────────────────────────────────────────┘
```

### 2.3 Token Mapping

EntityCard reuses takeover card tokens with adjusted geometry:

```css
/* EntityCard — geometry (smaller than takeover) */
--kk-ec-radius: 12px;           /* vs 16px for takeover */
--kk-ec-blur: 20px;             /* slightly less than takeover's 24px */
--kk-ec-padding: 12px;
--kk-ec-figure-radius: 8px;
--kk-ec-figure-aspect: 4/3;

/* Surface — SAME as takeover card */
--kk-ec-surface: var(--kk-tc-surface);
--kk-ec-bevel-shadow: var(--kk-tc-bevel-shadow);

/* Text — SAME as takeover card */
--kk-ec-text-primary: var(--kk-tc-text-primary);
--kk-ec-text-secondary: var(--kk-tc-text-secondary);
--kk-ec-text-tertiary: var(--kk-tc-text-tertiary);
```

### 2.4 Interactive States

Following the button principle from aria-principles-northstar.md:

| State | Treatment |
|-------|-----------|
| Rest | Base glass surface |
| Hover | `filter: brightness(1.05)`, subtle shadow lift |
| Focus | 2px ring using `--kk-tc-text-primary`, offset 2px |
| Active | `transform: scale(0.98)`, `filter: brightness(0.95)` |

```css
.entity-card {
  transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
}

.entity-card:hover {
  filter: brightness(1.05);
  box-shadow: var(--kk-ec-bevel-shadow), 0 8px 24px rgba(0, 0, 0, 0.15);
}

.entity-card:focus-visible {
  outline: 2px solid var(--kk-ec-text-primary);
  outline-offset: 2px;
}

.entity-card:active {
  transform: scale(0.98);
  filter: brightness(0.95);
}
```

### 2.5 Figure Treatment

The figure area displays either:
1. **Image** — bean photo with `object-fit: cover`, rounded corners
2. **Monogram fallback** — reuse `TitleIcon` component when no image exists

```tsx
// EntityCard figure logic (matches existing CatalogCardFigure pattern)
{imageUrl ? (
  <img src={imageUrl} alt={title} className="entity-card-image" />
) : (
  <TitleIcon label={title} size="lg" />
)}
```

### 2.6 Props API

```tsx
interface EntityCardProps {
  // Required
  href: string;              // navigation target
  title: string;             // primary text (bean name)
  
  // Optional content
  eyebrow?: string;          // secondary text (roaster name)
  imageUrl?: string;         // figure image (falls back to TitleIcon)
  
  // Optional slots
  chip?: ReactNode;          // e.g., <RoastChip roast="medium" />
  badge?: ReactNode;         // e.g., count badge for home page
  
  // Styling
  className?: string;
  
  // Motion (preserve existing GSAP integration)
  motionClassName?: string;  // default: "kaapi-motion-card"
}
```

### 2.7 Both Tones

The component inherits tone from `ToneProvider` (same as TakeoverCard). No prop needed — tokens resolve via CSS custom properties on `[data-tone]`.

DARK tone:
- Surface: `rgba(24, 16, 10, 0.72)` + bevel shadow
- Text: warm cream palette

BEIGE tone:
- Surface: `rgba(245, 235, 220, 0.78)` + inverted bevel
- Text: espresso brown palette

### 2.8 Accessibility

- **AA contrast**: Text tokens verified ≥4.5:1 for all sizes
- **Focus ring**: Visible 2px outline on keyboard focus
- **Motion**: Respects `prefers-reduced-motion` (GSAP stagger disabled)
- **Link semantics**: Card is a single `<a>` element, not a clickable div

---

## §3 ListPageHeader

### 3.1 Concept

`ListPageHeader` replaces the existing `PageHeader` + `SectionHeading` combo for immersive list pages. It provides:
- Eyebrow (category/breadcrumb)
- Title (page name)
- Section label (optional subsection)

### 3.2 Visual Anatomy

```
BEANS / INVENTORY                    ← eyebrow (text-tertiary, uppercase, tracked)
Catalog                              ← title (text-primary, large)
COFFEE LIBRARY                       ← section (text-secondary, small caps)
```

### 3.3 Token Mapping

```css
.list-page-header {
  margin-bottom: var(--kk-layout-section-gap);
}

.list-page-header-eyebrow {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--kk-il-text-tertiary);
  margin-bottom: 0.25rem;
}

.list-page-header-title {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: var(--kk-il-text-primary);
  line-height: 1.1;
  margin-bottom: 0.5rem;
}

.list-page-header-section {
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--kk-il-text-secondary);
}
```

### 3.4 Props API

```tsx
interface ListPageHeaderProps {
  eyebrow?: string;          // "BEANS / INVENTORY"
  title: string;             // "Catalog"
  section?: string;          // "COFFEE LIBRARY"
  className?: string;
}
```

---

## §4 Supporting Elements on Immersive Shell

### 4.1 Search Input

The search input floats on the immersive frost layer. It uses a **glass pill treatment** consistent with the shell:

```css
.immersive-search-input {
  background: var(--kk-tc-surface);
  backdrop-filter: blur(var(--kk-ec-blur));
  border: 1px solid var(--kk-tc-border);
  border-radius: 999px;          /* pill shape */
  padding: 0.75rem 1rem;
  color: var(--kk-tc-text-primary);
  width: 100%;
  max-width: 400px;
}

.immersive-search-input::placeholder {
  color: var(--kk-tc-text-tertiary);
}

.immersive-search-input:focus {
  outline: 2px solid var(--kk-tc-text-primary);
  outline-offset: 2px;
}
```

**Reuse consideration**: If `ToneInput` exists in tone-system, extend it with a `variant="pill"` prop. Otherwise, create `ImmersiveSearchInput` as a new component.

### 4.2 EmptyState

EmptyState on the immersive shell uses text directly on the frost (no card):

```tsx
interface ImmersiveEmptyStateProps {
  icon?: ReactNode;          // optional illustration
  title: string;             // "No beans yet"
  description?: string;      // "Add your first coffee bean..."
  action?: ReactNode;        // optional CTA button
}
```

```css
.immersive-empty-state {
  text-align: center;
  padding: var(--kk-layout-section-gap);
}

.immersive-empty-state-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.6;
}

.immersive-empty-state-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--kk-il-text-primary);
  margin-bottom: 0.5rem;
}

.immersive-empty-state-description {
  color: var(--kk-il-text-secondary);
  margin-bottom: 1.5rem;
}
```

### 4.3 Error State

Error state on immersive shell uses a **subtle glass card** (not the full TakeoverCard):

```tsx
// Error uses EntityCard-style glass treatment
<div className="immersive-error-card">
  <span className="error-icon">⚠️</span>
  <p className="error-message">Failed to load catalog</p>
  <ToneButton variant="secondary" onClick={retry}>Retry</ToneButton>
</div>
```

```css
.immersive-error-card {
  background: var(--kk-ec-surface);
  backdrop-filter: blur(var(--kk-ec-blur));
  border-radius: var(--kk-ec-radius);
  padding: var(--kk-layout-gutter);
  text-align: center;
  max-width: 400px;
  margin: 0 auto;
}
```

### 4.4 Floating Action Button (FAB)

The FAB remains in its fixed position via `createPortal` to body. It uses glass styling consistent with the shell:

```css
.immersive-fab {
  position: fixed;
  bottom: calc(var(--kk-layout-gutter) + env(safe-area-inset-bottom));
  right: var(--kk-layout-gutter);
  z-index: var(--kk-z-fab);
  
  /* Glass treatment */
  background: var(--kk-tc-surface);
  backdrop-filter: blur(var(--kk-tc-blur));
  box-shadow: var(--kk-tc-bevel-shadow);
  
  /* Geometry */
  width: 56px;
  height: 56px;
  border-radius: 50%;
  
  /* Icon */
  color: var(--kk-tc-text-primary);
  font-size: 1.5rem;
  
  /* Interactive states (same as EntityCard) */
  transition: transform 0.15s ease, filter 0.15s ease;
}

.immersive-fab:hover {
  filter: brightness(1.05);
  transform: scale(1.05);
}

.immersive-fab:active {
  transform: scale(0.95);
}
```

**GSAP motion**: Preserve `fabMount` animation from `useKaapiMotion`. The FAB should animate in after cards stagger completes.

---

## §5 Coherence vs Distinction

### 5.1 Shared Design Language (Coherence)

| Element | List Page | Detail Page | Shared |
|---------|-----------|-------------|--------|
| Tone system | ToneProvider | ToneProvider | ✓ |
| Glass blur | 24px (frost layer) | 24px (TakeoverCard) | ✓ |
| Surface tokens | `--kk-tc-surface` | `--kk-tc-surface` | ✓ |
| Text tokens | `--kk-tc-text-*` | `--kk-tc-text-*` | ✓ |
| Bevel shadows | Same multi-value | Same multi-value | ✓ |
| RoastChip | Reused | Reused | ✓ |
| TitleIcon | Reused (EntityCard) | Reused | ✓ |
| Interactive states | Brightness + scale | Brightness + scale | ✓ |
| GSAP motion | staggerCards | fadeIn | Different but consistent library |

### 5.2 Intentional Differences (Distinction)

| Aspect | List Page | Detail Page |
|--------|-----------|-------------|
| Page structure | Card-less immersive | Single TakeoverCard contains all |
| Content layout | Grid of EntityCards | Linear sections in one card |
| Background treatment | Blurred route photo visible | Route photo partially visible behind card |
| Information density | Summary (eyebrow + title + chip) | Full detail (all fields, markdown prose) |
| Primary action | Navigate to detail | Edit/delete entity |

### 5.3 Visual Flow

```
LIST PAGE                          DETAIL PAGE
┌────────────────────┐             ┌────────────────────┐
│ ░░░░░░░░░░░░░░░░░░ │ blurred     │ ░░░░░░░░░░░░░░░░░░ │ blurred
│ ░░ HEADER ░░░░░░░░ │ bg          │ ░░░░░░░░░░░░░░░░░░ │ bg
│ ░░░░░░░░░░░░░░░░░░ │             │ ┌──────────────┐   │
│ ░░ [SEARCH] ░░░░░░ │             │ │              │   │
│ ░░░░░░░░░░░░░░░░░░ │             │ │  TAKEOVER    │   │
│ ░ [CARD] [CARD] ░░ │ glass       │ │  CARD        │   │ glass
│ ░ [CARD] [CARD] ░░ │ entity      │ │              │   │ card
│ ░░░░░░░░░░░░░░░░░░ │ cards       │ │  (all        │   │
│ ░░░░░░░░░░░ [FAB]░ │             │ │   content)   │   │
└────────────────────┘             │ │              │   │
                                   │ └──────────────┘   │
                                   └────────────────────┘
```

User mental model: **"List = browse surface, Detail = focused card."** The same glass language at different scales creates recognition without confusion.

---

## §6 New Shared Components + Props + Reuse Map

### 6.1 New Components to Create

| Component | Location | Purpose |
|-----------|----------|---------|
| `ImmersiveListShell` | `tone-system/ImmersiveListShell.tsx` | Page wrapper with frost layer |
| `EntityCard` | `tone-system/EntityCard.tsx` | Glass card for list items |
| `ListPageHeader` | `tone-system/ListPageHeader.tsx` | Header for immersive list pages |
| `ImmersiveEmptyState` | `tone-system/ImmersiveEmptyState.tsx` | Empty state for immersive shell |
| `ImmersiveFab` | `tone-system/ImmersiveFab.tsx` | Floating action button |

### 6.2 Props Summary

```tsx
// ImmersiveListShell
interface ImmersiveListShellProps {
  children: ReactNode;
  className?: string;
}

// EntityCard
interface EntityCardProps {
  href: string;
  title: string;
  eyebrow?: string;
  imageUrl?: string;
  chip?: ReactNode;
  badge?: ReactNode;
  className?: string;
  motionClassName?: string;
}

// ListPageHeader
interface ListPageHeaderProps {
  eyebrow?: string;
  title: string;
  section?: string;
  className?: string;
}

// ImmersiveEmptyState
interface ImmersiveEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

// ImmersiveFab
interface ImmersiveFabProps {
  icon: ReactNode;
  label: string;           // aria-label
  onClick?: () => void;
  href?: string;           // if navigating
  className?: string;
}
```

### 6.3 Reuse Map

| New Component | Reuses From tone-system |
|---------------|-------------------------|
| `ImmersiveListShell` | `ToneProvider` (wraps), CSS tokens from TakeoverCard |
| `EntityCard` | `TitleIcon`, `RoastChip`, takeover card tokens |
| `ListPageHeader` | Typography tokens from takeover card |
| `ImmersiveEmptyState` | `ToneButton` for action |
| `ImmersiveFab` | Takeover card glass tokens, button interactive states |

### 6.4 CSS Token Additions

Add to `index.css` in `:root`:

```css
/* === Immersive List Shell tokens === */
--kk-il-frost-blur: 24px;
--kk-il-content-max-width: 1200px;
--kk-il-content-padding: var(--kk-layout-gutter);

/* === EntityCard tokens === */
--kk-ec-radius: 12px;
--kk-ec-blur: 20px;
--kk-ec-padding: 12px;
--kk-ec-figure-radius: 8px;
--kk-ec-figure-aspect: 4 / 3;

/* Tone-specific tokens defined in [data-tone] blocks */
```

### 6.5 Exports

Update `tone-system/index.ts`:

```tsx
// Existing exports...

// New immersive list components
export { ImmersiveListShell } from './ImmersiveListShell';
export { EntityCard } from './EntityCard';
export { ListPageHeader } from './ListPageHeader';
export { ImmersiveEmptyState } from './ImmersiveEmptyState';
export { ImmersiveFab } from './ImmersiveFab';
```

---

## §7 Acceptance Criteria

### 7.1 ImmersiveListShell

- [ ] Full-viewport frost layer with 24px blur
- [ ] DARK tone: frost tint `rgba(24, 16, 10, 0.45)`
- [ ] BEIGE tone: frost tint `rgba(245, 235, 220, 0.55)`
- [ ] Solid fallback for `@supports not (backdrop-filter)`
- [ ] Respects `prefers-reduced-transparency`
- [ ] Content container respects max-width and padding tokens

### 7.2 EntityCard

- [ ] Glass surface using takeover card tokens
- [ ] 12px border-radius (smaller than takeover's 16px)
- [ ] Figure area: image OR TitleIcon monogram fallback
- [ ] Eyebrow (roaster) + Title (bean) + optional RoastChip
- [ ] Hover: brightness(1.05) + shadow lift
- [ ] Focus: 2px ring with offset
- [ ] Active: scale(0.98)
- [ ] DARK + BEIGE tones render correctly
- [ ] AA contrast verified for all text
- [ ] Preserves `.kaapi-motion-card` class for GSAP stagger

### 7.3 ListPageHeader

- [ ] Eyebrow: uppercase, tracked, text-tertiary
- [ ] Title: large, bold, text-primary
- [ ] Section: small caps, text-secondary
- [ ] Legible on immersive frost layer
- [ ] Both tones render correctly

### 7.4 Search / Empty / Error / FAB

- [ ] Search input: glass pill, tone-aware, focus ring
- [ ] EmptyState: centered, no card, tone-aware text
- [ ] Error: subtle glass card, retry button
- [ ] FAB: glass circle, fixed position, preserves `fabMount` animation
- [ ] All elements AA-legible on frost layer

### 7.5 Coherence

- [ ] EntityCard reads as "same family" as TakeoverCard
- [ ] Tone toggle on list page persists to detail page
- [ ] Typography scale feels related across pages
- [ ] Interactive states (hover/focus/active) consistent

### 7.6 No One-Offs

- [ ] All new components in `tone-system/`
- [ ] No page-local styles in `CatalogList.tsx`
- [ ] All CSS uses design tokens (no magic numbers)
- [ ] Components reusable for Hardware list, Home page

---

## §8 Card-less Page / Glass Items Confirmation

### 8.1 Reconciliation Statement

The operator's north-star specified:
- "List pages without a card" → **PAGE has no wrapper card**
- "Catalog cards should be glass" → **ITEMS are glass EntityCards**

This design contract reconciles both:

| Layer | Treatment |
|-------|-----------|
| Page background | Route photo, blurred via frost layer |
| Page content | Floats directly on frost (no containing card) |
| Entity items | Individual glass EntityCards in a grid |

The **page is immersive/card-less**; the **items are glass cards**. There is no conflict — the two requirements operate at different structural levels.

### 8.2 Open Questions for Operator

**Q1: Search input placement**  
Should the search input be:
- (a) Inline with header (same row as title), or
- (b) Below header, full-width in content area?

Current design assumes (b) based on existing CatalogList layout.

**Q2: Grid columns**  
The current CatalogList uses a responsive grid. Confirm target breakpoints:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns
- Wide: 4 columns?

**Q3: EntityCard figure aspect ratio**  
Current design specifies 4:3. Confirm this works for bean photos, or should it be:
- 1:1 (square) for consistency with monogram fallback?
- 16:9 (wide) for more dramatic photos?

**Q4: Reuse for Hardware/Home**  
Confirm EntityCard will be used for:
- Hardware list items (grinder cards)
- Home page "recent brews" or "quick stats" cards

This affects whether we need additional slots (e.g., secondary chip, metadata row).

---

## Appendix: Migration Checklist for Finn

When implementing `CatalogList.tsx` migration:

1. **Wrap with ToneProvider** (if not already at route level)
2. **Replace page structure**:
   - Remove `.kaapi-content-surface` wrapper
   - Add `<ImmersiveListShell>`
3. **Replace header**:
   - Remove `<PageHeader>` + `<SectionHeading>`
   - Add `<ListPageHeader eyebrow="BEANS / INVENTORY" title="Catalog" section="COFFEE LIBRARY" />`
4. **Replace search**:
   - Remove current `<Input>` in `.kaapi-content-surface`
   - Add search input styled for immersive shell (or use `ToneInput variant="pill"`)
5. **Replace cards**:
   - Remove `<GlassCard variant="content">` wrapper per item
   - Add `<EntityCard>` with appropriate props
   - Keep `.kaapi-motion-card` class (or use `motionClassName` prop)
6. **Replace empty/error states**:
   - Use `<ImmersiveEmptyState>` for empty catalog
   - Use glass error card pattern for fetch errors
7. **Update FAB**:
   - Replace current FAB with `<ImmersiveFab>` or update styling
   - Preserve portal to body
   - Preserve `fabMount` GSAP animation
8. **Verify GSAP**:
   - `useKaapiMotion({ scope: routeRef })` should still work
   - Stagger animation on EntityCards
   - FAB mount animation

---

*End of design contract. Ready for operator review.*

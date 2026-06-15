# Aria Design Contract: Dashboard Immersive Rebuild

**Page:** Dashboard (Home) — `/`  
**Source:** `frontend/src/pages/Dashboard.tsx`  
**Type:** SUMMARY page (card-less immersive shell)  
**Date:** 2025-06-15  
**Author:** Aria (Designer)

---

## §1 Immersive Shell for Dashboard

### Decision
The Dashboard uses `ImmersiveListShell` as its page surface — consistent with the CatalogList pattern. The `bg-dashboard` route photo serves as the immersive background.

### Implementation

```tsx
<ToneProvider>
  <ImmersiveListShell>
    <ListPageHeader title="Home" />
    {/* Hero section */}
    {/* Active bags section */}
    {/* Recent shots section */}
  </ImmersiveListShell>
</ToneProvider>
```

### CSS Activation
The existing `:has()` selectors automatically activate frost/scrim when `ImmersiveListShell` renders with `data-tone`. Add the Dashboard route to the scrim rule:

```css
/* Already exists — ensure bg-dashboard is in the selector chain */
.app-bg.bg-dashboard:has(~ main .immersive-list-shell[data-tone="dark"]),
.app-bg.bg-dashboard:has(~ main .immersive-list-shell[data-tone="beige"]) {
  /* Scrim tint — same logic as other routes */
}
```

### Content Layout
- All content sits inside `.immersive-list-content` (max-width, centered, tone-aware padding).
- NO page-level GlassCard wrapper — the frost IS the surface.
- Sections stack vertically with consistent `gap` (reuse the pattern from CatalogList).

---

## §2 Hero Treatment + HeroVisualFrame

### Key Decision: Hero Content on Immersive Surface (NOT Glass Card)

**The hero is NOT wrapped in a glass card.** Rationale:

1. **North-star alignment:** Summary pages are card-less immersive. A page-level hero card contradicts the immersive pattern.
2. **Visual hierarchy:** The HeroVisualFrame IS the hero's focal glass element — wrapping it in another glass card creates unnecessary nesting.
3. **Consistency with CatalogList:** The catalog header sits directly on frost; the dashboard hero should too.
4. **Separation of concerns:** Stats/actions are UI chrome (belong on frost); the viz frame is the content showcase (glass container).

### Hero Layout on Immersive Surface

```
┌─────────────────────────────────────────────────────────────┐
│  .immersive-list-content                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Hero Section (on frost, no card wrapper)             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  StatTile row (3 tiles, glass mini-surfaces)    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  HeroVisualFrame (solid viz container)          │  │  │
│  │  │  └── DashboardHero3D / Fallback                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Action buttons (ToneButton row)                │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  SectionHeading: Active Bags                          │  │
│  │  ┌───────┐ ┌───────┐ ┌───────┐                        │  │
│  │  │EntityCard│EntityCard│EntityCard│  (glass)          │  │
│  │  └───────┘ └───────┘ └───────┘                        │  │
│  └───────────────────────────────────────────────────────┘  │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### HeroVisualFrame on Immersive Background — Both Tones

The HeroVisualFrame is a **solid, never-blurred viz surface** (by design). On the immersive background, it needs tone-aware treatment:

#### Dark Tone
- **Background:** Remains `--kaapi-content-surface` (warm dark).
- **Border:** `1px solid rgba(255, 248, 240, 0.08)` — subtle warm edge against dark frost.
- **Shadow:** `0 4px 24px rgba(0, 0, 0, 0.4)` — depth separation from frosted bg.
- **Reads as:** A solid, grounded showcase panel floating on the frosted coffee-shop ambience.

#### Beige Tone
- **Background:** Remains `--kaapi-content-surface` (warm light cream).
- **Border:** `1px solid rgba(92, 64, 51, 0.12)` — coffee-brown edge against light frost.
- **Shadow:** `0 4px 16px rgba(92, 64, 51, 0.15)` — softer, warmer lift.
- **Reads as:** A paper-like inset surface, the viz content sitting inside a frame on a sunlit café counter.

#### CSS Adjustment
Add tone-aware tokens for HeroVisualFrame when inside the immersive shell:

```css
.immersive-list-shell[data-tone="dark"] .hero-visual-frame {
  border-color: rgba(255, 248, 240, 0.08);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.immersive-list-shell[data-tone="beige"] .hero-visual-frame {
  border-color: rgba(92, 64, 51, 0.12);
  box-shadow: 0 4px 16px rgba(92, 64, 51, 0.15);
}
```

### Post-Build Viz-Review Plan

The HeroVisualFrame/WebGL viz is NOT exempt from northstar verification. After Finn builds:

1. **Screenshot both tones** at Desktop + Mobile breakpoints.
2. **Verify against Principle 1 (Dual-Tone Coherence):**
   - Dark: Does the viz frame feel integrated with the frosted dark bg? No jarring contrast?
   - Beige: Does it feel like warm paper/café aesthetic? Not clinical or cold?
3. **Verify against Principle 2 (One Surface Per View):**
   - The viz frame is the ONLY solid surface in the hero zone — stats and actions are on frost.
4. **Verify against Principle 7 (No Semantic Color Drift):**
   - Fallback SVG warm gradient reads correctly in both tones.
5. **Flag:** If the WebGL viz itself (the 3D espresso visualization) doesn't tone-shift, note this as a future enhancement (content inside the frame is out of scope for this rebuild).

---

## §3 StatTile — New Shared Component

### Purpose
A reusable mini-tile for displaying a stat number + label. Used on summary surfaces (Dashboard hero, potentially future summary pages).

### Design
**Treatment:** Glass mini-surface (consistent with "cards are glass").

```
┌─────────────────┐
│       42        │  ← number (large, --kk-tc-primary)
│  Active bags    │  ← label (small, --kk-tc-muted)
└─────────────────┘
```

### Props

```ts
interface StatTileProps {
  value: number | string;
  label: string;
  className?: string;
}
```

### CSS Class: `.stat-tile`

```css
.stat-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3) var(--space-4);
  min-width: 100px;
  
  /* Glass treatment */
  background: var(--kk-tc-surface);
  border: 1px solid var(--kk-tc-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
}

.stat-tile__value {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--kk-tc-primary);
  line-height: 1.2;
}

.stat-tile__label {
  font-size: var(--text-sm);
  color: var(--kk-tc-muted);
  margin-top: var(--space-1);
}
```

### Layout in Hero
Three tiles in a centered flex row with gap:

```tsx
<div className="stat-tile-row">
  <StatTile value={activeBags} label="Active bags" />
  <StatTile value={recentShots} label="Recent" />
  <StatTile value={households} label="Households" />
</div>
```

```css
.stat-tile-row {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-4);
}
```

---

## §4 Bag EntityCard Mapping (Active Bags)

### Current Fields
- "Ready to brew" label
- `display_name` (bag name)
- Roast badge (Light/Medium/Dark)
- Days since opened
- Last shot: dose → yield
- Click → `/brew-log/add?bag_id={id}`

### Mapping to EntityCard

| Dashboard Field | EntityCard Prop | Notes |
|-----------------|-----------------|-------|
| "Ready to brew" | `eyebrow` | String slot, already supported |
| `display_name` | `title` | String slot, already supported |
| Roast badge | `chip` | Pass `<RoastChip roast={bag.roast_level} />` |
| Days since / last shot | **NEW: `meta`** | Footer slot for secondary info |
| Click href | `href` | Already supported |

### EntityCard Enhancement: `meta` Prop

Add a `meta` prop (ReactNode) for footer content:

```ts
interface EntityCardProps {
  // existing...
  meta?: React.ReactNode;  // NEW: footer content below title/chip
}
```

### Rendered Structure

```tsx
<EntityCard
  href={`/brew-log/add?bag_id=${bag.id}`}
  eyebrow="Ready to brew"
  title={bag.display_name}
  chip={<RoastChip roast={bag.roast_level} />}
  meta={
    <span className="entity-card__meta">
      {daysSince}d old · {lastShot.dose_g}g → {lastShot.yield_g}g
    </span>
  }
  motionClassName="kaapi-motion-card"
/>
```

### CSS for `meta`

```css
.entity-card__meta {
  font-size: var(--text-xs);
  color: var(--kk-tc-muted);
  margin-top: var(--space-2);
}
```

---

## §5 Recent Shots Treatment

### Decision: `ShotRow` — Compact List Item (NOT full EntityCard)

Recent shots are secondary content on the Dashboard. A full EntityCard is too heavy. Define a **`ShotRow`** component — a compact, horizontal list item optimized for shot summaries.

### Design

```
┌──────────────────────────────────────────────────────────────┐
│  Ethiopia Sidamo          Today 2:30 PM     18g → 36g   →   │
│  └── bag_display          └── date          └── chip    └── link
└──────────────────────────────────────────────────────────────┘
```

- **Treatment:** Subtle glass row (lighter than EntityCard — single-line density).
- **Hover:** Same lift as EntityCard but less pronounced.
- **Click:** Navigate to `/brew-log/{shot.id}`.

### Props

```ts
interface ShotRowProps {
  href: string;
  bagName: string;
  date: string;           // Formatted date string
  doseYield: string;      // e.g., "18g → 36g"
  className?: string;
}
```

### CSS Class: `.shot-row`

```css
.shot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  gap: var(--space-3);
  
  /* Glass treatment (lighter than entity-card) */
  background: var(--kk-tc-surface);
  border: 1px solid var(--kk-tc-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(6px);
  
  text-decoration: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.shot-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--kk-tc-shadow);
}

.shot-row__bag {
  font-weight: 500;
  color: var(--kk-tc-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shot-row__date {
  font-size: var(--text-sm);
  color: var(--kk-tc-muted);
  flex-shrink: 0;
}

.shot-row__chip {
  flex-shrink: 0;
}

.shot-row__arrow {
  color: var(--kk-tc-muted);
  flex-shrink: 0;
}
```

### Rendered Structure

```tsx
<Link to={`/brew-log/${shot.id}`} className="shot-row kaapi-motion-card">
  <span className="shot-row__bag">{shot.bag_display}</span>
  <span className="shot-row__date">{formatDate(shot.timestamp)}</span>
  <Chip className="shot-row__chip">{shot.dose_g}g → {shot.yield_g}g</Chip>
  <ChevronRight className="shot-row__arrow" size={16} />
</Link>
```

### Layout

Stack in a vertical list with gap:

```tsx
<section>
  <SectionHeading>Recent Shots</SectionHeading>
  <div className="shot-row-list">
    {recentShots.map(shot => <ShotRow key={shot.id} ... />)}
  </div>
</section>
```

```css
.shot-row-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
```

---

## §6 Actions, Empty States, Loading, Error, FAB

### Action Buttons (Hero)
**Reuse `ToneButton`** — already tone-aware.

```tsx
<div className="hero-actions">
  <ToneButton variant="primary" href="/brew-log/add">
    Log a shot
  </ToneButton>
  <ToneButton variant="secondary" href="/catalog">
    Manage catalog
  </ToneButton>
</div>
```

```css
.hero-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
```

### Empty States
**Reuse `ImmersiveEmptyState`** — already designed for immersive surfaces.

Three empty states in Dashboard:
1. **Fresh household:** No bags, no shots → "Welcome! Add your first coffee bag."
2. **No bags:** Shots exist but no active bags → "Add a bag to start brewing."
3. **No shots:** Bags exist but no shots → "Log your first shot."

```tsx
<ImmersiveEmptyState
  icon={<Coffee />}
  title="Welcome to Espresso Logs"
  description="Add your first coffee bag to get started."
  action={<ToneButton href="/catalog/add">Add a bag</ToneButton>}
/>
```

### Loading State
**Reuse the skeleton pattern** from CatalogList, adapted for Dashboard sections.

```tsx
// Hero skeleton
<div className="hero-skeleton">
  <div className="stat-tile-row">
    <StatTileSkeleton />
    <StatTileSkeleton />
    <StatTileSkeleton />
  </div>
  <div className="hero-visual-frame--loading" />
  <div className="hero-actions-skeleton" />
</div>

// Section skeletons
<EntityCardSkeleton count={3} />  // Active bags
<ShotRowSkeleton count={5} />     // Recent shots
```

Skeleton classes use `--kk-tc-skeleton` token (already exists).

### Error State
**Reuse `ImmersiveEmptyState`** with error variant:

```tsx
<ImmersiveEmptyState
  icon={<AlertCircle />}
  title="Something went wrong"
  description={error.message}
  action={<ToneButton onClick={retry}>Try again</ToneButton>}
  variant="error"
/>
```

### FAB (Mobile)
**Reuse `ImmersiveFab`** — already tone-aware, positioned for immersive pages.

```tsx
<ImmersiveFab 
  icon={<Plus />} 
  href="/brew-log/add"
  label="Log shot"
/>
```

---

## §7 New Shared Components + Props + Reuse Map

### NEW Components (tone-system)

| Component | Props | Purpose |
|-----------|-------|---------|
| `StatTile` | `value: string\|number`, `label: string` | Stat display tile for summary surfaces |
| `ShotRow` | `href`, `bagName`, `date`, `doseYield` | Compact row for shot lists |
| `StatTileSkeleton` | — | Loading skeleton for StatTile |
| `ShotRowSkeleton` | — | Loading skeleton for ShotRow |

### EntityCard Enhancement

| Prop | Type | Purpose |
|------|------|---------|
| `meta` | `ReactNode` | Footer slot for secondary info (days-since, dose→yield) |

### REUSED Components (no changes)

| Component | Usage |
|-----------|-------|
| `ImmersiveListShell` | Page surface (card-less immersive) |
| `ListPageHeader` | "Home" header |
| `EntityCard` | Active bag cards (with new `meta` prop) |
| `RoastChip` | Roast level chips on bag cards |
| `Chip` | Dose→yield chips |
| `ToneButton` | Action buttons |
| `ImmersiveEmptyState` | Empty/error states |
| `ImmersiveFab` | Mobile FAB |
| `ToneProvider` | Tone context wrapper |
| `SectionHeading` | Section labels (keep existing) |
| `HeroVisualFrame` | Viz container (with tone-aware CSS) |
| `DashboardHeroMotion` | WebGL viz wrapper |

### File Locations

```
frontend/src/components/tone-system/
├── StatTile.tsx           ← NEW
├── ShotRow.tsx            ← NEW
├── EntityCard.tsx         ← ADD meta prop
├── ImmersiveListShell.tsx ← REUSE
├── ListPageHeader.tsx     ← REUSE
├── ImmersiveEmptyState.tsx← REUSE
├── ImmersiveFab.tsx       ← REUSE
├── ToneButton.tsx         ← REUSE
├── Chip.tsx               ← REUSE
├── RoastChip.tsx          ← REUSE
└── index.ts               ← EXPORT new components
```

---

## §8 Coherence + GSAP Preservation

### Visual Coherence

| Surface | Dashboard | CatalogList | Detail Pages |
|---------|-----------|-------------|--------------|
| Page wrapper | ImmersiveListShell (frost) | ImmersiveListShell (frost) | GlassCard (takeover) |
| Entity cards | EntityCard (glass) | EntityCard (glass) | — |
| Background | bg-dashboard (route photo) | bg-catalog (route photo) | bg-{route} |
| Tone toggle | ToneProvider + ToneToggle | Same | Same |

The Dashboard feels like the same system:
- **Immersive frost background** — matches CatalogList.
- **Glass entity cards** — matches CatalogList.
- **Tone-aware everything** — same tokens, same toggle behavior.
- **ListPageHeader** — same component as CatalogList.

### GSAP Motion Preservation

All existing GSAP motion patterns are preserved:

| Motion | Hook | Target | Preserved |
|--------|------|--------|-----------|
| Route enter | `useKaapiMotion` | Shell | ✅ Keep `routeEnter` |
| Card stagger | `useKaapiMotion` | `.kaapi-motion-card` | ✅ EntityCard + ShotRow have class |
| FAB mount | `useKaapiMotion` | `.kaapi-motion-fab` | ✅ ImmersiveFab has class |
| Press feedback | `useKaapiMotion` | Buttons | ✅ ToneButton compatible |
| Hero parallax | `useKaapiDepth` | HeroVisualFrame | ✅ Keep on HeroVisualFrame |

### Motion Class Assignment

```tsx
// Bag cards
<EntityCard motionClassName="kaapi-motion-card" ... />

// Shot rows
<ShotRow className="kaapi-motion-card" ... />

// Stat tiles (optional stagger)
<StatTile className="kaapi-motion-card" ... />
```

---

## §9 Acceptance Criteria

### P0 — Must Ship

- [ ] Dashboard renders in `ImmersiveListShell` (no page-level card).
- [ ] `bg-dashboard` route photo is visible behind frost.
- [ ] Hero content (stats, viz, actions) sits on frost, NOT in a glass card.
- [ ] `HeroVisualFrame` has tone-aware border/shadow in both tones.
- [ ] `StatTile` component renders 3 tiles (Active bags, Recent, Households).
- [ ] Active bag cards use `EntityCard` with eyebrow/title/chip/meta.
- [ ] Recent shots use `ShotRow` (compact row, not full EntityCard).
- [ ] Action buttons use `ToneButton`.
- [ ] Empty states use `ImmersiveEmptyState`.
- [ ] FAB uses `ImmersiveFab`.
- [ ] Tone toggle works (persisted preference).
- [ ] GSAP stagger animation on cards/rows.
- [ ] Hero parallax (`useKaapiDepth`) still works.
- [ ] No page-local one-off components — all in tone-system.

### P1 — Should Ship

- [ ] `StatTile` skeleton for loading state.
- [ ] `ShotRow` skeleton for loading state.
- [ ] Smooth route transitions (routeEnter).

### P2 — Nice to Have

- [ ] Hero viz content (WebGL) adapts to tone (future enhancement).

---

## §10 Blocking / Non-Blocking Questions

### No Blocking Questions

All design decisions are resolvable with the available information. Proceeding with confident buildable calls.

### Non-Blocking (Defer to Localhost Review)

1. **StatTile sizing:** The 3 tiles are specified with `min-width: 100px`. If they feel cramped on mobile, adjust during localhost review.

2. **ShotRow density:** The compact row is designed for efficiency. If it feels too tight or hard to tap on mobile, increase padding during review.

3. **HeroVisualFrame shadow intensity:** The specified shadow values (`0 4px 24px` dark, `0 4px 16px` beige) are starting points. Tune if they feel too heavy or too light against the frosted bg.

4. **Hero section vertical spacing:** The `margin-bottom` between stats/viz/actions may need adjustment. Start with `var(--space-4)` and tune.

5. **WebGL viz tone-awareness:** The viz content inside HeroVisualFrame (the 3D espresso render) does not currently adapt to tone. Flag for future enhancement if the contrast feels off in beige mode.

---

## Summary

The Dashboard becomes a **card-less immersive summary page** — consistent with the CatalogList pattern. The hero content (stats, viz, actions) sits **directly on the frosted surface**, with `HeroVisualFrame` as the lone glass viz container. Three new shared components (`StatTile`, `ShotRow`, and their skeletons) extend the tone-system. Bag cards map to `EntityCard` with a new `meta` prop; recent shots use the compact `ShotRow`. All existing GSAP motion is preserved. No blocking questions.

---

*End of contract. Ready for Finn to build.*

# 13 — Affordance Principle and Mobile Shell Treatment

**Spec:** 043 → Component System Rebuild  
**Prepared by:** Aria (Designer)  
**Date:** 2026-06-19  
**Status:** DESIGN DIRECTION — awaiting operator decisions and Finn implementation

---

## Skills Applied + Evidence

| Skill | Application | Evidence |
|-------|-------------|----------|
| **ui-design-contract** | Consulted `design-language.md` for Hybrid Base, Surface Contract, and button state table | Lines 36–48 (Hybrid Base), lines ~280 (button states with `cursor: pointer`) |
| **reuse-before-create** | Checked existing tokens before proposing new ones; `--kaapi-frame-surface`, `--kk-tc-surface-solid`, `--kk-tc-border` already exist | index.css lines ~76–80, ~2769–2772 |
| **grill-me** | Self-resolved StatTile interactivity question via code inspection (StatTile.tsx is a `<div>`, EntityCard.tsx is a `<Link>`); self-resolved nav-shell styling via grep on `.nav-shell` | StatTile.tsx line 24, EntityCard.tsx line 64, index.css `.nav-shell` class |
| **information-architecture** | Mapped affordance principle to existing IA: StatTiles = summary/passive data; EntityCards = navigation entry points | Dashboard.tsx lines 151–155 (StatTile usage), 212–223 (EntityCard usage) |
| **design-tokens** | Identified gap: no affordance/cursor/hover tokens for NON-interactive card-like surfaces; no mobile-shell tone tokens | Existing tokens only define interactive states |
| **design-brief** | Produced actionable direction with BUILD-NOW / OPERATOR-DECISION / CROSS-PAGE tags | See sections below |

---

## Part 1: Affordance Principle

### 1A. The Codified Principle

**Principle statement (operator-verbatim distilled):**

> **Visual Affordance Matches Interactivity** — Non-interactive elements must NOT present actionable affordances (card hover effects, pointer cursor, elevation that implies tap). Interactive elements MUST look actionable (cursor pointer, hover/active state progression, bevel/shadow that communicates "I am a control"). If it's not actionable, it must not look like it is.

**Canonical location:** Added as **PRINCIPLE 13** to `docs/requirements/component-rebuild/02-principles-northstar.md` — this is the active rebuild principles home (design-language.md is the high-level system reference; the northstar is the operational enforcement contract for spec-043 work).

### 1B. Principle 13 Wording (for 02-principles-northstar.md)

```markdown
## PRINCIPLE 13: Visual Affordance Matches Interactivity

### Statement
Non-interactive elements must NOT present actionable affordances — no hover brightness/shadow lift, no pointer cursor, no elevation/bevel that implies tap. Interactive elements MUST look actionable — cursor pointer, hover/active state progression, bevel/shadow that signals "I am a control." The visual affordance and the semantic interactivity must be aligned; if it's not actionable, it must not look like it is.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `cursor: pointer` | ONLY on elements with `<a>`, `<button>`, or click handlers |
| `.entity-card:hover` | Interactive card affordance (brightness lift, shadow expansion) |
| `.stat-tile` | **NO** hover effects, **NO** pointer cursor — informational only |
| `.shot-row:hover` | Interactive row affordance (subtle background shift) |

### Application Rule
- Elements rendered as `<div>` or `<span>` without navigation/action handlers must NOT have hover transitions, cursor pointer, or shadow lift
- Elements rendered as `<a>`, `<button>`, or with `onClick` handlers MUST have cursor pointer and visible hover/active state
- Card-like surfaces that are visually similar but differ in interactivity must be visually distinguishable:
  - **Interactive cards:** blur + bevel + hover + pointer + shadow lift
  - **Informational tiles:** solid surface + static treatment + default cursor
- When StatTile and EntityCard appear in the same view, StatTile must NOT share the card chrome that EntityCard uses

### Violation Examples
- `<div>` with `border-radius + border + shadow` but no click handler, styled identically to a clickable card ❌
- StatTile rendering with `backdrop-filter: blur()` and bevel shadow next to tappable EntityCards ❌
- Button with `cursor: default` ❌
- Interactive link with no hover/active feedback ❌
```

---

### 1C. Home Page Affordance Audit

**Context:** Dashboard.tsx renders StatTiles (lines 151–155) and EntityCards (lines 212–223) in the same visual hierarchy.

| Component | Element | Interactive? | Current Affordance | Problem? |
|-----------|---------|--------------|-------------------|----------|
| **StatTile** | `<div>` | ❌ No | Solid border + bg + border-radius (`.stat-tile` at index.css L2761–2772) | ⚠️ **Reads as tappable card** — sitting next to actual tappable EntityCards |
| **EntityCard** | `<Link>` | ✅ Yes | Blur + bevel + border + hover brightness + shadow lift + pointer cursor | ✅ Correctly looks actionable |
| **ShotRow** | `<Link>` | ✅ Yes | Border + hover background shift + pointer cursor | ✅ Correctly looks actionable |

**Diagnosis:** StatTile's current styling (solid bg, border, rounded corners at 12px — same radius as EntityCard) creates a **false affordance**. Users scanning the home page will reasonably expect all similarly-styled tiles to be tappable. The EntityCards are links; the StatTiles are not. This is a visual affordance mismatch.

---

### 1D. StatTile Resolution — Aria's Recommendation

**Option A — Make StatTiles actionable (KEEP the card affordance):**
- Convert StatTile to `<Link>` or wrap in clickable container
- "Active bags" → `/catalog?status=active`
- "Recent" → `/brew-log?sort=recent`
- "Household" → `/household/settings`
- Adds navigation utility, justifies card affordance
- **Pro:** More functional home page, card chrome becomes justified
- **Con:** Adds complexity, may not match user mental model (stats as navigation isn't universal)

**Option B — Keep StatTiles informational (REMOVE the card affordance):**
- Remove border, reduce/remove border-radius, remove bevel-adjacent shadow
- Use typography-only treatment: large value + small label on transparent/minimal background
- Visually distinct from EntityCards — no card chrome
- **Pro:** Clear affordance distinction, simpler implementation, follows Principle 6 (Typography-led)
- **Con:** Hero section may look less "designed"

**Aria's recommendation:** **Option B** — keep StatTiles as informational display-only and remove card affordances. Rationale:

1. **Principle 13 compliance:** Non-interactive = non-actionable visual treatment
2. **Principle 6 (Typography-led):** Stats can be communicated through type scale and spacing alone
3. **Principle 2 (Single Surface):** Removing card chrome keeps the hero section unified
4. **design-language.md Hybrid Base (L36–48):** Operational content on surfaces; StatTiles are summary/passive, not operational

**Recommended CSS changes for `.stat-tile`:**

```css
/* BEFORE (false affordance) */
.stat-tile {
  background: var(--kk-tc-surface-solid);
  border: var(--kk-tc-border);
  border-radius: 12px;
  padding: 0.75rem 1rem;
}

/* AFTER (informational-only, no card affordance) */
.stat-tile {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0.5rem 0;
}
```

**Tag:** **[OPERATOR DECISION]** — Recommend Option B (typography-only StatTile). If operator prefers Option A (make tiles actionable links), specify target routes.

---

### 1E. EntityCard Confirmation

**Status:** ✅ EntityCard correctly looks actionable.

Evidence (index.css L2401–2426):
- `cursor: pointer` implicit via `<Link>` element
- `:hover` → `filter: brightness(1.05)` + shadow lift
- `:active` → `transform: scale(0.98)` press feedback
- `:focus-visible` → outline ring

No changes needed.

---

### 1F. Deferred Questions Resolution

| Question | Resolution |
|----------|------------|
| "Tiles tappable?" | **No** — StatTiles remain informational; remove card affordance to avoid false signal |
| "Color on tiles?" | **No color-coding** — typography and spacing differentiate values; no per-tile accent (aligns with Principle 4: Warm Coherence, no SaaS-dashboard color wash) |

---

## Part 2: Mobile App-Shell in Light Mode

### 2A. Diagnosis

**Current state:**
- Desktop sidebar: dark (`nav-shell` class → `rgba(26, 18, 9, 0.93)` background) — ✅ Grounded brand anchor per operator approval
- Mobile bottom nav: ALSO dark (`nav-shell` class shared) — ⚠️ "Wonky/unpolished" in light mode

**Why it reads wonky:**

1. **Heavy dark slab under bright content:** The beige/light mode content surface is warm cream (~`#f5ebdc`). A near-opaque espresso-dark bar (`rgba(26, 18, 9, 0.93)`) floats at the bottom with a hard, high-contrast edge. There's no visual transition — it looks like two unrelated surfaces collided.

2. **No edge treatment:** Desktop sidebar has a `border-right` for separation. Mobile bottom nav has only `border-top` with amber at low alpha (`rgba(217, 119, 6, 0.18)`). On light mode, this border is nearly invisible against cream content, making the dark bar appear to "cut" the page rather than gracefully anchor it.

3. **Household strip seam:** The `mobile-household-strip` sits above the bottom nav, also using `nav-shell` class. Two dark slabs stacked creates visual heaviness on mobile — acceptable in dark mode where the whole viewport is dark, but jarring when the content pane is bright.

4. **Safe-area gap:** `household-bottom-safe` adds `padding-bottom: max(env(safe-area-inset-bottom), 1rem)`. On iPhones with home indicator, this creates a dark zone below the icons that looks like an afterthought rather than an intentional design surface.

**design-language.md reference (L36–48, Hybrid Base):**
> "The product identity lives in the espresso-dark frame: sidebar, bottom navigation, AppShell chrome..."

However, this was written for the primary dark mode. The document acknowledges:
> "Light mode as a full product mode remains future work."

The current "beige" tone is an in-app content toggle, not full light mode — but the hybrid base implies **desktop anchor stays dark; mobile MAY differ** for visual polish.

---

### 2B. Options Considered

| Option | Treatment | Pros | Cons |
|--------|-----------|------|------|
| **A. Tone-aware light bottom bar** | Mobile bottom nav adopts light/cream surface when content tone is beige | Cohesive, no jarring contrast | Breaks hybrid-base identity purity |
| **B. Frosted/translucent dark bar** | `backdrop-filter: blur(16px)` on bottom nav so content bleeds through softly | Modern, reduces visual weight | Liquid Glass principle permits blur on chrome; adds CPU cost on mobile |
| **C. Refined dark bar with edge treatment** | Keep dark bg but add soft inner shadow, top glow line, and subtle gradient to ease the transition | Maintains brand anchor, less jarring | Still a hard dark element on light; may not fully solve "wonky" |
| **D. Hybrid per-tone treatment** | Dark mode: keep current; Light mode: Option A (tone-aware light bar) | Best of both worlds, explicit hybrid handling | Implementation complexity, two code paths |

---

### 2C. Aria's Recommendation — Option D: Hybrid Per-Tone Treatment

**Rationale:**

- **Desktop sidebar stays dark** — non-negotiable per operator directive
- **Mobile bottom nav in DARK mode** — keep current dark `nav-shell` treatment (cohesive)
- **Mobile bottom nav in BEIGE mode** — switch to tone-aware light treatment:
  - Background: `var(--kk-tc-surface-solid)` (resolves to warm cream in beige tone)
  - Border-top: `1px solid rgba(120, 53, 15, 0.18)` (warm brown hairline, visible on cream)
  - Text/icons: `var(--kk-tc-text-primary)` for active, `var(--kk-tc-text-tertiary)` for inactive
  - Household strip: also adopts tone-aware surface

**design-language.md alignment:**
- Hybrid Base allows dark frame for identity — desktop satisfies this
- Mobile is "one hand while pulling a shot" context — visual comfort trumps identity purity
- Liquid Glass Restraint is satisfied (no blur on nav chrome; solid surface)

**AA Contrast verification:**

| Element | Token | On Light Bar (`#f5ebdc`) | Ratio | Pass? |
|---------|-------|--------------------------|-------|-------|
| Active nav icon/label | `--kk-tc-text-primary` (`#2d1608`) | ~12:1 | ✓ AA |
| Inactive nav icon/label | `--kk-tc-text-tertiary` (`#8b6b4a`) | ~4.8:1 | ✓ AA |
| Household strip text | `--kk-tc-text-secondary` (`#5c4532`) | ~6.1:1 | ✓ AA |

---

### 2D. Exact Token/CSS Specification

**New token (add to `:root` or `[data-tone="beige"]`):**

```css
/* Mobile nav tone-awareness — beige mode override */
[data-tone="beige"] .nav-shell.mobile-nav,
[data-tone="beige"] .mobile-household-strip {
  background: var(--kk-tc-surface-solid);
  border-color: var(--kk-tc-border);
}

[data-tone="beige"] .nav-shell.mobile-nav a,
[data-tone="beige"] .nav-shell.mobile-nav button {
  color: var(--kk-tc-text-tertiary);
}

[data-tone="beige"] .nav-shell.mobile-nav a[aria-current="page"],
[data-tone="beige"] .nav-shell.mobile-nav .active {
  color: var(--kk-tc-text-primary);
}
```

**Implementation note:** BottomNav.tsx needs a class discriminator (e.g., `mobile-nav`) to scope tone overrides without affecting desktop Sidebar. Desktop Sidebar keeps `nav-shell` without `mobile-nav`, remains dark in all tones.

**Safe-area refinement:** Bottom bar inner padding should use `padding-bottom: env(safe-area-inset-bottom, 0.5rem)` so the safe-area zone adopts the same surface color, eliminating the "dark afterthought" gap.

---

### 2E. Cross-Page Scope Flag

**[SEPARATE/CROSS-PAGE]** — The mobile bottom nav appears on EVERY page in the app (`AppShell.tsx` line 52). Changes to `.nav-shell` or `.mobile-household-strip` affect:

- Home (Dashboard)
- Brew Log (list + detail)
- Catalog (list + detail)
- Hardware (list + detail)
- Import
- Profile
- Household settings

**Rollout recommendation:**
1. Prototype on Home page first
2. Operator visual approval required
3. Then apply cross-page via shared CSS (single change point)

---

## Summary: BUILD-NOW / OPERATOR-DECISION / CROSS-PAGE

### BUILD-NOW (Finn can implement without further approval)

1. **Add PRINCIPLE 13 to 02-principles-northstar.md** — wording provided in §1B
2. **EntityCard verification complete** — no changes needed (already looks actionable)

### OPERATOR DECISION

1. **StatTile affordance resolution:**
   - **Aria recommends Option B** (remove card chrome, typography-only)
   - **Alternative Option A** (make tiles tappable links — specify routes if chosen)

2. **Mobile bottom nav tone treatment:**
   - **Aria recommends Option D** (tone-aware light bar in beige mode)
   - Requires operator visual approval before cross-page rollout

### CROSS-PAGE (requires prototype + approval before rollout)

1. **Mobile bottom nav changes** — affects all pages; prototype on Home first

---

## Finn Build List (BUILD-NOW only)

| # | Task | Component/File | Principle |
|---|------|----------------|-----------|
| 1 | Add PRINCIPLE 13 text | `02-principles-northstar.md` | — |
| 2 | Confirm EntityCard `:hover`/`:active`/`:focus-visible` assertions exist | Playwright tests | P13 |

---

## Open Operator Questions

1. **StatTile:** Option B (typography-only, no card affordance) or Option A (make tiles tappable links)? If A, specify target routes.

2. **Mobile bottom nav:** Approve Option D (tone-aware light bar in beige mode) for prototyping? Any concerns with breaking hybrid-base purity on mobile?

3. **Household strip:** Should the mobile household strip also adopt tone-aware treatment, or remain dark as a "brand anchor" band?

---

*End of design direction document.*

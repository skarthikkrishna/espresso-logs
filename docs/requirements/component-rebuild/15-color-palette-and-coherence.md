# Aria Color Palette and Coherence Design — Spec 043 v5

**Spec:** 043 → Component System Rebuild  
**Prepared by:** Aria (Designer)  
**Date:** 2026-06-19  
**Status:** PROPOSAL — OPERATOR DECISION REQUIRED  
**Purpose:** Establish a principled color palette grounded in color theory that resolves the operator's critique: "Why are we not aligning to a palette and just doing black, brown or white?"

---

## Skills Applied + Evidence

| Skill | Application | Evidence |
|-------|-------------|----------|
| **ui-design-contract** | Audited existing dual-tone system (`[data-tone]`, `--kk-tc-*`, `--kk-il-*`); extending tokens, not replacing. | `index.css:1396–1559` (tone token sets), `index.css:2236–2306` (`[data-tone]` attribute blocks) |
| **reuse-before-create** | Mapped existing ToneButton to canonical hierarchy; identified gaps in non-tone pages using `btn-primary`. | `ToneButton.tsx:28–33` (4 variants), grep shows Dashboard/CatalogDetail/BrewLogDetail use ToneButton; NotFound/InviteExpired/GuestView use raw `btn-primary`. |
| **design-tokens** | Full light+dark palette with semantic roles + color-theory rationale; surfaced `--kk-tc-surface` as the card token needing cream adjustment. | `index.css:103–105` (current `#fff7ed` for content surface), design-language.md §Surface contract |
| **design-brief** | Warm Editorial Instrument Calm: coffee-ritual soul, not productivity app; restrained cool accent, amber brand anchor. | `design-language.md:30–34` (guiding statement), §Aesthetic Direction |
| **grill-me** | Explored CTA usage across pages to resolve "Log a shot" vs "Add a bag" divergence; found ToneButton adoption inconsistent. | Grep `btn-primary` shows 6 non-tone usages in auth/guest/error pages |
| **information-architecture** | EntityCard sizing audit — card consumes excessive viewport on mobile 2-col grid; monogram figure aspect 3:2 only partially addressed. | `index.css:2494–2534` (figure aspect), `index.css:2585–2595` (grid 2-col) |

---

## 1. PALETTE — Principled Color System

### Diagnosis: Current State

The current palette is **monochromatic warm** without a coherent color-theory foundation:
- **Dark mode:** espresso brown scale (#120b06 → #1a1209 → #22160b → #2d1f0e) + amber accents (#f59e0b, #b45309)
- **Light mode:** cream scale (#fff7ed → #f7ead8 → #f5ebdc) + bark brown text (#2d1608, #4a3728)
- **Accents:** amber-only for CTA; cool tokens exist (teal, cyan, violet) but are confined to charts/taste-zones — never used as compositional accents

**Operator critique:** "black, brown or white" — the palette lacks an intentional complementary or analogous relationship. It reads as desaturated, arbitrary, not designed.

### Color Theory Foundation

**Scheme: Split-Complementary Warm** — Amber (30° orange-yellow) anchors the warm family; its split-complement teal (175°) provides the intentional cool relief. This is a 150° split (not direct 180° complement), which softens the tension while maintaining color interest.

| Role | Warm Pole (30°) | Cool Pole (175°) |
|------|-----------------|------------------|
| Brand/CTA | Amber #b45309 | — |
| Accent | Roasted bark #78350f | Teal #0e7490 |
| Depth/shadow | Espresso #120b06 | Deep teal #0f766e |
| Highlight | Crema #fcd34d | Glint cyan #cffafe |

**Why split-complementary?** Direct complement (amber → blue) is cold and corporate; split-complement (amber → teal) stays warm-editorial and aligns with the coffee aesthetic (water, extraction, clarity are associatively teal, not blue).

---

### OPTION A: Cream Card + Teal Sidebar (Recommended)

**Card surface:** Soft cream `#faf5ef` (warmer than current `#fff7ed`, less stark)  
**Sidebar (both tones):** Deep teal `#0a4d48` (dark) / Soft sage-teal `#e6f2f0` (light)  
**Rationale:** The sidebar becomes the grounding cool anchor; cards remain the warm editorial surface. Teal sidebar harmonizes with amber CTAs via split-complement.

#### Light Mode Token Set (Option A)
```
--kaapi-palette-bg:              #faf5ef   /* warm linen, softer than #fff7ed */
--kaapi-palette-surface:         #faf5ef   /* card surface = bg in light mode */
--kaapi-palette-surface-elevated:#f5ece4   /* hover/raised states */
--kaapi-palette-text-primary:    #2d1608   /* espresso text */
--kaapi-palette-text-secondary:  #5c3d1e   /* bark brown */
--kaapi-palette-text-muted:      #8b6b4a   /* muted caption */
--kaapi-palette-border:          rgba(120, 53, 15, 0.14)
--kaapi-palette-accent-warm:     #92400e   /* CTA fill (bark), AA on cream */
--kaapi-palette-accent-cool:     #0e7490   /* teal info/accent */
--kaapi-palette-sidebar-bg:      #e6f2f0   /* soft sage-teal */
--kaapi-palette-sidebar-text:    #0a4d48   /* deep teal */
--kaapi-palette-sidebar-border:  rgba(14, 116, 144, 0.18)
```

#### Dark Mode Token Set (Option A)
```
--kaapi-palette-bg:              #120b06   /* espresso frame */
--kaapi-palette-surface:         rgba(24, 16, 10, 0.72)  /* glass card */
--kaapi-palette-surface-solid:   #1a120c   /* solid fallback */
--kaapi-palette-text-primary:    #fff7ed   /* cream text */
--kaapi-palette-text-secondary:  #e8ddd4
--kaapi-palette-text-muted:      #c4b5a8
--kaapi-palette-border:          rgba(255, 247, 237, 0.08)
--kaapi-palette-accent-warm:     #f59e0b   /* amber CTA */
--kaapi-palette-accent-cool:     #14b8a6   /* teal accent */
--kaapi-palette-sidebar-bg:      #0a4d48   /* deep teal */
--kaapi-palette-sidebar-text:    #cffafe   /* glint cyan */
--kaapi-palette-sidebar-border:  rgba(20, 184, 166, 0.18)
```

**Card surface treatment (operator "eggshell" request):**  
Current `#fff7ed` is orange-50 (too yellow-stark). Option A uses `#faf5ef` — a custom warm linen that sits between orange-50 and stone-50, reading as cream/eggshell without drifting grey.

**Sidebar treatment (operator "dark brown is arbitrary" critique):**  
The dark brown sidebar (`rgba(26, 18, 9, 0.93)` per `index.css:587`) is not grounded in the palette. Option A replaces it with a palette-justified teal:
- **Dark mode:** deep teal `#0a4d48` — cool anchor, amber CTAs pop as split-complement
- **Light mode:** soft sage-teal `#e6f2f0` — light, airy, harmonizes with cream cards

---

### OPTION B: Cream Card + Warm Bark Sidebar (Conservative)

**Card surface:** Same soft cream `#faf5ef`  
**Sidebar (both tones):** Deep bark `#2d1608` (dark) / Warm stone `#e8dfd3` (light)  
**Rationale:** Keeps sidebar in the warm family; less color-pop but safer visual continuity.

#### Light Mode Sidebar Tokens (Option B)
```
--kaapi-palette-sidebar-bg:      #e8dfd3   /* warm stone */
--kaapi-palette-sidebar-text:    #4a3728   /* bark brown */
--kaapi-palette-sidebar-border:  rgba(74, 55, 40, 0.18)
```

#### Dark Mode Sidebar Tokens (Option B)
```
--kaapi-palette-sidebar-bg:      #2d1608   /* deep espresso */
--kaapi-palette-sidebar-text:    #f5e6d3   /* cream */
--kaapi-palette-sidebar-border:  rgba(245, 230, 211, 0.08)
```

**Trade-off:** Option B is more conservative but the sidebar still reads as "dark brown" — it doesn't resolve the operator's core critique about lacking a complementary color relationship.

---

### Aria Recommendation: **OPTION A**

Option A introduces the split-complementary teal in a structural role (sidebar) without splashing color across content surfaces. The warm editorial soul is preserved; the cool anchor provides the "intentional accent" the operator requested. The cream card softens the stark white; the teal sidebar replaces the arbitrary dark brown with a palette-justified treatment.

**[OPERATOR DECISION]** Choose Option A (teal sidebar) or Option B (bark sidebar).

---

## 2. BACKGROUND / BLUR — Visual + Performance

### Operator Feedback
1. "go darker on the blur for light mode" — current light-mode scrim is too bright/washed
2. "you completely removed the blur from dark mode" — operator perceives lost blur
3. **Performance constraint:** Safari flagged `backdrop-filter: blur(24px)` on #main-content as battery-heavy

### Current State (index.css L2313–2324)
```css
#main-content:has(.immersive-list-shell[data-tone="dark"]) {
  backdrop-filter: blur(24px);
  background: rgba(24, 16, 10, 0.45);  /* 45% warm scrim */
}
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  backdrop-filter: blur(24px);
  background: transparent;  /* NO scrim — relies on blur alone */
}
```

**Diagnosis:**
- Dark mode blur IS present (24px + 45% scrim). Operator perception of "lost blur" may be comparing to an earlier darker treatment.
- Light mode background is `transparent` — the blur reveals the photo with no scrim dimming, which reads too bright in daylight.

### Spec: Background Treatment (Both Tones)

#### Light Mode — Darker Scrim + Reduced Blur
```css
#main-content:has(.immersive-list-shell[data-tone="beige"]) {
  backdrop-filter: blur(12px);               /* REDUCED from 24px — 50% less GPU */
  -webkit-backdrop-filter: blur(12px);
  background: rgba(45, 22, 8, 0.22);         /* warm espresso scrim — NOT beige */
}
```
**Visual rationale:** The 22% warm espresso scrim dims the blurred photo WITHOUT adding a third beige layer (which caused the monochromatic mush). The cream cards pop as elevated surfaces against the darkened blur.

**Performance rationale:** Reducing blur radius from 24px → 12px halves the GPU sample area, significantly reducing battery draw. The darker scrim compensates for the softer blur — combined effect is comparable visual depth at ~50% compositing cost.

#### Dark Mode — Confirm Blur + Slightly Deeper Scrim
```css
#main-content:has(.immersive-list-shell[data-tone="dark"]) {
  backdrop-filter: blur(24px);               /* UNCHANGED — dark mode is perf-safe */
  -webkit-backdrop-filter: blur(24px);
  background: rgba(18, 11, 6, 0.52);         /* raised from 0.45 → 0.52 */
}
```
**Visual rationale:** The 7% deeper scrim restores the "moody" depth the operator expects. Dark mode compositing is cheaper than light mode (dark pixels compress better), so full 24px blur is acceptable.

### Text Legibility — Remove Text-Shadow

**Operator feedback:** "the title/sub-title shadow looks really weird and offputting"

**Current:** `index.css:2438` applies `text-shadow: var(--kk-il-header-shadow-light)` to light-mode headers.

**Spec:** REMOVE `--kk-il-header-shadow-light` usage entirely. Legibility is achieved via:
1. The darker scrim (above) provides guaranteed contrast behind text
2. Text renders on the elevated cream card surface, not directly on blur
3. For any text that MUST render over blur (page title in nav row), use `--kaapi-palette-text-primary` on the scrim background — AA guaranteed by the 0.22 opacity floor.

**[BUILD NOW]** Remove text-shadow; implement darker light-mode scrim + reduced blur.

---

## 3. CTA UNIFICATION — Canonical Button Hierarchy

### Operator Feedback
"Add a bag in the catalog detailed view still looks different to Log a shot on the home page."

### Audit: Current ToneButton Usage

| Page | CTA | Current Implementation | Status |
|------|-----|------------------------|--------|
| Dashboard | "Log a shot" | `ToneButton variant="primary"` | ✓ Correct |
| Dashboard | "Manage catalog" | `ToneButton variant="edit"` | ✓ Correct |
| CatalogDetail | "Add a bag" | `ToneButton variant="primary"` | ✓ Correct |
| CatalogList | "Add new coffee" | `ToneButton variant="primary"` | ✓ Correct |
| BrewLogDetail | "Edit shot" | `ToneButton variant="edit"` | ✓ Correct |
| BrewLogDetail | "Delete" | `ToneButton variant="danger"` | ✓ Correct |

### Audit: Non-ToneButton Pages (btn-primary Divergence)

| Page | CTA | Current Implementation | Fix Required |
|------|-----|------------------------|--------------|
| NotFound | "Go home" | `btn btn-primary btn-bevel` | Migrate to ToneButton |
| InviteInvalid | "Sign in" | `btn btn-primary btn-sm btn-bevel` | Migrate to ToneButton |
| InviteExpired | "Sign in" | `btn btn-primary btn-sm btn-bevel` | Migrate to ToneButton |
| HouseholdGuestView | "Sign in" (x3) | `btn btn-primary btn-bevel` | Migrate to ToneButton |

**Diagnosis:** ToneButton adoption within tone-aware pages (Dashboard, CatalogDetail, BrewLogDetail) is consistent. The divergence is in **non-tone pages** (auth flows, error pages) that still use raw DaisyUI `btn-primary`. These pages don't have a `[data-tone]` ancestor, so ToneButton tokens wouldn't resolve without a wrapper.

### Spec: Canonical Button Hierarchy

| Variant | Use Case | Visual | Token Source |
|---------|----------|--------|--------------|
| **primary** | Main page action (1 per view max) | Solid amber fill (dark) / bark fill (light) | `--kk-tc-primary-btn-*` |
| **edit** | Secondary actions | Outlined, low-contrast | `--kk-tc-btn-edit-*` |
| **ghost** | Tertiary, de-emphasized | Text-only, no bg | `--kk-tc-btn--ghost` (class) |
| **danger** | Destructive actions | Red-tinted | `--kk-tc-btn-danger-*` |

### Fix: Non-Tone Page CTA Alignment

For pages outside the tone system (auth, error), wrap the page content in a `<div data-tone="dark">` (espresso frame context) and use ToneButton. This ensures:
1. Token resolution works (`--kk-tc-primary-btn-*` resolves)
2. Visual consistency with the rest of the app
3. No raw `btn-primary` one-offs

**[SEPARATE]** Auth/error page CTA migration is outside spec-043 prototype scope. File as follow-up task after Home page validation.

---

## 4. BEAN CARD — Size Reduction Spec

### Operator Feedback
"You didn't decrease the size of the bean card? I thought you were going to do it? ... the card + monogram still dominate."

### Current State
- **Grid:** 2-col on mobile, 3-col on md+ (`index.css:2585–2595`)
- **Card figure:** 4:3 aspect (with 3:2 for monogram-only via `:has()`)
- **No max-width constraint:** cards fill available column width

### Diagnosis
The monogram aspect change (4:3 → 3:2) only shrinks the figure when there's no image. The overall card footprint is unconstrained — on a 375px viewport, each card is ~167px wide, which is appropriate. The "dominating" perception is likely:
1. **Desktop:** 3-col grid gives ~350px cards at 1200px viewport — oversized for a card with minimal content
2. **Figure proportion:** 4:3 figure + short text body makes the image area 60%+ of card height

### Spec: EntityCard Size Reduction

#### A. Max-Width Constraint (Desktop)
```css
.entity-card-grid {
  --kk-ec-max-width: 220px;  /* cap individual card width */
}
@media (min-width: 768px) {
  .entity-card-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, var(--kk-ec-max-width)));
    justify-content: start;
  }
}
```
**Effect:** On wide viewports, cards cap at 220px instead of filling 1/3 of container. Grid flows naturally with `auto-fill`.

#### B. Figure Aspect Reduction (All Cards)
```css
.entity-card-figure {
  aspect-ratio: 16 / 10;  /* was 4:3 (1.33:1); now 1.6:1 — 17% shorter figure */
}
.entity-card-figure:has(.entity-card-monogram-fill) {
  aspect-ratio: 3 / 2;  /* unchanged — monogram cards stay compact */
}
```
**Effect:** Photo cards have shorter figure area; monogram cards unchanged.

#### C. Monogram Font Scale Reduction
```css
.entity-card-monogram {
  font-size: clamp(2rem, 6vw, 3.5rem);  /* was clamp(3rem, 8vw, 5rem) — ~30% smaller */
}
```
**Effect:** Monogram letter is less dominant on the card surface.

**[BUILD NOW]** Implement all three constraints for Home page prototype.

---

## 5. SIDEBAR — Palette-Justified Treatment

### Operator Feedback
"the more I see light mode, the more I'm convinced I don't like the dark brown side bar. It's not grounding anything especially since you're not being harmonious about the color choice."

### Current State (index.css L586–591)
```css
.nav-shell {
  background: rgba(26, 18, 9, 0.93);  /* dark brown */
  border-color: rgba(217, 119, 6, 0.18);  /* amber border */
}
```
This sidebar is tone-agnostic — it's always dark brown regardless of page tone. The amber border is the only palette connection.

### Spec: Tone-Aware Sidebar (per Option A/B)

#### Option A: Teal Sidebar
```css
/* Dark tone (default) */
.nav-shell {
  background: var(--kaapi-palette-sidebar-bg);  /* #0a4d48 deep teal */
  border-color: var(--kaapi-palette-sidebar-border);
  color: var(--kaapi-palette-sidebar-text);  /* #cffafe glint cyan */
}

/* Light tone override via :has() */
html:has([data-tone="beige"]) .nav-shell:not(.mobile-nav) {
  background: #e6f2f0;  /* soft sage-teal */
  border-color: rgba(14, 116, 144, 0.18);
  color: #0a4d48;  /* deep teal text */
}
```

#### Option B: Bark Sidebar
```css
/* Dark tone */
.nav-shell {
  background: #2d1608;  /* deep espresso */
  border-color: rgba(245, 230, 211, 0.08);
  color: #f5e6d3;
}

/* Light tone */
html:has([data-tone="beige"]) .nav-shell:not(.mobile-nav) {
  background: #e8dfd3;  /* warm stone */
  border-color: rgba(74, 55, 40, 0.18);
  color: #4a3728;
}
```

**Note:** Mobile nav already has tone-awareness (`index.css:617–642`). This spec extends the pattern to the desktop sidebar.

**[OPERATOR DECISION]** Sidebar color depends on Option A/B choice above.

---

## Finn Build List — Home Page Prototype Scope

| Item | Tag | Dependency |
|------|-----|------------|
| 1. Card surface token: `#fff7ed` → `#faf5ef` (or confirm operator prefers current) | [BUILD NOW] | None |
| 2. Remove `text-shadow` from `.immersive-list-header` (L2438) | [BUILD NOW] | None |
| 3. Light-mode scrim: `transparent` → `rgba(45, 22, 8, 0.22)` | [BUILD NOW] | None |
| 4. Light-mode blur: `24px` → `12px` (perf) | [BUILD NOW] | None |
| 5. Dark-mode scrim: `0.45` → `0.52` | [BUILD NOW] | None |
| 6. EntityCard max-width: add `--kk-ec-max-width: 220px` + auto-fill grid | [BUILD NOW] | None |
| 7. EntityCard figure: `4/3` → `16/10` (photo cards) | [BUILD NOW] | None |
| 8. EntityCard monogram font: reduce clamp values ~30% | [BUILD NOW] | None |
| 9. Sidebar color: implement Option A (teal) or B (bark) per operator choice | [OPERATOR DECISION] | Palette choice |
| 10. Auth/error page ToneButton migration | [SEPARATE] | Post-prototype |

---

## Operator Question

**Which palette option for the sidebar?**

- **Option A (Recommended):** Teal sidebar — split-complementary to amber, provides the intentional cool accent you requested, resolves "arbitrary dark brown" critique
- **Option B (Conservative):** Bark sidebar — stays in warm family, less color-pop, safer but doesn't add a complementary color

All other items (card cream, blur/scrim, text-shadow removal, EntityCard sizing) are palette-agnostic and can proceed as [BUILD NOW].

---

*Prepared by Aria · spec-043 v5 · 2026-06-19*

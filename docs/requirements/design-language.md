<!-- SYNCED COPY — canonical source in the governance hub repo. Do not edit here; edit the canonical file and re-sync. Last synced: 2026-06-13 (spec-043). -->
# Design Language — Coffee Tracker

> **Purpose.** The single authoritative reference for the visual aesthetic, component conventions,
> design tokens, and image sourcing strategy. Finn (frontend) and Aria (designer) use this as their
> primary brief. Updated at spec-030 to reflect the current React + DaisyUI v5 + Tailwind v4 stack
> and to codify the Liquid Glass, Smooth Bevel, and iOS Readiness design vocabulary.
>
> **Stack:** React + TypeScript + Vite + DaisyUI v5 + Tailwind v4 · Theme: `espresso-dark` in `frontend/src/index.css`
>
> **Version note:** spec-043 thesis reconciliation — 2026-06-13. Encodes the
> Warm Editorial Instrument Calm thesis: an espresso-dark frame/chrome with solid, light, elevated
> warm content surfaces; chrome/overlay/sheet-only blur; restrained semantic color; density-keyed
> photographic backgrounds; subtle ambient depth; and Fable-level fluidity expectations. The WebGL
> cap remains two foreground three.js surfaces plus one shared `KaapiAmbientLayer` context. An
> authoritative synced copy is maintained in `espresso-logs/docs/requirements/design-language.md`
> for build-time application; Maya should formalize the durable sync mechanism as an ADR.

---

## Aesthetic Direction

| Reference | Role | What it contributes |
|-----------|------|---------------------|
| [MNTN Landing Page](https://www.figma.com/community/file/788675347108478517/mntn-landing-page) | **Primary** | Dark, moody, craft aesthetic, editorial photography, deliberate negative space. Primary mood — unchanged. |
| [Liquid Glass Figma plugin](https://www.figma.com/community/plugin/1514318033243634607/liquid-glass) | **Secondary** | Frosted translucency, inner highlights, smooth edges, subtle blur. Reference for modal/overlay treatment. |
| YouTube Liquid Glass video | **Binding aesthetic reference** | Real translucency/refraction and material depth. Implemented as WebKit-safe fallback plus non-WebKit progressive blur tier only. |
| [Modern Product Launch](https://www.figma.com/community/file/1487309170684591074/modern-product-launch) | **Secondary** | Clean layout, high contrast CTAs, polished card surfaces, refined spacing. Reference for card and button elevation. |
| [Login Page Perfect UI](https://www.figma.com/community/file/1050476989533233612/login-page-perfect-ui-freebie) | **Tertiary** | Elegant form inputs, minimal field styling, premium interaction feel. Reference for form input treatment. |

**Guiding aesthetic statement:** The app should feel like a calm precision instrument — espresso-dark
in its frame, warm and instantly legible in its work surfaces, tactile through motion rather than
ornament. Interactive elements have physical weight because they respond gracefully to touch, focus,
scroll, and state changes; the material system is restrained, not cloying.

### Hybrid base and surface contract

Kaapi Kadai uses a **hybrid base**. The product identity lives in the espresso-dark frame: sidebar,
bottom navigation, AppShell chrome, background canvas, modal/sheet chrome, and page atmosphere. The
work itself lives on **solid, light, elevated warm content surfaces**. Operational content means any
shot data, forms, tables, rows, cards, metrics, settings, auth/invite tasks, modal body content,
alerts, badges that carry state, and controls that the user must read or operate.

**Surface contract:** operational content always sits on a guaranteed-contrast solid light surface.
That surface does not depend on a photograph, glass translucency, blur, ambient darkness, or a dark
card to become readable. WCAG AA contrast is required on both sides of the hybrid base: light warm
content surfaces and espresso-dark frame/chrome. The dark frame may be expressive; the content plane
must be trustworthy, calm, and immediately legible.

---

## Core Principles

| Principle | Description |
|-----------|-------------|
| **Hybrid base** | Espresso-dark frame/chrome carries identity; solid light elevated warm surfaces carry operational content. Light mode as a full product mode remains future work. |
| **Surface contract** | Shot data, forms, rows, cards, metrics, settings, auth/invite tasks, modal body content, and other operational surfaces always sit on guaranteed-contrast solid light surfaces. |
| **Craft, not productivity** | Visual language communicates ritual and care, not efficiency metrics. |
| **Typography-led** | Strong typographic hierarchy carries the UX. Avoid decorative UI chrome. |
| **Photography-anchored, density-keyed** | Photographic route backgrounds remain warm atmosphere behind the surface contract; prominence is tuned by page density and scrim depth, not blanket-retired. |
| **Mobile-first** | Every layout is designed for a phone in one hand while pulling a shot with the other. Two breakpoints: 375px baseline and 768px (`md:`). |
| **Liquid Glass restraint** | Real blur/glass is confined to chrome, overlays, modals, and sheets. Repeated operational content cards/rows are solid; no `backdrop-filter` on content cards, controls, dense lists, tables, badges, chips, pagination, or arbitrary containers. |
| **Motion-led tactility** | Smooth Bevel remains restrained material support, but tactility comes primarily from fluid route, scroll, layer, primitive, text/clip, pointer, and focus motion with reduced-motion parity. |
| **iOS Readiness** | Every interactive element is Safari/WebKit-safe. `-webkit-` prefixes, tap-highlight suppression, and `appearance: none` are not optional. |
| **Consistency mandate** | Every primary button computes identical `box-shadow`. Every modal computes identical `backdrop-filter`. This is enforced by Playwright assertions — not aspirational. |

---

## Stack Reference

| Layer | Technology | Config location |
|-------|-----------|----------------|
| Build | Vite | `vite.config.ts` |
| Language | React + TypeScript | `tsconfig.json` |
| CSS framework | Tailwind v4 | `@import "tailwindcss"` in `index.css` |
| Component library | DaisyUI v5 | `@plugin "daisyui"` in `index.css` |
| Theme | `espresso-dark` (custom) | `@plugin "daisyui/theme"` block in `frontend/src/index.css` |
| Design tokens | CSS custom properties | Inside the `espresso-dark` theme block in `index.css` |
| Component styles | `@layer components` block | After the `@plugin` blocks in `index.css` |
| Fonts | Playfair Display + Inter | Loaded via npm / CSS `@font-face` — no CDN links in components |

---

## DaisyUI `espresso-dark` Theme

Base token values defined in `frontend/src/index.css`:

```css
@plugin "daisyui/theme" {
  name: "espresso-dark";
  default: true;
  color-scheme: dark;
  --color-primary:          #d97706;   /* warm amber CTA */
  --color-primary-content:  #ffffff;
  --color-secondary:        #92400e;   /* roasted bark */
  --color-secondary-content:#ffffff;
  --color-accent:           #f59e0b;   /* crema gold */
  --color-accent-content:   #1a1209;
  --color-neutral:          #2d1f0e;
  --color-neutral-content:  #f5e6d3;
  --color-base-100:         #1a1209;   /* page background */
  --color-base-200:         #22160b;   /* card background */
  --color-base-300:         #2d1f0e;   /* card hover / input bg */
  --color-base-content:     #f5e6d3;

  --kaapi-frame-bg:          #120b06;   /* espresso-dark frame/chrome floor */
  --kaapi-frame-surface:     #1a1209;   /* AppShell/sidebar/nav chrome */
  --kaapi-content-surface:   #fff7ed;   /* solid warm operational content */
  --kaapi-content-surface-2: #f7ead8;   /* elevated warm secondary content */
  --kaapi-content-border:    rgba(120, 53, 15, 0.18);
  --kaapi-content-content:   #2d1608;   /* primary text on light content surfaces */
  --kaapi-content-muted:     #6b4a2f;
  --kaapi-content-shadow:    0 18px 44px rgba(18, 11, 6, 0.28), 0 2px 8px rgba(18, 11, 6, 0.18), inset 0 1px 0 rgba(255,255,255,0.72);

  --color-info:             #0e7490;   /* app-wide info/status teal */
  --color-info-content:     #ffffff;
  --color-success:          #10b981;
  --color-warning:          #f59e0b;
  --color-error:            #ef4444;

  --kaapi-accent-teal:          #14b8a6;  /* taste-zone / secondary cool accent */
  --kaapi-accent-teal-content:  #041f1d;
  --kaapi-accent-cyan:          #67e8f9;  /* acidic/bright taste accent */
  --kaapi-accent-violet:        #a78bfa;  /* channeled/fault taste accent */
  --kaapi-depth-teal:           #0f766e;  /* cool depth shadow / panel edge */
  --kaapi-glint-cool:           #cffafe;  /* extraction glint / cool highlight */

  --kaapi-ambient-clear:        #120b06;
  --kaapi-ambient-vignette:     rgba(6, 4, 2, 0.58);
  --kaapi-ambient-warm-fog:     rgba(180, 83, 9, 0.18);
  --kaapi-ambient-deep-fog:     rgba(45, 31, 14, 0.72);
  --kaapi-ambient-cool-glint:   rgba(207, 250, 254, 0.18);
  --kaapi-ambient-depth-teal:   rgba(15, 118, 110, 0.16);
  --kaapi-ambient-static-gradient: radial-gradient(circle at 18% 22%, rgba(180, 83, 9, 0.18), transparent 34%), radial-gradient(circle at 78% 18%, rgba(207, 250, 254, 0.10), transparent 28%), radial-gradient(circle at 55% 82%, rgba(15, 118, 110, 0.12), transparent 36%), linear-gradient(135deg, #120b06 0%, #1a1209 42%, #22160b 72%, #0f0905 100%);
}
```

**Semantic colour usage guide:**

Color is minimal and semantic. Amber (`primary` / `accent`) is the brand and CTA anchor, not a page
wash. Cool accents are restrained tools for information, status, taste, chart depth, and approved
extraction/depth glints. Brew methods are differentiated by content, structure, labels, and
iconography first — not by assigning every method its own hue.

| Token | Use |
|-------|-----|
| `primary` / `btn-primary` | Add Shot CTA, form submit, active nav icon |
| `secondary` | Secondary actions (Edit, Filter) |
| `accent` | God Shot badge, Compass "Sweet & Balanced" zone; amber remains the primary brand/CTA family |
| `info` / `alert-info` / `badge-info` | Informational status surfaces, invite notices, non-error guidance; app-wide teal, not a local one-off |
| `--kaapi-accent-teal` | Taste-zone target/secondary cool accent when amber would imply CTA/brand action |
| `--kaapi-accent-cyan` | Acidic & Bright / under-extracted pleasant taste cue and cool extraction highlights |
| `--kaapi-accent-violet` | Salty / Channeled under-extraction fault cue |
| `--kaapi-depth-teal` | Cool depth edge/shadow tint for charts or non-CTA panels |
| `--kaapi-glint-cool` | Extraction glint and cool highlight gradients on approved visualization surfaces |
| `--kaapi-ambient-*` | Shared app-shell ambient depth only; values sourced from `specs/043-kaapi-kadai-design-coherence/ambient-layer-design.md` |
| `base-200` | Card backgrounds, form panels |
| `base-300` | Input fields, table stripes |
| `success` | Active bag badge, Good Espresso badge |
| `warning` | Passable badge, "low beans" indicator |
| `error` | Reject badge, validation errors, over-extracted zones |
| `neutral` | Finished bag badge, metadata text |

**Palette guardrails:** Amber (`primary` / `accent`) remains the primary CTA and brand anchor. Cool
accents are sanctioned only for information/status, taste-zone encoding, chart depth, and extraction
glint semantics listed above. They are not a broad decorative palette. Raw hex or RGBA values are
prohibited outside token definitions and the documented Extraction Compass visualization-zone values.
Brew-method distinction must come from labels, structure, iconography, and content grouping before
color; a method-color rainbow is a design regression.

**`--color-info` blast radius:** Changing `--color-info` from `#3b82f6` to `#0e7490` affects every
DaisyUI `alert-info`, `badge-info`, `btn-info`, and related info surface app-wide. Any implementation
of this amendment requires a WCAG AA contrast audit across all info surfaces, including surfaces
outside the immediate design-coherence scope such as the Login invite notice.

---

## Design Principles: Liquid Glass

**Baseline scope:** AppShell chrome, modal/dialog backdrops, overlay chrome, and sheet chrome ONLY.
`backdrop-filter` remains prohibited on operational content cards, buttons, dense lists, table rows,
badges/chips, pagination, expanders, and arbitrary containers. Content cards and rows receive depth
from solid warm light surfaces, shadow, border, and restrained glint — never from blur.

**Progressive enhancement scope:** On capable, non-WebKit engines only, real translucency/refraction
may be added to chrome/overlay/sheet surfaces:

1. AppShell/chrome surfaces that are not operational reading planes, such as `#main-content` veil or
   documented shell chrome wrappers.
2. Overlay and sheet layers implemented as `.glass-overlay`, `.glass-sheet`, `.modal-backdrop`, or
   an approved modal/sheet chrome wrapper.

`GlassCard` / `.liquid-card`, dashboard `HeroVisualFrame` / `.hero-visual-frame`, dense brew-log
lists, table rows, repeated list items, every button, badges/chips, pagination, expanders, and
arbitrary containers are not eligible. The fallback surface treatment must remain defined for every
eligible chrome/overlay/sheet surface, and the blur tier is purely additive: no text, icon, border,
or contrast decision may depend on blur for legibility.

**Required feature gate for progressive blur:**

```css
@supports (backdrop-filter: blur(1px)) and (not (-webkit-touch-callout: none)) {
  #main-content,
  .glass-chrome,
  .glass-overlay,
  .glass-sheet,
  .modal-backdrop {
    backdrop-filter: var(--glass-blur);
  }
}
```

Use this exact gate unless Maya approves and records an equivalent capability/engine check.
`(backdrop-filter: blur(1px))` confirms unprefixed support; `(not (-webkit-touch-callout: none))`
excludes WebKit so Safari and iOS continue to receive the safe shadow/gradient-glint baseline.
The progressive tier reuses `var(--glass-blur)` (`blur(16px)`) and does not add
`-webkit-backdrop-filter` to these progressive chrome/overlay/sheet surfaces.

**Mandatory fallback for every progressive surface:**

```css
background: var(--glass-bg);
border-top: 1px solid var(--glass-border);
border-left: 1px solid var(--glass-border);
box-shadow: var(--glass-highlight), var(--bevel-shadow-raised);
```

**Reduced transparency:** If `prefers-reduced-transparency: reduce` is present, remove progressive
blur and keep the fallback depth treatment. Do not substitute opacity changes that reduce contrast.

```css
@media (prefers-reduced-transparency: reduce) {
  #main-content,
  .glass-chrome,
  .glass-overlay,
  .glass-sheet,
  .modal-backdrop {
    backdrop-filter: none;
  }
}
```

**Modal/AppShell implementation recipe:**

```css
/* Modal backdrop — apply to the overlay element, not the surface card */
backdrop-filter: var(--glass-blur);
-webkit-backdrop-filter: var(--glass-blur);
background: var(--glass-bg);
border-top: 1px solid var(--glass-border);
border-left: 1px solid var(--glass-border);
box-shadow: var(--glass-highlight), 0 8px 32px rgba(0, 0, 0, 0.6);
```

**Why baseline `backdrop-filter` is scoped:** Each `backdrop-filter` element creates a GPU
compositing layer in WebKit. Applying it to N card instances multiplies compositing cost with card
count and causes frame drops on iOS Safari. One modal overlay + one AppShell shell = two
compositing layers total. This remains the WebKit ceiling.

**Both `-webkit-` and unprefixed declarations are required for modal backdrops and `#main-content`.**
DaisyUI's `.modal-backdrop` may not supply the prefix — Finn must add it explicitly.

---

## Design Principles: Motion and WebGL Surface Cap

**Allowed three.js/WebGL ownership:** spec-043 amends the spec-042 baseline from exactly two total
WebGL surfaces to **two foreground three.js surfaces plus one shared app-shell ambient context**.
The sanctioned owners are:

1. Dashboard hero foreground accent (`HeroVisualFrame` / `DashboardHero3D`)
2. Extraction/brew visualization foreground surface
3. Shared app-shell ambient layer (`KaapiAmbientLayer`)

`KaapiAmbientLayer` is shell infrastructure, not a route/page/card feature. It is mounted once behind
AppShell/`#main-content`, reused across route transitions, `aria-hidden`, non-interactive,
non-focusable, and visually subordinate to content. It must not carry product meaning, navigation
state, household state, data meaning, or user-facing copy.

**Ambient guardrails:** Aria's approved ambient source of truth is
`specs/043-kaapi-kadai-design-coherence/ambient-layer-design.md`. Implementation must preserve:

- one shared WebGL context only; no per-route canvas, per-card 3D, modal WebGL, route-specific ambient shader, or card-local parallax;
- `KAAPI_AMBIENT_DPR_MAX = 1.5`;
- throttled frame cadence: `KAAPI_AMBIENT_FPS_VISIBLE = 30`, `KAAPI_AMBIENT_FPS_IDLE = 8`, and idle pause/reduce after `KAAPI_AMBIENT_IDLE_PAUSE_MS = 4500`;
- immediate pause when `document.visibilityState` is hidden;
- `prefers-reduced-motion`, no-WebGL, preload, dynamic-import error, and context-loss fallback to `--kaapi-ambient-static-gradient`, never a blank/dark box;
- subtle calm depth only: ambient is behind content, low-contrast, rare-glint, and never fog/smoke/particle spectacle;
- behind-content layering that preserves WCAG AA contrast with ambient active, static, disabled, and context-lost;
- lazy loading counted inside the spec-042 gzip bundle budget;
- renderer/context disposal and `webglcontextlost` handling without leaking or multiplying contexts.

Foreground 3D surfaces retain their own reduced-motion/no-WebGL fallbacks and do not authorize any
additional canvases. Per-card 3D and per-route canvases remain prohibited.

---

## Design Principles: Smooth Bevel

**Scope:** All primary buttons, secondary buttons, and card/content surfaces. Operational content
cards use solid light warm content tokens plus `box-shadow` for baseline depth. No content card may
add `backdrop-filter`, including `GlassCard` when it is used as a repeated card/row/form/panel
surface. Glass naming in legacy components does not override the surface contract.

**Three-layer box-shadow recipe (all three layers are required on every primary button):**

| Layer | Value | Role |
|-------|-------|------|
| Outer diffuse | `0 4px 16px rgba(0,0,0,0.5)` | Depth / ambient shadow |
| Outer edge | `0 1px 3px rgba(0,0,0,0.8)` | Edge definition |
| Inner highlight | `inset 0 1px 0 rgba(255,255,255,0.08)` | Top surface light catch |

**Active/pressed state inverts the inner shadow:**
- Remove outer diffuse; keep only a compressed outer shadow
- Replace inner highlight with `inset 0 2px 6px rgba(0,0,0,0.6)` — surface appears pressed

**Border rule:** No hard `border` on primary buttons. Shadow provides all edge definition. A subtle
`1px solid var(--glass-border)` is permitted on secondary/outline variants.

**Border-radius:** `var(--bevel-radius)` = `0.625rem` (10px) on all interactive elements, uniformly.

---

## Design Principles: iOS Readiness

The app is the WebKit PWA underlying the iOS native layer. Every CSS rule must be Safari/WebKit-safe.

| Requirement | Rule | Selector |
|-------------|------|----------|
| No grey tap flash | `-webkit-tap-highlight-color: transparent` | `.btn, [role="button"], a` |
| No native select chrome | `appearance: none; -webkit-appearance: none` | `select` elements |
| No browser blue focus ring | `outline: none; box-shadow: var(--input-focus-ring)` | `:focus` on inputs; `:focus-visible` on buttons |
| WebKit blur prefix | `-webkit-backdrop-filter` alongside `backdrop-filter` | Baseline `#main-content` and modal backdrop glass only; progressive non-WebKit glass tier stays unprefixed inside its `@supports` gate |
| Border-radius clip safety | `overflow: hidden` on buttons with non-zero `border-radius` | `.btn, .btn-bevel` |
| Placeholder opacity | `opacity: 0.6` on `::placeholder` | All form inputs |
| Font smoothing | `-webkit-font-smoothing: antialiased` | `body` |

**Note on Playwright verification:** `-webkit-tap-highlight-color` is not reflected in
`getComputedStyle` output from the Desktop Safari agent. Finn performs manual verification on
iOS Safari or Simulator for R3 items. All other WebKit requirements are Playwright-assertable.

---

## Design Token Reference

All tokens live inside the `@plugin "daisyui/theme"` block in `frontend/src/index.css`,
scoped to `[data-theme="espresso-dark"]`. Finn implements these exact values.

### Surface Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `--kaapi-frame-bg` | `#120b06` | Espresso-dark frame/canvas floor |
| `--kaapi-frame-surface` | `#1a1209` | Sidebar, AppShell, navigation, and dark chrome surfaces |
| `--kaapi-content-surface` | `#fff7ed` | Solid warm operational content surface |
| `--kaapi-content-surface-2` | `#f7ead8` | Slightly elevated/secondary warm content surface |
| `--kaapi-content-border` | `rgba(120, 53, 15, 0.18)` | Subtle warm edge on light content surfaces |
| `--kaapi-content-content` | `#2d1608` | Primary text/icons on light content surfaces |
| `--kaapi-content-muted` | `#6b4a2f` | Secondary/meta text on light content surfaces |
| `--kaapi-content-shadow` | `0 18px 44px rgba(18, 11, 6, 0.28), 0 2px 8px rgba(18, 11, 6, 0.18), inset 0 1px 0 rgba(255,255,255,0.72)` | Light-surface elevation and top light catch |

### Glass / Chrome Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `--glass-bg` | `rgba(15, 10, 8, 0.72)` | AppShell/modal/overlay/sheet chrome background; not repeated content-card fill |
| `--glass-blur` | `blur(16px)` | Chrome/overlay/sheet `backdrop-filter` value only |
| `--glass-border` | `rgba(255, 255, 255, 0.08)` | Glass chrome edge top/left highlight border |
| `--glass-highlight` | `inset 0 1px 0 rgba(255,255,255,0.08)` | Chrome inner top highlight (box-shadow layer) |

### Palette / Cool Accent Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `--color-info` | `#0e7490` | DaisyUI info/status surfaces: `alert-info`, info badges/buttons, invite notices |
| `--color-info-content` | `#ffffff` | Text/icon content on `--color-info`; must pass WCAG AA on every info surface |
| `--kaapi-accent-teal` | `#14b8a6` | Taste-zone target/secondary cool accent where amber would imply primary CTA |
| `--kaapi-accent-teal-content` | `#041f1d` | Text/icon content on teal accent chips or labels |
| `--kaapi-accent-cyan` | `#67e8f9` | Acidic & Bright / pleasant under-extraction taste cue |
| `--kaapi-accent-violet` | `#a78bfa` | Salty / Channeled under-extraction fault cue |
| `--kaapi-depth-teal` | `#0f766e` | Cool depth tint for chart panels, edges, and non-CTA visualization surfaces |
| `--kaapi-glint-cool` | `#cffafe` | Extraction glint / cool highlight gradient stop on approved visualization surfaces |

### Ambient Layer Tokens and Constants

Aria's approved ambient source of truth is `specs/043-kaapi-kadai-design-coherence/ambient-layer-design.md`.
Finn mirrors these CSS tokens in `frontend/src/index.css` and may mirror constants in TypeScript for shader/runtime use.

| Token / constant | Value | Purpose |
|---|---:|---|
| `--kaapi-ambient-clear` | `#120b06` | Canvas clear/static fallback floor; darker than base without becoming black |
| `--kaapi-ambient-vignette` | `rgba(6, 4, 2, 0.58)` | Edge vignette preserving content contrast |
| `--kaapi-ambient-warm-fog` | `rgba(180, 83, 9, 0.18)` | Espresso/crema volumetric fog tint |
| `--kaapi-ambient-deep-fog` | `rgba(45, 31, 14, 0.72)` | Deep roasted volume and fallback middle stop |
| `--kaapi-ambient-cool-glint` | `rgba(207, 250, 254, 0.18)` | Maximum cool highlight opacity |
| `--kaapi-ambient-depth-teal` | `rgba(15, 118, 110, 0.16)` | Deep cool edge tint echoing `--kaapi-depth-teal` |
| `--kaapi-ambient-static-gradient` | `radial-gradient(circle at 18% 22%, rgba(180, 83, 9, 0.18), transparent 34%), radial-gradient(circle at 78% 18%, rgba(207, 250, 254, 0.10), transparent 28%), radial-gradient(circle at 55% 82%, rgba(15, 118, 110, 0.12), transparent 36%), linear-gradient(135deg, #120b06 0%, #1a1209 42%, #22160b 72%, #0f0905 100%)` | Required static fallback for preload, reduced-motion, no-WebGL, error, and context-loss states |
| `KAAPI_AMBIENT_DPR_MAX` | `1.5` | Shared canvas DPR cap |
| `KAAPI_AMBIENT_FPS_VISIBLE` | `30` | Maximum active visible cadence |
| `KAAPI_AMBIENT_FPS_IDLE` | `8` | Idle cadence before full pause |
| `KAAPI_AMBIENT_IDLE_PAUSE_MS` | `4500` | Pointer/scroll idle threshold before reducing or pausing RAF |

### Bevel / Depth Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `--bevel-shadow-raised` | `0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)` | Button/card default state — three-layer recipe |
| `--bevel-shadow-inset` | `inset 0 2px 6px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.9)` | Button active/pressed state — inverted |
| `--bevel-radius` | `0.625rem` | Unified border-radius for all interactive elements |

### Button State Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `--btn-rest-shadow` | `0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)` | Button default state (alias for `--bevel-shadow-raised`) |
| `--btn-hover-shadow` | `0 6px 20px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.10)` | Button hover — elevated |
| `--btn-active-shadow` | `inset 0 2px 6px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.9)` | Button pressed (alias for `--bevel-shadow-inset`) |
| `--btn-disabled-opacity` | `0.4` | Disabled interactive elements — flat, no shadow |

### Form Input Tokens

| Token | Value | Purpose |
|-------|-------|---------|
| `--input-bg` | `var(--kaapi-content-surface)` | Solid light form input background |
| `--input-border` | `1px solid var(--kaapi-content-border)` | Warm light-surface form input border |
| `--input-focus-ring` | `0 0 0 2px rgba(217, 119, 6, 0.45)` | Amber focus ring — applied via `box-shadow`, suppresses browser blue outline |
| `--input-label-gap` | `0.375rem` | Gap between label and input control |

### Motion / Fluidity Tokens

Exact values may be refined by Aria/Finn, but implementation must use named reusable tokens rather
than page-local one-off easing.

| Token | Role |
|---|---|
| `--motion-duration-instant` | 80–120ms final-state feedback and reduced-motion settle. |
| `--motion-duration-micro` | 140–180ms button/card/nav hover, focus, and press feedback. |
| `--motion-duration-enter` | 280–420ms card/list/section entrance choreography. |
| `--motion-duration-route` | 450–650ms route/layer transition. |
| `--motion-duration-ambient-settle` | 700–1200ms ambient/pointer/scroll settle. |
| `--motion-ease-standard` | Default calm material ease. |
| `--motion-ease-emphasized` | Route/layer enter/exit with richer deceleration. |
| `--motion-ease-press` | Button press/release with no bouncy overshoot. |
| `--motion-stagger-card` | Short card/list stagger that preserves scanning speed. |
| `--motion-clip-reveal-distance` | Maximum text/clip mask travel. |
| `--motion-depth-hover-max-px` | Maximum pointer/hover depth translation using 2D transforms. |

**Total CSS tokens defined: 38 plus motion tokens, plus ambient runtime constants mirrored from the design spec.**

---

## State Variants

### Primary Button States

| State | `box-shadow` token | Opacity | Cursor |
|-------|-------------------|---------|--------|
| Rest | `var(--btn-rest-shadow)` | 1.0 | `pointer` |
| Hover | `var(--btn-hover-shadow)` | 1.0 | `pointer` |
| Active / Pressed | `var(--btn-active-shadow)` | 1.0 | `pointer` |
| Disabled | none (flat) | `var(--btn-disabled-opacity)` = 0.4 | `not-allowed` |
| Focus-visible | `var(--btn-rest-shadow)` + `var(--input-focus-ring)` | 1.0 | `pointer` |

**Disabled state rule:** Disabled elements are intentionally stripped of the bevel effect to
communicate non-interactivity. No `box-shadow`. No `backdrop-filter`. Background at full opacity
with opacity modifier handling visual weight.

### Form Input States

| State | `border` | `box-shadow` | Background |
|-------|----------|-------------|------------|
| Rest | `var(--input-border)` | none | `var(--input-bg)` |
| Focus | `1px solid rgba(217, 119, 6, 0.5)` | `var(--input-focus-ring)` | `var(--input-bg)` |
| Error | `1px solid rgba(239, 68, 68, 0.6)` | `0 0 0 2px rgba(239, 68, 68, 0.3)` | `var(--input-bg)` |
| Disabled | `var(--input-border)` | none | `var(--input-bg)` at `opacity: 0.4` |

**Placeholder:** `opacity: 0.6` on all `::placeholder` pseudo-elements. No browser default grey.

---

## Consistency Mandate

**This is not aspirational. Quinn's gate verifies it via Playwright assertions.**

> Every primary button in the app MUST have identical computed `box-shadow`.
> Every modal MUST have identical computed `backdrop-filter`.
> Every form input MUST have identical computed `background-color` and `border`.
> Every card MUST have identical `border-radius`.

Playwright asserts consistency by computing the value on three or more target elements
and asserting equality — not just non-emptiness:

```typescript
// Button consistency — all three must be identical
const shadows = await Promise.all([
  addShotBtn.evaluate(el => getComputedStyle(el).boxShadow),
  logMaintenanceBtn.evaluate(el => getComputedStyle(el).boxShadow),
  editCatalogBtn.evaluate(el => getComputedStyle(el).boxShadow),
]);
expect(shadows[0]).toBe(shadows[1]);
expect(shadows[1]).toBe(shadows[2]);

// Modal backdrop-filter
const bf = await backdrop.evaluate(el => {
  const s = getComputedStyle(el);
  return s.backdropFilter || s.getPropertyValue('-webkit-backdrop-filter');
});
expect(bf).toMatch(/blur\(\d/);
```

If a new button is added to any page and does not receive the `.btn-bevel` class (or equivalent
token consumption), it is a consistency regression and must be caught before merge.

---

## Executable UI Contract

This section turns reusable lessons from feature specs into the standing contract for all future
Coffee Tracker UI design, implementation, and review.

### Authority

- `docs/requirements/design-language.md` is canonical for UI language, token vocabulary, component
  classes, and visual verification rules.
- Spec folders, including `specs/039-*`, are historical evidence. Durable lessons belong here before
  they are reused outside a spec folder.
- Future UI work MUST use the spec-030 token and class vocabulary in this document unless Aria
  explicitly reopens the design gate and records the approved change.
- Do not duplicate design truth in agent charters, skills, or prompts. Those artifacts link back here
  and operationalize this contract.

### Interaction and surface rules

- **Surface contract:** operational content always sits on solid light warm elevated surfaces using
  `--kaapi-content-*` tokens. The content plane must pass WCAG AA without help from photography,
  blur, translucent cards, or ambient darkness.
- **Blur scope baseline:** `backdrop-filter` is allowed only on AppShell/chrome, modal/dialog
  backdrops, overlays, and sheet chrome. Buttons, content cards, dense lists, table rows, badges,
  chips, pagination, expanders, and arbitrary containers never receive blur.
- **Progressive blur tier:** `#main-content`, `.glass-chrome`, `.glass-overlay`, `.glass-sheet`, and
  `.modal-backdrop` may add `backdrop-filter: var(--glass-blur)` only inside `@supports
  (backdrop-filter: blur(1px)) and (not (-webkit-touch-callout: none))`. Content surfaces including
  `GlassCard` / `.liquid-card` and `HeroVisualFrame` / `.hero-visual-frame` are not eligible.
- **WebGL surface cap:** Two foreground three.js surfaces plus one shared app-shell `KaapiAmbientLayer`
  context. Per-card 3D, per-route canvases, modal WebGL, and route-specific ambient canvases remain prohibited.
- **Modal backdrop blur:** Modal backdrops consume `var(--glass-blur)` directly so the computed
  backdrop filter resolves to `blur(16px)`. Both `backdrop-filter` and `-webkit-backdrop-filter`
  are required.
- **Button states:** Buttons implement rest, hover, active/pressed, disabled, and keyboard
  focus-visible states using the button state tokens above.
- **Focus modality:** Keyboard focus rings use `:focus-visible`. Avoid broad selectors such as
  `.btn-bevel:focus` that alter mouse/click rest shadows. Tests that assert focus styling must model
  keyboard modality before expecting focus-visible rings.
- **Disabled state:** Disabled buttons remain flat, non-interactive, and opacity-reduced; they do not
  keep bevel shadows.

### Enforcement

- Playwright computed-style assertions are the default enforcement mechanism for token use, blur,
  shadows, radius, and focus state. Screenshot diffing is not the default gate.
- New or changed UI surfaces require computed-style coverage in Chromium and WebKit at 375px, 768px,
  and 1280px widths.
- Preserve spec-029 regression continuity where relevant, including form label layout, modal
  accessibility, and responsive behavior already covered by prior fixes.
- Token audits must catch raw RGBA or hex values outside approved token definitions or documented
  Extraction Compass visualization-zone values, hardcoded shadows, hardcoded radii, unapproved blur
  usage, and drift from spec-030 token/class names.
- Visual artifacts, screenshots, traces, videos, logs, and review notes must not expose invite tokens,
  cookies, access tokens, refresh tokens, production URLs, or personally identifiable information.

---

## Component Conventions

**Stack:** React + TypeScript + Vite + DaisyUI v5 + Tailwind v4 · Theme: `espresso-dark`

| Component | DaisyUI v5 Base | Token / Surface | Notes |
|-----------|----------------|-----------------|-------|
| Page shell | `main.max-w-2xl.mx-auto.px-4.pt-4.pb-24` | `bg-base-100` | React Router `<Outlet>` target; `pb-24` clears bottom nav |
| Shared ambient layer | `KaapiAmbientLayer` | `--kaapi-ambient-*` tokens | One app-shell WebGL context behind `#main-content`; static gradient fallback; no per-route/per-card canvas |
| Cards — catalog/hardware | `GlassCard` content variant / `.liquid-card` legacy class | `--kaapi-content-surface` + `--kaapi-content-border` + `--kaapi-content-shadow` | Solid light elevated warm content surface; no blur even if legacy class name contains `glass` |
| Cards — brew log rows | `.frosted-brew-card` retuned as solid row surface | `--kaapi-content-surface` + restrained semantic border/state tokens | Solid dense-list row; no `backdrop-filter`; image never shows through operational row content |
| Primary button | `btn btn-primary .btn-bevel` | `--btn-rest-shadow` → `--btn-hover-shadow` → `--btn-active-shadow` | Three-layer recipe; `--bevel-radius` on all |
| Secondary / outline button | `btn btn-outline` | `--glass-border` border; `--bevel-shadow-raised` on hover | No hard colour fill |
| Destructive button | `btn btn-error btn-outline` | No bevel — flat error treatment | |
| Navigation | `nav.btm-nav.btm-nav-sm` | `bg-base-200` | Bottom tab bar; 5 tabs; React NavLink for active state |
| Form inputs | `input.input` + custom token CSS | `--input-bg` + `--input-border` + `--input-focus-ring` on focus | Solid light controls inside content surfaces; `appearance: none` on selects; focus via `box-shadow`, no outline |
| Form labels | `.form-control > .label` | `display: block; width: 100%` | Spec-029 D5 fix — must not regress |
| Modal / dialog | `dialog.modal.modal-bottom.sm:modal-middle` | `.modal-glass` chrome plus solid light inner content surface | Backdrop/shell may blur; modal body content remains solid and contrast-safe |
| Modal backdrop | `.modal-backdrop` | `backdrop-filter: var(--glass-blur); -webkit-backdrop-filter: var(--glass-blur)` | Baseline blur allowed; apply to overlay/chrome, not to content surface |
| Dashboard hero visual | `.hero-visual-frame` / `HeroVisualFrame` | `--kaapi-content-surface` + `--kaapi-content-shadow` plus approved foreground 3D/fallback | Solid elevated hero content surface; no progressive blur |
| Overlay / sheet layers | `.glass-overlay`, `.glass-sheet` | `--glass-bg` + `--glass-border` + `--bevel-shadow-raised`; progressive gate may add `backdrop-filter: var(--glass-blur)` | Non-WebKit progressive tier only; inner operational content remains solid |
| Toast / feedback | `div.toast.toast-end` | DaisyUI defaults | Auto-dismiss via React `setTimeout` |
| Loading spinner | `span.loading.loading-spinner` | DaisyUI defaults | Shown during async operations |
| FAB (primary CTA) | `btn btn-primary .btn-bevel` + `fixed bottom-24 right-4` positioning | Same token set as primary button | Where applicable per page |
| Extraction Compass | `canvas#compass-chart` (Chart.js) | Dark panel surface | See §Extraction Compass below |
| Empty state | `div.flex.flex-col.items-center.gap-3.py-12` | `text-base-content/50` | Icon + message + CTA |
| Eligibility badges | `badge badge-sm` + semantic variant | `badge-error/warning/success/accent` | See §Eligibility table |

---

## Per-Page Background and Layer Discipline

Photographic backgrounds are **density-keyed**, not blanket-retired. Every route starts from the
Clutter & Comprehension Diagnostic in `specs/043-kaapi-kadai-design-coherence/design-brief.md`: first
apply the surface contract, then layer discipline, then scrim/prominence tuning, density rhythm,
color restraint, and de-redundancy before deciding whether an image needs to recede further.

**Binding rule:** photo behind scrim, content on solid elevated light surfaces, one translucent layer
maximum, rhythm before ornament, amber as anchor rather than wash.

| Density / scenario | Background treatment | Required controls |
|---|---|---|
| Sparse standalone flows (`StandaloneHouseholdShell`, login/welcome/recovery) | Keep photography visibly warm and atmospheric. | Solid auth/task card, generous negative space, one glass/scrim layer at shell/backdrop only. |
| Medium task flows (register, invite accept, household new, detail pages, modals) | Keep or quiet the image based on task length and focal competition. | Solid form/detail surface, grouped fields, restrained semantic accents, no duplicate context labels. |
| Dense app/admin/list flows (`AppShell`, dashboard, catalog list, brew log, hardware, import, settings) | Keep photography as receded mood behind a deeper scrim. | Solid cards/rows/panels, strict badge/color restraint, measured row/card rhythm, no translucent repeated content. |

Layer discipline is absolute: at most one translucent layer participates in a stack. Never combine
photo + glass + card + badge as competing translucent planes. If content feels cluttered, do not add
another blur/card/badge; fix the reading surface, grouping, scrim, semantic color, or duplicate labels.
The design brief's per-page matrix is the source of truth for route-specific treatment.

## Typography

**Fonts:** Playfair Display (headings) + Inter (body) — loaded via npm / CSS, no CDN links in React components.

```css
/* In @theme block — generates Tailwind utility classes */
--font-display: "Playfair Display", Georgia, serif;
--font-body: Inter, system-ui, sans-serif;
```

**Type scale:**

| Role | Tag / Class | Font | Size | Weight | Notes |
|------|-------------|------|------|--------|-------|
| Page title | `h1` | Playfair Display | `1.875rem` (30px) | 700 | Dashboard, Brew Log headings |
| Section heading | `h2` | Playfair Display | `1.375rem` (22px) | 600 | Card titles, panel headings |
| Sub-heading | `h3` | Inter | `1.0625rem` (17px) | 600 | Field group labels, table section headers |
| Body text | `p`, `td` | Inter | `1rem` (16px) | 400 | Notes, descriptions |
| Label / form label | `label` | Inter | `0.875rem` (14px) | 500 | All `<label>` elements |
| Small / meta | `.text-xs` | Inter | `0.75rem` (12px) | 400 | Timestamps, IDs, badge text |
| Nav labels | `btm-nav span` | Inter | `0.625rem` (10px) | 500 | Bottom nav icon labels |

**Rule:** Playfair Display is scoped to `h1`, `h2`, and `.font-display`. All functional UI text uses Inter.

---

## Layout Structure

### Navigation: Bottom Tab Bar (mobile-first)

```
┌─────────────────────────────────────┐
│  max-w-2xl  mx-auto  px-4  pt-4    │
│  pb-24 (clears btm-nav)             │
│                                     │
│  [page content]                     │
│                                     │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐  ← fixed bottom
│  🏠  ☕  📖  🔧  🛠             │
│  Home Log  Cat  HW  Mnt            │  ← btm-nav
└─────────────────────────────────────┘
```

The historical mobile-first skeleton used only bottom navigation. spec-043 may also use desktop
sidebar/AppShell chrome where the implementation already provides it, but the rule is unchanged:
persistent chrome belongs to the espresso-dark frame, while operational content sits on solid light
warm elevated surfaces. Content column widths and shell density may adapt at larger breakpoints, but
component surface treatment must preserve the same surface contract at all widths.

### React App Shell (reference skeleton)

```tsx
// App root — espresso-dark theme applied via DaisyUI default
<html data-theme="espresso-dark" lang="en">
  <body>
    <KaapiAmbientLayer />                        {/* subtle calm depth; fixed, shared, non-interactive */}
    <div className="app-bg bg-dashboard" />     {/* photo behind density-keyed scrim */}
    <div id="main-content">                     {/* espresso-dark AppShell/chrome veil above ambient */}
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        <Outlet />                              {/* React Router page content */}
      </main>
    </div>
    <nav className="btm-nav btm-nav-sm">…</nav>
    {/* Modals rendered via React portal to document.body */}
  </body>
</html>
```

---

## Eligibility & Taste Summary — Visual Encoding

| Shot_Eligibility | Badge class | Display |
|-----------------|-------------|---------|
| `Reject` | `badge-error` | 🚫 Reject |
| `Passable` | `badge-warning` | Passable |
| `Good Espresso` | `badge-success` | Good Espresso |
| `God Shot` | `badge-accent` | ✨ God Shot |

| Taste_Summary | Visual hint | Extraction zone |
|--------------|-------------|-----------------|
| `Weak & Sour` | Blue tint text / badge | Under-extracted |
| `Acidic & Bright` | Cyan (`--kaapi-accent-cyan`) | Under-extracted (pleasant) |
| `Salty / Channeled` | Violet (`--kaapi-accent-violet`) | Under-extracted (fault) |
| `Sweet & Balanced` | Teal/green (`--kaapi-accent-teal`) | Target |
| `Complex & Syrupy` | Gold | Target+ |
| `Harsh & Bitter` | Red | Over-extracted |
| `Strong & Muddy` | Dark red | Over-extracted+ |

---

## Extraction Compass (Chart.js)

Chart.js scatter chart embedded in the Brew Log form. React component wraps a `<canvas>` element.

- **X axis:** Time_Sec (20–60s)
- **Y axis:** Yield_Out_g (20–60g)
- **Interaction:** User clicks a quadrant zone → component sets `TasteSummary` field value
- **Historical dots:** Previous shots for the current bag plotted as small grey circles

**Zone colours (`backgroundColor`):** These documented visualization-zone values are the only raw RGBA exceptions outside token definitions; new visualization colours should use the sanctioned cool-accent tokens where possible.

| Zone | Value | Colour |
|------|-------|--------|
| Weak & Sour | `rgba(59,130,246,0.25)` | Muted blue |
| Acidic & Bright | `rgba(6,182,212,0.25)` | Cyan |
| Salty / Channeled | `rgba(168,85,247,0.25)` | Purple |
| Sweet & Balanced | `rgba(34,197,94,0.3)` | Green — target zone |
| Complex & Syrupy | `rgba(250,204,21,0.3)` | Gold |
| Harsh & Bitter | `rgba(239,68,68,0.25)` | Red |
| Strong & Muddy | `rgba(180,30,30,0.25)` | Dark red |

Canvas sizing: `height: 240px` on mobile; `height: 320px` on `md:`. Chart.js instance managed
via `useRef` + `useEffect` — no CDN import in JSX.

---

## Image Strategy

### Catalog bean images
- **Source:** Sage (image-sourcing squad agent) runs during Phase 8 bootstrapping.
- **Inputs:** `Catalog.Roaster` + `Catalog.Bean_Name` + `Catalog.Roast_Level` per row.
- **Process:** Agent searches for aesthetically complementary images (official roaster pages first;
  stock photography as fallback). User approves before upload.
- **Storage:** GCS bucket `<your-project-id>-backups`, path: `catalog-images/{Catalog_ID}.jpg`.
- **Schema:** `Catalog.Local_Image_Path` stores `gs://<your-project-id>-backups/catalog-images/{Catalog_ID}.jpg`.
- **URL generation:** Backend generates a signed URL (15-minute TTL) on each page render.
  Never embed GCS `gs://` paths in HTML directly.
- **Fallback:** If image missing, render a warm gradient placeholder card with the roaster initial
  in Playfair Display (`bg-gradient-to-br from-amber-900 to-stone-800`).

### Product URL expiry
- Seasonal products from roasters frequently expire. `Product_URL` is treated as informational-only.
- Image sourcing proceeds even when `Product_URL` is expired (Sage searches by name, not URL).
- No HTTP validation of `Product_URL` at runtime.

### Pre-image placeholder behaviour
- Before Phase 8 images are sourced, catalog cards render a styled placeholder.
- This is intentional and designed to look polished, not broken.

---

## Changelog

- **2026-06-13 — spec-043 thesis reconciliation:** Added Warm Editorial Instrument Calm hybrid base,
  the solid light content-surface contract, chrome/overlay/sheet-only blur scope, restrained semantic
  color guidance, density-keyed photographic backgrounds, one-translucent-layer discipline, subtle
  ambient depth, and named fluidity token expectations.

## Aria's Brief (Designer Agent)

Aria translates the above direction into:
1. Component inventory — which DaisyUI v5 components map to which product screens
2. Design token values — exact CSS custom property values for `espresso-dark` extensions
3. State variant tables — rest/hover/active/disabled for all interactive elements
4. WebKit notes — per-token implementation constraints for Finn
5. Image art direction brief for Sage (what "aesthetically complementary" means per bean type)

Aria does NOT write code. Aria produces design specifications that Finn implements.
Aria's gate (`aria-gate.md`) is a hard prerequisite before any Finn implementation begins.

---

## Sage's Brief (Image Sourcing Agent)

Sage is activated in Phase 8. Responsibilities:
1. Read `Catalog` tab from the bootstrap CSV/sheet
2. For each row, determine if `Local_Image_Path` is empty or points to a missing file
3. Search for a high-quality, royalty-free or CC-licensed image matching the bean profile
4. **Do not hallucinate images.** Only use real, verifiable sources.
5. **Do not conflate entities.** `CAT100 = Verve Seabright` must not get a photo of a different Verve product.
6. Present candidate images to the operator for approval before uploading to GCS
7. Upload approved images to GCS; write `gs://` path back to Catalog

**Sources to try (in order):**
1. Official roaster product page (extract OG image from `Product_URL` if still live)
2. Google Image search with structured query: `"{Roaster} {Bean_Name} espresso bag"`
3. Unsplash/Pexels for abstract bean/roast photography as a fallback

**Operator approval is required before any GCS write.**

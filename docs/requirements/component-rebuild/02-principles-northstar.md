# Aria Principles Northstar — espresso-logs Design System

**Spec:** 043 → Component System Rebuild  
**Prepared by:** Aria (Designer)  
**Date:** 2026-06-15  
**Status:** AUTHORITATIVE CONTRACT  
**Purpose:** The durable, enforceable design-system contract for the rebuild. Each principle maps to reusable components/tokens and application rules. Any deviation must be surfaced and justified.

---

## How to Use This Document

**Before implementing ANY UI:**
1. Find the principle(s) that apply to your component or layout
2. Verify your implementation satisfies the APPLICATION RULE
3. Check that no VIOLATION EXAMPLE pattern appears in your code
4. If unsure, surface it — never guess

**During code review (Quinn / PR):**
- Each component must trace back to at least one principle
- Any one-off styling without principle backing is a flag
- "It looked better this way" is not a justification — state the principle

**Rebuild checklist integration:**
- Per-page audit: does every component on this page map to a principle?
- Per-component audit: is this component reusable or a one-off? If one-off, why?
- Per-endpoint: do form/data surfaces follow the surface contract?

---

## PRINCIPLE 1: Dual-Tone Frosted Glass Surface Language

### Statement
The app's surface language is a **frosted glass takeover card** in two committed tones: **DARK** (smoky charcoal espresso) and **BEIGE** (warm cream). The tone toggle is destined to become a **site-wide light/dark mode** (P2). Neither tone may drift toward washed-out white, muddy gray, or uncommitted middle values.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `.kk-takeover-card` | Base glass card structure |
| `.kk-tc--dark` | DARK tone modifier (rgba(24,16,10,0.72)) |
| `.kk-tc--beige` | BEIGE tone modifier (rgba(245,235,220,0.78)) |
| `--kk-tc-surface` | Translucent fill per tone |
| `--kk-tc-surface-solid` | Solid fallback for no-blur/reduced-transparency |

### Application Rule
- Every detail page uses ONE takeover card containing ALL content
- Card surface is EITHER dark OR beige — never white, gray, or low-alpha cream
- The tone class determines ALL child token resolutions (text, chips, buttons, inputs)
- Site-wide mode toggle (when implemented) swaps the tone class at the page or app root

### Violation Examples
- `rgba(255, 247, 237, 0.45)` — alpha too low, reads as gray ❌
- `background: white` or `background: #f9f9f9` — uncommitted, off-brand ❌
- Mixing dark and beige tokens on the same card ❌
- Hardcoded colors instead of `var(--kk-tc-*)` tokens ❌

---

## PRINCIPLE 2: Single Surface, Single Layer — No Segregation

### Statement
The takeover card IS the reading surface. ALL content lives WITHIN the single card. Content is differentiated by **typography and spacing ONLY** — NO sub-cards, NO inset wells, NO hairline divider boxes, NO floating panels, NO separate hero cards. The glass IS the page surface, not a floating object on a page.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `.kk-tc-section` | Section container with `--kk-tc-section-gap` margin |
| `.kk-tc-section--title` | First section (title block), no preceding margin |
| `--kk-tc-section-gap` | 32px vertical rhythm between sections |
| `--kk-tc-subsection-gap` | 16px within sections |

### Application Rule
- ONE translucent layer participates in the visual stack
- Sections are separated by vertical whitespace (32px gap), not borders or boxes
- The title block is the FIRST section — same surface, same padding, no separate frame
- Forms, tables, and data grids sit directly on the glass — no wells around them

### Violation Examples
- A "hero card" wrapping the title separately from content ❌
- Inset well (`border-radius + bg + padding`) around the correction form ❌
- Hairline `<hr>` or `border-bottom` between sections ❌
- Nested cards or floating panels inside the takeover card ❌
- Full-bleed "full-page" frost without a defined card boundary (the r2 failure) ❌

---

## PRINCIPLE 3: Intentional Translucence — Glass With Purpose

### Statement
Frosted glass is used **with intent**, not as decoration. The backdrop-filter blur (24px) lets the route photo bleed through as warm atmosphere — shapes are recognizable but details are softened. The photo is frosted BEHIND the card, sharp AROUND/BELOW the card. The glass quality is deliberate: not solid, not washed-out, not invisible.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `--kk-tc-blur` | 24px backdrop blur |
| `backdrop-filter: blur(var(--kk-tc-blur))` | Applied to takeover card |
| `.app-bg.bg-brew-log` / `.bg-catalog` | Route photo background |
| Tone-specific scrim via `:has()` | Minimal scrim, lets card do the frosting |

### Application Rule
- Blur is confined to the takeover card and approved chrome (modals, overlays)
- The photo must be visible through the frost — check that shapes are recognizable
- The scrim (gradient on the photo) is minimal — just enough warmth, not enough to hide
- Photo is sharp where the card does NOT cover (margins, below the card)
- Dense lists, content rows, buttons, chips, and arbitrary containers get NO blur

### Violation Examples
- Opaque solid card that hides the photo entirely ❌
- `backdrop-filter: blur()` on list rows, table cells, or buttons ❌
- Heavy scrim (`rgba(0,0,0,0.65)`) that obscures the photo to black ❌
- Blur without corresponding alpha — solid + blur is wasted CPU ❌

---

## PRINCIPLE 4: Warm Coherence — No Off-Brand Colors

### Statement
The palette is **warm espresso + amber + cream**. No cool tones (blue, purple, teal) outside of restrained semantic use (info/success/error with explicit justification). The primary CTA button is warm amber, not blue. All colors must feel like they belong in a café, not a SaaS dashboard.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `--kk-tc-primary-btn-bg` | Warm amber (#f59e0b DARK, #92400e BEIGE) |
| `--kk-tc-link` | Warm amber/espresso link color per tone |
| `--color-info` | Restrained teal (#0e7490), used ONLY for info semantic |
| `--kk-tc-chip-verified-*` | Green (success semantic) — restrained |
| `--kk-tc-chip-danger-*` / `--kk-tc-btn-danger-*` | Red (error semantic) — restrained |

### Application Rule
- Primary actions are warm amber, not blue
- Cool tones (teal, green, red) appear ONLY for semantic states (info, success, error)
- If adding a new accent, ask: does this feel like coffee? If not, don't use it.
- Link colors use warm amber/espresso, not default browser blue

### Violation Examples
- `--color-primary: #3b82f6` (blue) ❌
- Blue-tinted glass surface or border ❌
- Using teal/green for non-semantic decoration ❌
- Purple, pink, or electric colors anywhere ❌

---

## PRINCIPLE 5: AA Legibility as a SYSTEM

### Statement
WCAG AA contrast (≥4.5:1 text, ≥3:1 large text/UI) is achieved by the **system working together**: surface transparency + blur + text color + positioning + fallbacks. Legibility NEVER depends on blur alone. Every surface has a solid fallback. Every contrast ratio is documented and verified per tone.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `--kk-tc-text-primary/secondary/tertiary` | Text hierarchy with verified contrast |
| `--kk-tc-surface-solid` | Solid fallback when blur unavailable |
| `@supports not (backdrop-filter: blur(1px))` | Fallback rule for no-blur |
| `@media (prefers-reduced-transparency: reduce)` | Respect user preference |

### Application Rule
- EVERY text color has a documented contrast ratio against its background per tone
- The no-blur fallback (`--kk-tc-surface-solid`) independently passes AA
- `prefers-reduced-transparency: reduce` removes blur, keeps solid surface
- Text shadow or localized scrim may boost contrast for edge cases, but the base must pass

### Verification Table Template
| Element | Token | DARK Contrast | BEIGE Contrast | Pass? |
|---------|-------|---------------|----------------|-------|
| Primary text | `--kk-tc-text-primary` | ≈12:1 | ≈11:1 | ✓ |
| Secondary text | `--kk-tc-text-secondary` | ≈9:1 | ≈7:1 | ✓ |
| Tertiary text | `--kk-tc-text-tertiary` | ≈6:1 | ≈5:1 | ✓ |

### Violation Examples
- Text that only passes AA with blur enabled ❌
- No `@supports` fallback for translucent surfaces ❌
- Ignoring `prefers-reduced-transparency` ❌
- Undocumented contrast ratios ("it looks fine") ❌

---

## PRINCIPLE 6: Typography and Section Hierarchy — Title First

### Statement
Content hierarchy is communicated through **typography scale and spacing**, not boxes or dividers. The title block is FIRST. Section headers are uppercase, small, muted. Body text is readable (15px, 1.6 line-height). The same type system is shared across ALL pages — no per-page font gymnastics.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `.kk-tc-title` | Page/card title: 24px/700, primary color |
| `.kk-tc-subtitle` | Metadata line: 14px/400, secondary color |
| `.kk-tc-section-header` | Section header: 13px/600, uppercase, tracking |
| `.kk-tc-body` | Body text: 15px/400, 1.6 line-height |
| `.kk-tc-body-muted` | Muted body: secondary color |
| `.kk-tc-param-label` | Parameter label: 12px/500, tertiary |
| `.kk-tc-param-value` | Parameter value: 16px/600, primary |

### Application Rule
- Title block is always the FIRST section (no chips/actions above the title)
- Section headers appear ABOVE section content, not inline
- Typography classes are semantic — use `.kk-tc-body`, not `text-sm` + inline styles
- Both pages (brew-log detail, catalog detail) share IDENTICAL type sizing and spacing

### Violation Examples
- Inline `style={{ fontSize: '14px', color: '#4a3728' }}` instead of `.kk-tc-body` ❌
- Section header below or inline with content ❌
- Different font sizes for the same semantic element across pages ❌
- Title appearing after chips or buttons ❌

---

## PRINCIPLE 7: Chip System — Canonical Casing and Roast Gradation

### Statement
Chips display **canonical casing** from the data source (e.g., "Light" not "LIGHT"). Forced uppercase (`text-transform: uppercase`) is reserved for section headers, NOT for chips displaying user/data values. The roast-level chip uses a **5-step beige→espresso color gradation** with text color flipping at Medium for AA contrast per tone.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `.kk-tc-chip` | Base chip: 12px/500, pill shape |
| `.kk-tc-chip--roast` | Roast chip base |
| `.kk-tc-chip--roast-{level}` | Per-level variant (light, light-medium, medium, medium-dark, dark) |
| `--kk-tc-roast-{level}-bg/text/border` | Per-level color tokens |

### Roast Gradation Spec (AA-verified)
| Level | BG | Text | Contrast |
|-------|-----|------|----------|
| Light | `#f5e6d3` (warm beige) | `#3d2314` (espresso) | 8.2:1 ✓ |
| Light / Medium | `#d4b896` (tan) | `#3d2314` | 6.1:1 ✓ |
| Medium | `#a67c52` (caramel) | `#fff7ed` (cream) — **FLIP** | 4.9:1 ✓ |
| Medium / Dark | `#6b4423` (coffee) | `#fff7ed` | 7.4:1 ✓ |
| Dark | `#3d2314` (espresso) | `#fff7ed` | 11.2:1 ✓ |

### Application Rule
- Roast chip casing: render `bean.roast_level` as-is (e.g., "Light / Medium")
- NO `text-transform: uppercase` on roast chips or data-value chips
- Section headers MAY use uppercase (they are labels, not data)
- Roast chip background and text color come from the gradation tokens
- On BEIGE card, Light/Light-Medium chips get a subtle border (`--kk-tc-roast-{level}-border`) for visibility

### Violation Examples
- `text-transform: uppercase` on a roast chip displaying "LIGHT" ❌
- All 5 roast levels using the same chip color ❌
- Roast chip with contrast < 4.5:1 ❌
- Hardcoded chip colors instead of `var(--kk-tc-roast-*)` ❌

---

## PRINCIPLE 8: Button States — INTENSIFY, Never Invert

### Statement
Hover/active states **INTENSIFY** — background gets more prominent, text stays in the same tonal family. States do NOT invert colors (light→dark or dark→light flip). All states maintain ≥4.5:1 contrast. Transitions are smooth (150ms ease).

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `.kk-tc-btn` | Base button: 8px 14px padding, 8px radius |
| `.kk-tc-btn--edit` | Edit/neutral button |
| `.kk-tc-btn--danger` | Delete/destructive button |
| `.kk-tc-btn--primary` | Primary action (warm amber fill) |
| `--kk-tc-btn-*-bg/text/border` | Per-role, per-state tokens |
| `--kk-tc-btn-*-hover-*/active-*` | Intensified state tokens |
| `--kk-tc-btn-focus-ring` | Focus ring (amber or espresso glow) |

### State Progression Example (Edit Button, DARK)
| State | BG Alpha | Text | Effect |
|-------|----------|------|--------|
| Rest | 0.10 | `#e8ddd4` | Subtle |
| Hover | 0.18 | `#fff7ed` | Brighter |
| Active | 0.25 | `#fff7ed` | Most prominent |

### Application Rule
- Hover increases background alpha/saturation, NOT inverts colors
- Text color shifts within the same family (e.g., `#e8ddd4` → `#fff7ed`), never to opposite
- Disabled state: reduced opacity (0.4), `cursor: not-allowed`
- Focus uses a visible ring (`box-shadow`), not just `outline`
- Border-radius is 6–8px (standard rounded rect) — NO squircle/stadium shapes

### Violation Examples
- Hover flips text from light to dark ❌
- Delete button hover changes red text to white text on red bg ❌
- `border-radius: 9999px` on action buttons (squircle/pill) ❌
- No visible focus indicator ❌

---

## PRINCIPLE 9: Bevel, Scrim, and Photo Treatment

### Statement
The takeover card has a subtle **bevel rim** (inset box-shadow highlight at top-left, lowlight at bottom-right) creating the "glass edge" quality. The route photo is **frosted behind the card** via backdrop-filter and **sharp around/below** the card. The scrim is minimal per tone — just enough warmth, not enough to hide.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `--kk-tc-bevel-shadow` | Multi-layer box-shadow: inset rim + ambient depth |
| `--kk-tc-bevel-highlight` | Top-left light edge |
| `--kk-tc-bevel-lowlight` | Bottom-right shadow edge |
| `--kk-tc-shadow-ambient` | Outer ambient drop shadow |
| `:has(~ main .kk-takeover-card.kk-tc--dark)` | Tone-aware scrim selector |

### Scrim Values
| Tone | Scrim Gradient |
|------|----------------|
| DARK | `rgba(24,16,10,0.28) → rgba(24,16,10,0.32)` |
| BEIGE | `rgba(245,235,220,0.10) → rgba(245,235,220,0.14)` |

### Application Rule
- Bevel is applied to the takeover card only — not to child elements
- Scrim is set per-tone via CSS `:has()` on `.app-bg`
- Photo visible through the card (frosted), photo sharp where card doesn't cover
- Desktop: photo visible on left/right margins; mobile: photo visible below card

### Violation Examples
- Heavy scrim (> 0.5 alpha) that hides the photo ❌
- No bevel — card looks flat/floating ❌
- Bevel on buttons or chips (too busy) ❌
- Photo completely hidden by opaque card ❌

---

## PRINCIPLE 10: Responsive and Accessibility Dignity

### Statement
**Mobile-first**: every layout works on a phone held in one hand. **Centered reading measure**: card max-width is 720px on desktop, full-width minus gutters on mobile. **Reduced-motion/reduced-transparency**: users who request these preferences are respected with grace — no broken layout, no lost contrast, no missing content.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `--kk-tc-max-width` | 720px max reading width |
| `--kk-tc-padding-x/y` | Card padding (24px/32px) |
| `@media (prefers-reduced-motion: reduce)` | Remove non-essential motion |
| `@media (prefers-reduced-transparency: reduce)` | Remove blur, use solid surface |
| `@supports not (backdrop-filter: blur(1px))` | No-blur fallback |

### Application Rule
- Mobile: card is `calc(100% - 32px)` wide with 16px gutters
- Desktop: card is centered, max 720px, photo visible on sides
- Reduced-transparency: blur removed, `--kk-tc-surface-solid` used, contrast maintained
- Reduced-motion: transitions set to `0s` or removed
- Focus states are always visible regardless of preference

### Violation Examples
- Card wider than viewport on mobile ❌
- Reduced-transparency user sees broken/invisible surface ❌
- Content only legible with animation/blur enabled ❌
- No fallback for `backdrop-filter` ❌

---

## PRINCIPLE 11: Markdown Prose Rendering

### Statement
LLM-generated content (AI summary) is rendered as **styled Markdown prose**, not plaintext. The `.kk-tc-markdown` container applies tone-aware prose styling so headings, bold, lists, and links render elegantly on both glass tones. No raw `**`, `#`, or `-` characters should be visible.

### Components/Tokens
| Token/Class | Purpose |
|-------------|---------|
| `.kk-tc-markdown` | Prose container: inherits card tone context |
| `.kk-tc-markdown h1–h6` | Heading hierarchy |
| `.kk-tc-markdown strong/em` | Emphasis styling |
| `.kk-tc-markdown ul/ol` | List styling with tone-aware markers |
| `.kk-tc-markdown a` | Link styling using `--kk-tc-link` |
| `.kk-tc-markdown code/pre` | Code block styling |

### Application Rule
- AI feedback wrapped in `<ReactMarkdown>` inside `.kk-tc-markdown`
- Prose inherits `--kk-tc-text-*` tokens — no hardcoded colors
- Links use `--kk-tc-link` (warm amber DARK, espresso BEIGE)
- First heading has no `margin-top`; last paragraph has no `margin-bottom`

### Violation Examples
- Raw plaintext displaying literal `**bold**` or `# heading` ❌
- Hardcoded prose colors that ignore tone ❌
- Links using default blue ❌
- Raw HTML injection without sanitization ❌

---

## PRINCIPLE 12: Reuse Before Create — No One-Offs

### Statement
**Every action is grounded in PRINCIPLE, not edge-case or template.** Not a single UI component on any page should be a one-off coded entity. If a pattern exists, reuse it. If it doesn't exist but should, add it to the system. If something looks custom, surface it for justification.

### Application Rule
- Before creating a new class/style: does a semantic `.kk-tc-*` class already exist?
- Before creating a new token: does a semantically equivalent token exist?
- Before adding inline styles: can this be expressed with existing tokens?
- Per-page checklist: every component traces back to a principle
- Per-component checklist: is this reusable or a one-off? If one-off, document why.

### Violation Examples
- Inline `style={{ color: 'var(--kk-tc-text-primary)' }}` when `.kk-tc-body` exists ❌
- Creating `--kk-tc-special-btn-for-catalog` instead of using `.kk-tc-btn--primary` ❌
- Copy-pasting styles between pages instead of extracting a shared class ❌
- "It looked better this way" without principle backing ❌

---

## META-PRINCIPLE: Readability and Coherence Are Principle-Led

### Statement
The design system exists to make the **operator's intent enforceable**. Readability, coherence, and quality are not checklists to be satisfied — they emerge from principled, reusable foundations. Surface unknowns, never guess. If a decision isn't covered by a principle, escalate it.

### Application Rule
- When in doubt: what principle applies? If none, surface the gap.
- "It works" is not justification — "It satisfies Principle N because X" is.
- Design decisions are recorded, not intuited.
- The northstar is a living document — when new patterns emerge, codify them.

---

## Quick Reference: Principle → Token/Component Map

| # | Principle | Key Tokens/Classes |
|---|-----------|-------------------|
| 1 | Dual-Tone Surface | `.kk-tc--dark`, `.kk-tc--beige`, `--kk-tc-surface` |
| 2 | Single Surface | `.kk-tc-section`, `--kk-tc-section-gap` |
| 3 | Intentional Translucence | `--kk-tc-blur`, `backdrop-filter` |
| 4 | Warm Coherence | `--kk-tc-primary-btn-*`, `--kk-tc-link` |
| 5 | AA Legibility | `--kk-tc-text-*`, `--kk-tc-surface-solid`, `@supports` |
| 6 | Typography Hierarchy | `.kk-tc-title`, `.kk-tc-section-header`, `.kk-tc-body` |
| 7 | Chip System | `.kk-tc-chip--roast-*`, `--kk-tc-roast-*-bg/text` |
| 8 | Button States | `.kk-tc-btn--*`, `--kk-tc-btn-*-hover-*` |
| 9 | Bevel/Scrim | `--kk-tc-bevel-shadow`, `:has()` scrim |
| 10 | Responsive/A11y | `--kk-tc-max-width`, `@media prefers-*` |
| 11 | Markdown Prose | `.kk-tc-markdown` |
| 12 | No One-Offs | Reuse existing tokens/classes |
| 13 | Affordance Matches Interactivity | `cursor: pointer`, `.entity-card:hover`, `.stat-tile` (no hover) |

---

## Rebuild Checklist Template

### Per-Page Audit
```
Page: __________________
Date: __________________

□ All components trace to a principle (list principle # per component)
□ No inline styles that duplicate existing tokens
□ No hardcoded colors outside of tokens
□ Typography uses semantic classes (.kk-tc-title, .kk-tc-body, etc.)
□ Sections use .kk-tc-section with proper gap
□ Both tones render correctly (toggle and verify)
□ Reduced-motion/transparency tested
□ Mobile layout verified (375px)
□ Desktop layout verified (1280px)
```

### Per-Component Audit
```
Component: __________________
Principle(s): __________________

□ Uses semantic token classes (not inline styles)
□ Works on both DARK and BEIGE tones
□ Hover/focus states follow INTENSIFY rule
□ AA contrast verified per tone
□ Reusable (not a one-off) — if one-off, justification: __________
```

---

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

---

## Document History

| Date | Author | Change |
|------|--------|--------|
| 2026-06-15 | Aria | Initial northstar codification from spec-043 session refinements |
| 2026-06-19 | Aria | Added PRINCIPLE 13: Visual Affordance Matches Interactivity |

---

*This is the guided northstar. Every component, every style, every decision traces back here.*

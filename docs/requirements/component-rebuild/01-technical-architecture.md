# Maya Technical Plan — Reusable Component System Rebuild

**Spec:** 043 (continuation — global rollout)  
**Author:** Maya (Principal Engineer)  
**Date:** 2026-06-15  
**Status:** PLAN FOR OPERATOR REVIEW  
**Scope:** Full-app reusable component system derived from approved takeover-card prototype

---

## §1 Spec-Approach Recommendation

### Recommendation: **(c) — Product spec is largely fine; only the TECHNICAL specification requires changes.**

### Rationale

The operator's directive is explicitly architectural, not behavioral:

1. **No new user stories, entities, or flows.** The V2 surface map (62 endpoints, 17 page families) describes the *same* product behavior. No screens are being added. No API contracts change. No user journeys are altered. The functional spec remains valid.

2. **What changes is HOW we compose the UI, not WHAT the UI does.** The directive is: "Not a single UI component on a single page should be a one-off coded entity." This is a technical constraint on implementation composition — not a product-level requirement change.

3. **The prototype proved the aesthetic; the rollout generalizes the implementation.** `BrewLogDetail` and `CatalogDetail` are the approved northstar. Every other page must compose from the same shared system. This is an engineering-architecture expansion — a new technical spec section describing the component taxonomy, token promotion, page-shell patterns, and migration strategy.

4. **Recreating from scratch (option b) would duplicate product work without value.** The spec-043 product spec (what the user sees, acceptance criteria per surface) is correct. Archiving and restarting would force Priya to re-specify behavior already captured. The real gap is Maya's domain: the component-architecture section of the engineering spec.

### What Changes Where

| Artifact | Repo | Change |
|----------|------|--------|
| `specs/043/spec.md` (product/functional) | `coffee_tracker` | **No change.** User stories, ACs, entity behavior unchanged. |
| `specs/043/plan.md` (engineering architecture) | `coffee_tracker` | **Major update.** New section: "§ Reusable Component Architecture" covering token promotion, component layers, page-shell pattern, migration strategy. Replaces the prototype-scoped implementation approach. |
| `docs/requirements/design-language.md` | `espresso-logs` | **Update.** Promote the `--kk-tc-*` tone system from takeover-scoped to site-wide design tokens. Add component taxonomy. |
| `frontend/src/index.css` | `espresso-logs` | **Refactor.** Remove `.kk-b-page` scoping. Promote tokens to `:root`-level tone modifiers (or `[data-tone]` attribute selectors). |
| `frontend/src/components/ui/` | `espresso-logs` | **Expand.** New shared components derived from takeover primitives. Retire/wrap legacy components. |

---

## §2 Component Architecture

### 2.1 Token Layer (Foundation)

The takeover-card prototype established a dual-tone token system (`--kk-tc-*`) currently scoped under `.kk-b-page .kk-takeover-card.kk-tc--dark|beige`. The rebuild PROMOTES this to an app-wide foundation.

#### Promotion Strategy: `.kk-b-page` → `[data-tone="dark"|"beige"]`

```
CURRENT (prototype-scoped):
  .kk-b-page .kk-takeover-card.kk-tc--dark { --kk-tc-text-primary: #fff7ed; ... }

TARGET (app-wide):
  [data-tone="dark"]  { --kk-tc-text-primary: #fff7ed; ... }
  [data-tone="beige"] { --kk-tc-text-primary: #2d1608; ... }
```

The `[data-tone]` attribute is set on `<body>` (global toggle) or on a wrapper element (per-region override). This supports:
- P2 goal: site-wide DARK/BEIGE toggle (one `data-tone` attribute on `<html>` or `<body>`)
- Transition: individual pages can opt-in during migration by placing `data-tone` on their root wrapper

#### Token Categories (finalized from prototype + design-language.md)

| Category | Token Prefix | Examples | Count |
|----------|-------------|----------|-------|
| **Surface** | `--kk-tc-surface-*` | surface, surface-solid, blur | 3 |
| **Text hierarchy** | `--kk-tc-text-*` | primary, secondary, tertiary | 3 |
| **Links** | `--kk-tc-link-*` | link, link-hover | 2 |
| **Bevel/border** | `--kk-tc-bevel-*`, `--kk-tc-border` | shadow, highlight, lowlight | 4 |
| **Section rhythm** | `--kk-tc-section-*` | gap, header-color, header-size, header-weight, header-tracking | 6 |
| **Typography** | `--kk-tc-title-*`, `--kk-tc-body-*`, `--kk-tc-label-*` | size, weight, line-height | 12 |
| **Inputs** | `--kk-tc-input-*` | bg, border, text, placeholder, focus-border, focus-ring | 6 |
| **Chips** | `--kk-tc-chip-*` | bg, text, border, + verified/ai/danger variants | 9 |
| **Buttons** | `--kk-tc-btn-*` | edit, danger, primary — each with bg/text/border/hover/active/focus | 24 |
| **Roast gradation** | `--kk-tc-roast-*` | light/light-medium/medium/medium-dark/dark — bg/text/border | 15 |
| **Motion** | `--motion-*` | Already in :root, tone-independent | 14 |

**Total tone-varying tokens: ~84.** These are the dual-valued tokens (one set per tone). Motion and geometry tokens remain shared in `:root`.

#### Relationship to Existing Token Systems

The app currently has THREE partially-overlapping token systems:
1. **DaisyUI theme** (`--color-primary`, `--color-base-100`, etc.) — frame/chrome
2. **kaapi-content-surface** (`--kaapi-content-*`) — solid cream operational content
3. **kk-tc-* takeover** — frosted glass dual-tone system

The rebuild UNIFIES (2) and (3). The `kaapi-content-surface` system WAS the AA-safe solid reading plane; the takeover `--kk-tc-*` system IS the AA-safe dual-tone system that supersedes it. DaisyUI (1) stays for the app chrome (nav bars, shell, ambient layer) during transition.

### 2.2 Primitive Components (Layer 1)

Atomic, single-responsibility components. Consume `--kk-tc-*` tokens. No layout opinions beyond self.

| Component | Status | Source |
|-----------|--------|--------|
| `ToneText` | **NEW** | Renders `<p>`/`<span>` with `kk-tc-body`/`kk-tc-body-muted`/`kk-tc-body-hint` semantic classes |
| `SectionHeader` | **ADAPT** (existing `SectionHeading` wrapper) | Renders `<h3 className="kk-tc-section-header">` — replace current DaisyUI heading |
| `Chip` | **NEW** | Replaces ad-hoc chip spans. Variants: default, verified, ai/brand, warning, danger. Auto-resolves tokens per tone. |
| `RoastChip` | **NEW** (absorbs `roastChipClass.ts` util) | 5-stop gradient chip with canonical casing (no forced uppercase — per operator nitpick). |
| `ToneButton` | **NEW** | Variants: primary, secondary/edit, danger, ghost. Encodes intensify-not-invert hover states. Consumes `--kk-tc-btn-*` tokens. |
| `ToneInput` | **NEW** | Replaces existing `Input`/`Select`/`Textarea` within tone contexts. AA on both tones. |
| `ToneLink` | **NEW** | `<a>` or `<Link>` using `--kk-tc-link` / `--kk-tc-link-hover` |
| `ParamPair` | **NEW** | Label + value pair for data readout. `.kk-tc-param-label` + `.kk-tc-param-value` |
| `TitleIcon` | **NEW** | 64×64 image or placeholder monogram. Per v5 refinement spec. |
| `Markdown` | **NEW** | Wraps `react-markdown` with `.kk-tc-markdown` container. Tone-aware. |
| `TableRow` | **NEW** | Row with tone-aware separator (`.kk-tc-table-row`). |

### 2.3 Composed Components (Layer 2)

Multi-primitive compositions with layout responsibility. Still generic (not page-specific).

| Component | Composes | Purpose |
|-----------|----------|---------|
| `TitleBlock` | `TitleIcon` + heading + subtitle | Reusable title section with optional leading icon |
| `ParamGrid` | Multiple `ParamPair` | Grid layout for brew parameters, hardware specs, etc. |
| `ActionBar` | `ToneButton[]` + `Chip[]` | Horizontal action+status row (replaces per-page ad-hoc action layouts) |
| `DataTable` | `TableRow[]` + header row | Tone-aware tabular data (brew history, bag list, maintenance log) |
| `FormSection` | `ToneInput[]` + `ToneButton` | Grouped form fields within tone context (correction form, edit mode, add-bag form) |
| `MarkdownSection` | `SectionHeader` + `Markdown` | AI summary/feedback section |
| `ChipBar` | `Chip[]` | Horizontal wrap-able chip row (status indicators) |
| `EmptyBlock` | text + optional CTA button | Empty state within a tone card (no items, no history) |

### 2.4 Page Shell / Layout Pattern (Layer 3)

Every page in the app composes from ONE of these shell patterns:

#### Shell A: Takeover Card (detail pages)
```
<TonePageWrapper tone={userPref} bgClass="bg-brew-log">
  <BackLink />
  <ToneToggle />
  <TakeoverCard>
    <TitleBlock />
    <section className="kk-tc-section"> ... </section>
    <section className="kk-tc-section"> ... </section>
  </TakeoverCard>
</TonePageWrapper>
```
**Used by:** BrewLogDetail, CatalogDetail, HardwareDetail (future split from HardwarePage)

#### Shell B: List/Grid Page
```
<TonePageWrapper tone={userPref} bgClass="bg-catalog">
  <PageHeader title="..." />
  <TakeoverCard variant="list">
    <SearchBar />
    <DataTable> ... </DataTable>
    <Pagination />
  </TakeoverCard>
</TonePageWrapper>
```
**Used by:** BrewLogList, CatalogList, HardwarePage (list mode), Dashboard

#### Shell C: Form/Wizard Page
```
<TonePageWrapper tone={userPref} bgClass="bg-auth-login">
  <TakeoverCard variant="form" size="narrow">
    <TitleBlock />
    <FormSection> ... </FormSection>
  </TakeoverCard>
</TonePageWrapper>
```
**Used by:** Login, Register, Welcome, HouseholdNew, BrewLogAdd, ImportWizard

#### Shell D: Settings/Admin Page
```
<TonePageWrapper tone={userPref} bgClass="bg-household-settings">
  <TakeoverCard>
    <TitleBlock />
    <section className="kk-tc-section">  <!-- Members list --> </section>
    <section className="kk-tc-section">  <!-- Invitations --> </section>
    <section className="kk-tc-section">  <!-- Danger zone --> </section>
  </TakeoverCard>
</TonePageWrapper>
```
**Used by:** Profile, HouseholdSettings, InviteAccept

#### Shell E: Static/Error Page
```
<TonePageWrapper tone="dark" bgClass="bg-state-error">
  <TakeoverCard variant="form" size="narrow">
    <EmptyBlock icon="..." text="..." />
    <ToneLink to="/">Go home</ToneLink>
  </TakeoverCard>
</TonePageWrapper>
```
**Used by:** NotFound, InviteInvalid, InviteExpired

### 2.5 Current One-Offs to Retire (Inventory of Legacy)

| # | Current Pattern | Location(s) | Absorbed Into | Migration Action |
|---|---|---|---|---|
| 1 | `.glass-card` + `.card-bevel` | 11 page files (see grep: 67 total usages) | `TakeoverCard` (variant="content" path deprecated) | Replace with `<TakeoverCard>` |
| 2 | `.kaapi-content-surface` / `--elevated` | Dashboard, BrewLogList, CatalogList, BrewLogAdd, HardwarePage | `TakeoverCard variant="list"` or direct section | Tokens merged into kk-tc system |
| 3 | Inline `style={{ color: 'var(--kk-tc-...)' }}` | CatalogDetail (per v5 audit) | Semantic classes (`.kk-tc-body`, `.kk-tc-section-header`) | Remove inline styles |
| 4 | Ad-hoc uppercase `.kk-tc-chip` with `text-transform: uppercase` | index.css (`.kk-tc-chip`) | `Chip` component with principled casing rule | Remove forced uppercase; render canonical casing |
| 5 | Per-page `PageHeader` scrim + title patterns | Dashboard, BrewLogList, CatalogList | `TonePageWrapper` header integration | Consolidate into shell |
| 6 | DaisyUI `btn` / `btn-primary` / `btn-ghost` in page content | Profile, HouseholdSettings, ImportWizard | `ToneButton` variants | Replace DaisyUI buttons in content areas |
| 7 | DaisyUI `input` / `select` / `textarea` in page content | BrewLogAdd, ImportWizard, HouseholdSettings | `ToneInput` / `ToneSelect` / `ToneTextarea` | Replace DaisyUI inputs in content areas |
| 8 | `GlassCard variant="content"` | Multiple pages | `TakeoverCard` with appropriate variant | Deprecate GlassCard content variant |
| 9 | `.kk-proto-043` scoped rules | index.css | Promoted or removed (prototype scaffolding) | Audit and promote or delete |
| 10 | Standalone page-local section header styling | HardwarePage, ImportWizard | `SectionHeader` component | Replace inline heading patterns |
| 11 | `HeroVisualFrame` (3D/WebGL frame) | Dashboard (compass chart) | Retained as-is (specialized viz, not a layout pattern) | No change — exempt from tone system |

**Estimated one-off elimination count: 10 pattern categories across ~15 page files.**

---

## §3 Reusability Enforcement Criteria

### 3.1 Definition: "Fully Composed from Shared Components"

A page/surface is compliant when ALL of the following hold:

1. **Zero page-local CSS classes** beyond layout wiring (`className="flex ..."` utility classes are fine; custom page-scoped `.my-page-card` classes are not).
2. **Zero inline `style={{ }}` blocks** that set color, background, border, font-size, or other token-covered properties.
3. **Zero DaisyUI component classes** (`btn`, `input`, `card`, etc.) in page content areas — DaisyUI is reserved for app-shell chrome (nav, bottom bar) only.
4. **Every visible element** is either:
   - A shared primitive component (Layer 1), OR
   - A shared composed component (Layer 2), OR
   - A standard HTML element consuming ONLY `--kk-tc-*` tokens via shared CSS classes, OR
   - A layout utility (Tailwind flex/grid/spacing classes)
5. **Page wrapper** uses one of the five Shell patterns (A–E).
6. **Tone toggle works:** switching `data-tone` produces the correct alternate-tone rendering without visual artifacts.

### 3.2 Enforcement Mechanisms

| Mechanism | Scope | Purpose |
|-----------|-------|---------|
| **Component inventory file** (`frontend/src/components/tone-system/index.ts`) | Build-time | Single barrel export; anything not in this file is not a shared component |
| **ESLint custom rule** (or manual audit) | CI | Flag `style={{ color:` / `style={{ background:` in page files |
| **CSS audit script** | CI | Grep for class selectors in index.css that are NOT under a recognized namespace (`kk-tc-*`, `kk-b-page`, app-shell classes) |
| **Tariq's per-page checklist** | Review-time | Per surface-map action (all 62 endpoints), verify: page uses Shell A–E; no one-off CSS; no inline styles; tone toggle functions |
| **Playwright visual regression** | CI | Northstar screenshots (both tones, mobile+desktop) for all migrated pages; diff threshold catches regressions |
| **GlassCard/kaapi-content-surface deprecation lint** | CI | Warn/error on import of deprecated components after migration complete |

### 3.3 Casing Rule (Operator Nitpick → Principle)

**Rule:** Chips and labels render canonical casing as stored in the data model. No `text-transform: uppercase` unless the element is a SECTION HEADER (which has an explicit typographic purpose for that transform).

- `RoastChip` renders "Light", "Medium / Dark" — NOT "LIGHT", "MEDIUM / DARK"
- Status chips render "Verified", "AI Generated" — NOT "VERIFIED", "AI GENERATED"
- Section headers ("BREW PARAMETERS") retain uppercase as a typographic hierarchy tool

This is enforced by removing `text-transform: uppercase` from `.kk-tc-chip` base class and leaving it only on `.kk-tc-section-header` and `.kk-tc-param-label`.

---

## §4 Rollout Strategy Across the V2 Map

### 4.1 Sequencing Principles

1. **Token promotion first, page migration second.** The token layer is global infrastructure. It must be stable before pages migrate.
2. **Shared primitives before composed components.** Build from the bottom up.
3. **Detail pages are DONE (prototype approved).** BrewLogDetail and CatalogDetail need only the v5 refinements applied + scoping change. They are validation anchors, not migration targets.
4. **Group by Shell pattern, not by feature domain.** Migrating all Shell B pages together ensures list/grid patterns are consistent.
5. **Never half-migrate.** Each page migration is atomic: old patterns fully replaced, not partially converted. If a page starts, it finishes in the same PR.

### 4.2 Phase Sequence

| Phase | Name | Pages | Shell | Dependencies | Est. Size |
|-------|------|-------|-------|--------------|-----------|
| **0** | Token Promotion | — | — | None | M (tokens moved, no page changes) |
| **1** | Infrastructure | — | — | Phase 0 | S (TonePageWrapper, TakeoverCard generalization, primitives) |
| **2a** | Detail Pages (anchor) | BrewLogDetail, CatalogDetail | A | Phase 1 | S (v5 refinements + scoping change only) |
| **2b** | Static Pages | NotFound, InviteInvalid, InviteExpired | E | Phase 1 | XS |
| **3** | Form Pages | Login, Register, Welcome, HouseholdNew | C | Phase 1 | M |
| **4** | List Pages | BrewLogList, CatalogList | B | Phase 1 + DataTable | M |
| **5** | Dense Form Pages | BrewLogAdd, ImportWizard | C | Phase 1 + FormSection | L |
| **6** | Admin/Settings Pages | Profile, HouseholdSettings, InviteAccept | D | Phase 1 + all primitives | L |
| **7** | Dashboard | Dashboard | B (custom) | Phase 4 + all composed | L |
| **8** | Hardware Page | HardwarePage | B + A (detail split) | Phase 4 | M |
| **9** | Guest View | HouseholdGuestView | B (read-only variant) | Phase 4 | S |
| **10** | Cleanup & Deprecation | — | — | All above | S (remove legacy CSS, deprecated components) |

### 4.3 What Becomes Global vs Stays Scoped

| Element | Scope After Rollout |
|---------|---|
| `--kk-tc-*` tone tokens | **Global** (`:root` + `[data-tone]` on body) |
| `.kk-takeover-card` | **Global** (no `.kk-b-page` scoping) |
| `.kk-tc-section`, `.kk-tc-body`, all typography classes | **Global** |
| `TonePageWrapper` | **Global** (wraps every routed page) |
| Tone toggle (DARK/BEIGE) | **Global** user preference (localStorage + context) |
| `.glass-card` / `.card-bevel` | **Deprecated** (removed after Phase 10) |
| `.kaapi-content-surface` | **Absorbed** (tokens folded into BEIGE tone) |
| DaisyUI theme (`espresso-dark`) | **Scoped to app-shell chrome only** (nav, bottom bar, ambient) |
| `HeroVisualFrame` / WebGL | **Stays specialized** (viz context, not a layout component) |
| Per-route `app-bg` background classes | **Retained** (photography-anchored backgrounds stay per-route) |

---

## §5 Risks and Guardrails

### 5.1 Primary Risk: Incoherent Half-Migration (Prior Failure Mode)

**What happened before:** The `kaapi-content-surface` migration left some pages on the old `.glass-card` system and some on the new solid surface. Two visual languages coexisted. The user noticed.

**How this plan prevents it:**

| Guardrail | Mechanism |
|-----------|-----------|
| **Atomic page migration** | Each page is fully migrated or untouched. No PR ships a partially-converted page. |
| **Legacy deprecation schedule** | `.glass-card`, `.card-bevel`, `.kaapi-content-surface` are DEPRECATED at Phase 0 with a console warning in dev. REMOVED at Phase 10. No intermediate "both are fine" state. |
| **Token layer is promotion, not duplication** | We don't CREATE a parallel system. We PROMOTE the existing `--kk-tc-*` tokens from scoped to global. During transition, the `.kk-b-page` scope coexists with the new `[data-tone]` scope (both resolve the same tokens — zero visual difference). |
| **Visual regression gates** | Each phase PR includes Playwright screenshots on both tones. CI blocks if pixel diff exceeds threshold. |
| **No new pattern without shared component** | The rule is: if you need a visual element that doesn't exist as a shared component, you ADD it to the shared library first, THEN use it. Never inline it on the page. |

### 5.2 Risk: DaisyUI Conflict During Transition

DaisyUI classes (`btn`, `input`, `badge`, etc.) carry their own styling. During migration, pages that still use DaisyUI in content areas will visually clash with the `--kk-tc-*` system.

**Mitigation:** Migration removes DaisyUI from content areas page-by-page (per the atomic rule). DaisyUI is explicitly retained ONLY in:
- Bottom navigation bar
- Top desktop nav (if applicable)
- Toast notifications
- Modal chrome (outer frame — inner content uses tone system)

### 5.3 Risk: V2-Map Gaps That Affect Component Rollout

| Gap | Impact on Rollout | Action |
|-----|---|---|
| **Gap #2: Import wizard FE bypasses BE** | ImportWizard (Phase 5) will be migrated to use `ToneInput`/`FormSection` but the data flow gap is unchanged. No component-architecture impact. | Note: architectural gap is a separate workstream. |
| **Gap #6: HardwareRepo Sheets dep** | HardwarePage (Phase 8) component migration is purely visual — the Sheets dep is a data-layer concern, not a UI concern. | No impact on component rollout. |
| **Gap #1: Admin reset-password no FE** | No page to migrate. Component system provides the primitives (FormSection + ToneButton) when this page is eventually built. | Non-blocking. |
| **Gap #4/#5: Dead FE API clients** | No UI to migrate. Cleanup candidates. | Non-blocking. |

### 5.4 Risk: Accessibility Regression

The takeover prototype was verified for AA contrast (all 5 roast stops, both tones, all text hierarchy levels). Promoting to global must preserve this.

**Guardrail:** The token VALUES don't change — only their SCOPE changes. `--kk-tc-text-primary: #fff7ed` on dark tone is the same value whether scoped to `.kk-b-page .kk-takeover-card` or to `[data-tone="dark"]`. Contrast ratios are preserved by definition.

### 5.5 Risk: Tone Toggle UX Before Full Migration

If tone toggle is promoted to global before all pages are migrated, unmigrated pages may not respond correctly.

**Mitigation:** The tone toggle remains per-page (current behavior) until Phase 7+ is complete. It is promoted to a global site preference only at Phase 10 (after all pages are migrated). During transition, the `TonePageWrapper` reads from a central context but only applies to migrated pages.

---

## §6 Open Questions for the Operator

### Blocking

1. **Tone toggle: persist per-user or per-session?** The current toggle is ephemeral (per-page state). When promoted to global, should it persist in `localStorage` (survives refresh) or be session-only? My recommendation: `localStorage` with a key like `kaapi-tone-preference`.

2. **DaisyUI retention in app-shell chrome: acceptable?** The plan keeps DaisyUI for navigation/shell (bottom bar, ambient layer). This means the nav chrome stays `espresso-dark` themed regardless of the DARK/BEIGE tone toggle. Is that the intended behavior? (Alternative: extend `--kk-tc-*` to the shell too, but this is a larger scope.)

### Non-Blocking (can resolve during implementation)

3. **Hardware page split: keep as one page or split into list+detail?** The V2 map shows HW-01 (list) and HW-02 (detail) as the same page (`HardwarePage.tsx`) with in-page state. For component consistency with brew-log (list page + detail page), should we split it? My recommendation: split during Phase 8.

4. **Guest view: independent tone or follows host preference?** `HouseholdGuestView` shows another user's data. Should tone be the viewer's preference or fixed (e.g., always BEIGE for warmth)?

5. **WebGL/HeroVisualFrame exemption: confirmed?** The compass chart visualization uses canvas rendering and doesn't participate in the tone token system. Confirming it remains exempt from the "no one-offs" mandate (it's not a UI component — it's a data visualization).

---

*Plan complete. Ready for operator review. No implementation begins until approved.*

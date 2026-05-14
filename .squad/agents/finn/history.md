# Finn — Frontend History

## Learnings

### 2026-05-13: Chip component full audit — verified correct, no fixes needed

- **What was found:** `Chip.tsx` already uses a single unified style (`bg-amber-900/30 text-amber-200/90 border border-amber-700/40 backdrop-blur-sm`) with no variants. Previous inline fix had correctly consolidated the `roast` and `machine` variants into one.
- **Call sites (all 5):** BrewLogDetail.tsx, Dashboard.tsx, CatalogList.tsx, CatalogDetail.tsx, HardwarePage.tsx — all use `<Chip />` with no `variant` prop. No orphaned inline badge spans for categorical labels remain.
- **Intentional non-chip badges:** `eligibility-badge` in BrewLogDetail uses inline DaisyUI badge with dynamic color (eligibility status is semantic, needs color coding). ImportWizard uses `badge-error`/`badge-success` for row validation — both correct and intentional.
- **TypeScript:** No `any`, proper `string | null | undefined` for label, optional `className`. Passes strict mode.
- **Padding:** `px-2 py-0.5` verified adequate — provides 8px horizontal breathing room for all label values (Light, Medium, Dark, Machine, Grinder, etc.).
- **All checks:** lint ✅ 0 warnings, build ✅, tests ✅ 140/140 passed.
- **Rule:** `<Chip />` is the canonical component for all categorical label pills. No variants — single amber frosted-glass style is the app-wide standard. Eligibility/status badges that require semantic color coding are intentionally separate patterns (DaisyUI badge with explicit color modifier).

### 2026-05-13: Chrome desktop black overlay on backdrop-filter + async background image

- **Root cause:** `#main-content` has `backdrop-filter: blur(4px)`. When the hero background image (e.g. `hero-brew.jpg`) loads asynchronously, Chrome desktop invalidates `.app-bg`'s GPU compositor layer and re-promotes it. During that layer promotion window, `#main-content`'s backdrop-filter samples from a black/empty compositor layer instead of the loaded image. Chrome mobile and Safari handle this layer transition without the black flash.
- **Fix 1 — `will-change: transform` on `.app-bg`:** Pre-promotes `.app-bg` to its own GPU compositor layer _before_ the image loads. Chrome then updates the layer in-place when the image arrives, keeping the backdrop-filter chain intact.
- **Fix 2 — Remove `transition: background-image`:** `background-image` is not a CSS-animatable property per CSS Transitions Level 1; the declaration was a no-op on all spec-compliant browsers. Chrome desktop may attempt a cross-fade internally that interferes with compositor layer management during image load.
- **Rule:** When a `backdrop-filter` element has a `position: fixed; z-index: -1` sibling that loads a background image asynchronously, always apply `will-change: transform` to the background element. This prevents Chrome from promoting a new compositor layer mid-flight and breaking the backdrop sampling chain.

### 2026-05-13: Roast/machine chip badge sizing fix

- **Root cause:** `CatalogDetail.tsx` used `badge` without `badge-sm`, rendering at full DaisyUI badge size (text-sm, h-6). All other instances had `badge-sm` but no explicit `text-xs`.
- **Fix:** Added `badge-sm` to CatalogDetail and added explicit `text-xs` to all four badge instances (BrewLogDetail, Dashboard, CatalogList, CatalogDetail) so chip text size is enforced regardless of DaisyUI version internals.
- **Rule:** Always pair DaisyUI badge components with both a size modifier (`badge-sm`) **and** an explicit Tailwind font-size (`text-xs`) for chip/tag use cases. Don't rely on DaisyUI's implicit font-size cascade.

### 2026-05-13: Badge chip horizontal padding

- **Root cause:** DaisyUI `badge-sm` only provides ~0.3rem horizontal padding, which is too tight for longer label text like "Medium" or "Light Roast". The text was visually touching the chip border edges.
- **Fix:** Added `px-2 py-0.5` to all four roast/machine type badge spans across BrewLogDetail, CatalogDetail, CatalogList, and Dashboard. Note that CatalogDetail and Dashboard also had `mt-2` in their class string (absent in the other two files) — the grep pattern differed slightly per file.
- **Rule:** DaisyUI badge variants (`badge-sm`, `badge-xs`) should always be supplemented with explicit `px-*` when displaying variable-length label text. Don't rely on DaisyUI's built-in padding for chip/tag use cases where breathing room matters.

### 2026-05-13: Aria's Chip design corrections applied

- **Border radius:** `rounded-full` → `rounded` — Aria (Designer) confirmed pill shapes are not part of the design system. The design token `--bevel-radius: 10px` (defined in `index.css`) mandates `rounded`, not pill/full.
- **Padding:** `px-2 py-0.5` → `px-2.5 py-1` — previous padding was too tight; text was crowding against chip edges. Aria specified the correct padding values.
- **Authority rule:** Aria owns all border-radius and spacing decisions for UI components. When Aria specifies a design token correction, apply it directly — no debate needed on shape tokens.

## Team Updates

### 2026-05-13: Session Log — Chip & Chrome Fixes

Both tasks (finn-1 and finn-2) completed and committed to `fix/ui-safari-polish`.

**Decisions archived to decisions.md:**
1. "Chrome desktop backdrop-filter + async background image pattern"
2. "Chip/Badge Sizing Convention"

See `.squad/orchestration-log/` for agent-level summaries.

### 2026-05-13: Generic Chip component extracted

- **Component:** `frontend/src/components/Chip.tsx`
- **Variants:**
  - `roast` — amber palette (`bg-amber-900/25 text-amber-300 border border-amber-600/30`); used for roast level in BrewLogDetail, Dashboard, CatalogDetail, CatalogList
  - `machine` — stone palette (`bg-stone-900/30 text-stone-400 border border-stone-600/30`); used for hardware category in HardwarePage
  - `default` — base classes only, no color overrides
- **API:** `<Chip label={...} variant="roast|machine|default" className="..." />`
- **Base classes:** `badge badge-sm text-xs px-2 py-0.5` (consistent padding/size enforced in one place)
- **Null-safe:** returns `null` if `label` is falsy — no conditional wrapping needed at call sites
- **Rule:** All future categorical label chips (roast type, machine category, etc.) should use `<Chip />` with the appropriate variant. Do not add inline badge spans to page files.

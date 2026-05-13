# Finn — Frontend History

## Learnings

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

## Team Updates

### 2026-05-13: Session Log — Chip & Chrome Fixes

Both tasks (finn-1 and finn-2) completed and committed to `fix/ui-safari-polish`.

**Decisions archived to decisions.md:**
1. "Chrome desktop backdrop-filter + async background image pattern"
2. "Chip/Badge Sizing Convention"

See `.squad/orchestration-log/` for agent-level summaries.

# Team Decisions Log

**Project:** espresso-logs  
**Last Updated:** 2026-05-13T16:46:53Z

---

## 2026-05-13

### Chrome desktop backdrop-filter + async background image pattern

**Author:** Finn  
**Branch:** fix/ui-safari-polish  
**Status:** Committed

When a `backdrop-filter` element has a `position: fixed; z-index: -1` sibling that loads a background image asynchronously, **always apply `will-change: transform` to the background element**.

**Rationale:** Chrome desktop's GPU compositor invalidates and re-promotes the background element's compositor layer when its `background-image` URL loads asynchronously. During the promotion window, `backdrop-filter` on a sibling element samples from a black/empty compositor layer. The `will-change: transform` hint pre-promotes the element to its own GPU layer before the image arrives, so the update happens in-place without disrupting the backdrop-filter chain.

Chrome mobile and Safari are unaffected, so the fix is Chrome desktop-only in effect but safe to apply universally.

**Also:** Remove `transition: background-image` from background elements. `background-image` is not a CSS-animatable property per CSS Transitions Level 1. Any `transition: background-image` declaration is a no-op in spec-compliant browsers and may interfere with compositor layer management.

**Implementation:** `.app-bg` in `frontend/src/index.css` now carries `will-change: transform` and the `transition: background-image 300ms ease` has been removed.

---

### Chip/Badge Sizing Convention

**Author:** Finn (Frontend)  
**Branch:** fix/ui-safari-polish  
**Status:** Committed

All roast/machine chip badges in the espresso-logs React SPA use the following consistent class pattern:

```
badge badge-sm text-xs <colour-tokens>
```

**Rationale:** DaisyUI's `badge-sm` sets a compact height but does not always enforce `font-size: 0.75rem` explicitly across all DaisyUI versions — it depends on the cascade. Adding `text-xs` explicitly guarantees the chip label text is 12px regardless of parent context or DaisyUI version. Without `text-xs`, badge text can inherit `text-sm` (14px) from the surrounding card or list context, which causes the label to push against the chip edges and appear broken.

**Applied to:**
- `frontend/src/pages/BrewLogDetail.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/CatalogList.tsx`
- `frontend/src/pages/CatalogDetail.tsx` (also fixed missing `badge-sm`)

**Rule:** When using DaisyUI `badge` as a compact metadata chip/tag, always specify both `badge-sm` **and** `text-xs`. Never rely on DaisyUI's implicit font-size inheritance for compact chips.

---

# Decision: Chrome desktop backdrop-filter + async background image pattern

**Date:** 2026-05-13  
**Author:** Finn  
**Branch:** fix/ui-safari-polish  

## Decision

When a `backdrop-filter` element has a `position: fixed; z-index: -1` sibling that loads a background image asynchronously, **always apply `will-change: transform` to the background element**.

## Rationale

Chrome desktop's GPU compositor invalidates and re-promotes the background element's compositor layer when its `background-image` URL loads asynchronously. During the promotion window, `backdrop-filter` on a sibling element samples from a black/empty compositor layer. The `will-change: transform` hint pre-promotes the element to its own GPU layer before the image arrives, so the update happens in-place without disrupting the backdrop-filter chain.

Chrome mobile and Safari are unaffected (they handle this layer transition without the black flash), so the fix is Chrome desktop-only in effect but safe to apply universally.

## Also: remove `transition: background-image` from background elements

`background-image` is not a CSS-animatable property per CSS Transitions Level 1. Any `transition: background-image` declaration is a no-op in spec-compliant browsers. Chrome desktop may attempt an internal cross-fade during image load that interferes with compositor layer management. Remove this declaration whenever found.

## Impact

- `.app-bg` in `frontend/src/index.css` now carries `will-change: transform` and the `transition: background-image 300ms ease` has been removed.
- No visual change on any browser.
- No performance risk: `will-change: transform` is applied to one single-leaf element.

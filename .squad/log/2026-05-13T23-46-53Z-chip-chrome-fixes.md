# Session Log: Chip & Chrome Fixes

**Date:** 2026-05-13  
**Timestamp:** 2026-05-13T23:46:53Z  
**Branch:** fix/ui-safari-polish  

## Work Completed

### Finn-1: Chrome Desktop Black Overlay Fix
Fixed Chrome desktop GPU compositor layer invalidation on `.app-bg`:
- Added `will-change: transform` for layer pre-promotion
- Removed ineffective `transition: background-image` declaration

### Finn-2: Badge Sizing Standardization
Standardized roast/machine chip badges across four components:
- Applied `px-2 py-0.5` padding to BrewLogDetail, CatalogDetail, CatalogList, Dashboard
- Fixed missing `badge-sm` on CatalogDetail badges

## Decisions Made

1. **Chrome desktop backdrop-filter + async background image pattern** — Always apply `will-change: transform` when `backdrop-filter` element has async background sibling
2. **Chip/Badge Sizing Convention** — Use `badge badge-sm text-xs` pattern for all roast/machine chips; never omit `text-xs`

## Status

Both tasks committed to fix/ui-safari-polish. Ready for merge review.

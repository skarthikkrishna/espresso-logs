# Finn — Frontend History

## Learnings

### 2026-05-13: Roast/machine chip badge sizing fix

- **Root cause:** `CatalogDetail.tsx` used `badge` without `badge-sm`, rendering at full DaisyUI badge size (text-sm, h-6). All other instances had `badge-sm` but no explicit `text-xs`.
- **Fix:** Added `badge-sm` to CatalogDetail and added explicit `text-xs` to all four badge instances (BrewLogDetail, Dashboard, CatalogList, CatalogDetail) so chip text size is enforced regardless of DaisyUI version internals.
- **Rule:** Always pair DaisyUI badge components with both a size modifier (`badge-sm`) **and** an explicit Tailwind font-size (`text-xs`) for chip/tag use cases. Don't rely on DaisyUI's implicit font-size cascade.

# Decision: Extract Generic Chip Component

**Date:** 2026-05-13  
**Author:** Finn  
**Branch:** fix/ui-safari-polish

## Decision

A shared `<Chip />` component has been extracted to replace all inline badge spans for categorical labels (roast type, machine/hardware category) across the frontend.

## Location

`frontend/src/components/Chip.tsx`

## Variants Found and Implemented

| Variant | Color Palette | Usage |
|---|---|---|
| `roast` | amber (`bg-amber-900/25 text-amber-300 border border-amber-600/30`) | Roast level in BrewLogDetail, Dashboard, CatalogDetail, CatalogList |
| `machine` | stone (`bg-stone-900/30 text-stone-400 border border-stone-600/30`) | Hardware category in HardwarePage |
| `default` | none (base classes only) | Fallback / future use |

## Component API

```tsx
<Chip label={shot.roast_level} variant="roast" />
<Chip label={item.category} variant="machine" />
<Chip label={someLabel} variant="roast" className="mt-2" />
```

- `label`: `string | null | undefined` — returns `null` if falsy (no conditional wrapping needed)
- `variant`: `'roast' | 'machine' | 'default'` — defaults to `'default'`
- `className`: optional extra classes (e.g. `mt-2` for margin)

## Base Classes

`badge badge-sm text-xs px-2 py-0.5` — applied to all variants consistently.

## Files Modified

- `frontend/src/components/Chip.tsx` — new component
- `frontend/src/pages/BrewLogDetail.tsx` — replaced inline roast badge
- `frontend/src/pages/Dashboard.tsx` — replaced inline roast badge
- `frontend/src/pages/CatalogDetail.tsx` — replaced inline roast badge
- `frontend/src/pages/CatalogList.tsx` — replaced inline roast badge
- `frontend/src/pages/HardwarePage.tsx` — replaced inline machine/category badge

## Not Converted

- Eligibility badge in `BrewLogDetail.tsx` — uses dynamic class function `eligibilityBadgeClasses()`, different concern
- ImportWizard error/success badges — use DaisyUI semantic variants (`badge-error`, `badge-success`), different concern

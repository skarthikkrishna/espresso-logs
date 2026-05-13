# Decision: Chip/Badge Sizing Convention

**Date:** 2026-05-13  
**Author:** Finn (Frontend)  
**Branch:** fix/ui-safari-polish

## Decision

All roast/machine chip badges in the espresso-logs React SPA use the following consistent class pattern:

```
badge badge-sm text-xs <colour-tokens>
```

Example:
```tsx
<span className="badge badge-sm text-xs bg-amber-900/25 text-amber-300 border border-amber-600/30">
  {value}
</span>
```

## Rationale

DaisyUI's `badge-sm` sets a compact height but does **not** always enforce `font-size: 0.75rem` explicitly across all DaisyUI versions — it depends on the cascade. Adding `text-xs` explicitly guarantees the chip label text is 12px regardless of parent context or DaisyUI version.

Without `text-xs`, badge text can inherit `text-sm` (14px) from the surrounding card or list context, which causes the label to push against the chip edges and appear broken.

## Scope

Applied to all four locations where roast_level renders as a chip:
- `frontend/src/pages/BrewLogDetail.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/CatalogList.tsx`
- `frontend/src/pages/CatalogDetail.tsx` (also fixed missing `badge-sm`)

## Rule

> When using DaisyUI `badge` as a compact metadata chip/tag, always specify both `badge-sm` **and** `text-xs`. Never rely on DaisyUI's implicit font-size inheritance for compact chips.

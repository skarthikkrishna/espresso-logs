# Decision: Chip Component — Single Unified Style (No Variants)

**Date:** 2026-05-13  
**Author:** Finn  
**Branch:** fix/ui-safari-polish  
**Supersedes:** `finn-chip-component.md` (variant API)

## Decision

`<Chip />` uses a **single unified amber frosted-glass style** for all categorical labels. The `variant` prop (and the `roast` / `machine` / `default` split) has been removed.

All chips — roast level, hardware category, and any future categorical labels — render identically.

## Rationale

- The user explicitly confirmed they want roast and machine chips to look the same.
- The amber/brown palette is the only consistent design language in the app; stone/grey chips looked visually disconnected.
- Fewer variants = fewer divergence points. One look to maintain, one place to change.
- The `default` fallback variant was never used; adding it was premature abstraction.

## Final API

```tsx
<Chip label={shot.roast_level} />
<Chip label={item.category} />
<Chip label={item.roast_level} className="mt-2" />
```

- `label`: `string | null | undefined` — returns `null` if falsy
- `className`: optional extra classes (e.g. `mt-2`)
- **No `variant` prop.**

## Final Style

```
inline-flex items-center text-xs px-2 py-0.5 rounded-full
bg-amber-900/30 text-amber-200/90 border border-amber-700/40 backdrop-blur-sm
```

- `rounded-full` pill shape
- `bg-amber-900/30` — semi-transparent amber, consistent with glass-card language
- `text-amber-200/90` — warm off-white text
- `border border-amber-700/40` — subtle amber border
- `backdrop-blur-sm` — frosted glass effect through the semi-transparent background
- `px-2 py-0.5` — 8px horizontal padding; text never touches edges

## Intentional Non-Chip Badges

These two patterns remain as DaisyUI `badge` spans and are NOT converted to `<Chip />`:

| Badge | File | Reason |
|---|---|---|
| Eligibility badge | `BrewLogDetail.tsx` | Semantic color: green/amber/red depending on `shot_eligibility` value; uses `eligibilityBadgeClasses()` |
| Import row status | `ImportWizard.tsx` | Semantic color: `badge-error` / `badge-success`; different concern (validation feedback) |

## Audit Results (2026-05-13)

- 5 call sites all correctly use `<Chip />` with no `variant` prop ✅
- No orphaned inline badge spans for categorical labels ✅
- TypeScript strict mode compliant ✅
- Lint: 0 warnings ✅
- Build: clean ✅
- Tests: 140/140 ✅

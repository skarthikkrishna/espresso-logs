# Session Log: 2025-07-29 — FAB Portal Fix

**Squad roles**: Finn (Frontend), Aria (UX), Quinn (QA), Priya (PM), Scribe (Documentation)

---

## Summary

FAB `position: fixed` scrolling bug fixed via React Portal migration.  
**Root cause**: `backdrop-filter: blur(4px)` on `#main-content` establishes a fixed containing block.  
**Fix**: Wrap FAB + toast in `createPortal(..., document.body)` in BrewLogList and Dashboard.  
**Test gap**: Zero existing FAB tests; Quinn recommended 1 Playwright scroll+position assertion.

---

## Decisions

- ✅ **Portal over AppShell restructure**: Minimal scope, preserves React tree, zero shell changes.
- ✅ **Portal improves z-index**: FAB now guaranteed above `#main-content` stacking context.
- ✅ **UX impact**: Zero visible behaviour change; design coherence preserved.

---

## Changes

| File | Change | Author |
|------|--------|--------|
| `frontend/src/pages/BrewLogList.tsx` | FAB + toast wrapped in `createPortal` | Finn |
| `frontend/src/pages/Dashboard.tsx` | Mobile FAB wrapped in `createPortal` | Finn |

---

## Tests

- ✅ Build passed (Finn)
- ⚠️ No existing FAB unit/E2E tests  
- ⚠️ Quinn: Recommend 1 Playwright scroll+position test (not implemented in this session)

---

## Next

- Merge PR
- Monitor production for FAB position correctness
- Consider adding scroll+position test to prevent future regressions

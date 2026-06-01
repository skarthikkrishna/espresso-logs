# Decision Drop — Finn Routing Assessment

**Date:** 2026-05-23  
**Agent:** Finn (Frontend/UI Routing Agent)  
**Branch:** feat/034-m5-household-roles  
**Request:** Fix React Query cache invalidation for hardware mutations

---

## Request Summary

Fix cache invalidation in `AddHardwareModal` and `EditHardwareModal` so the hardware list and detail panel update reactively after add/edit mutations — no full page reload required.

---

## Codebase Analysis

### Files examined
- `frontend/src/pages/HardwarePage.tsx` — list + detail queries, modal orchestration
- `frontend/src/components/AddHardwareModal.tsx` — `useMutation` with `createHardware`
- `frontend/src/components/EditHardwareModal.tsx` — `useMutation` with `updateHardware`
- `frontend/src/api/hardware.ts` — API layer
- `frontend/src/main.tsx` — `PersistQueryClientProvider` + `createSyncStoragePersister` setup
- `frontend/src/components/AddHardwareModal.test.tsx`
- `frontend/src/components/EditHardwareModal.test.tsx`

### Root cause identification

Both modals already call `queryClient.invalidateQueries({ queryKey: ['hardware'] })` in their `onSuccess` handlers. However, two issues are present:

1. **`EditHardwareModal`** invalidates only `['hardware']` (the list). The detail panel query key is `['hardware', hardware_id]`. While TanStack Query v5 prefix-matches by default and _should_ invalidate both, the detail panel in `HardwarePage` remains showing stale data after an edit because `setSelectedId` is not reset and the detail query needs an explicit invalidation of `['hardware', hardware.hardware_id]` to be safe and explicit.

2. **`HardwarePage` `onSaved` for edit** only calls `setEditModal({ open: false })` — it does not reset `selectedId` or trigger any UI refresh that would cause the detail panel name to visibly update. If the detail query is not actively observed to be invalid, the panel shows stale data.

3. The `PersistQueryClientProvider` with `localStorage` persister means hydrated cache from storage may suppress the visual update on the same session if the refetch resolves before the React render cycle completes.

### Scope assessment

- **Self-contained:** All changes confined to `frontend/src/` as constrained.  
- **No API changes:** No backend, schema, or auth changes needed.  
- **No new dependencies:** Uses existing TanStack Query v5 APIs.  
- **No architectural change:** Fixing mutation `onSuccess` callbacks and optionally updating `HardwarePage` callback logic.  
- **Bounded file set:** `EditHardwareModal.tsx`, `AddHardwareModal.tsx`, and/or `HardwarePage.tsx` — plus corresponding test files.  
- **Existing test infrastructure:** Vitest + Testing Library tests already exist for both modals.

---

## Routing Decision

**`status: DIRECT_PERMITTED`**

This is a bounded bug fix targeting existing mutation `onSuccess` callbacks. No new features, no new architecture, no spec required. The fix involves explicit `invalidateQueries` calls with the correct query keys and potentially updating the `HardwarePage` edit `onSaved` callback to also refresh the detail panel. Full SpecKit cycle is disproportionate for this scope.

### Explicit scope confirmation

| File | Change |
|------|--------|
| `frontend/src/components/EditHardwareModal.tsx` | Add explicit `['hardware', hardware.hardware_id]` invalidation in `onSuccess` |
| `frontend/src/components/AddHardwareModal.tsx` | Verify/confirm existing invalidation is sufficient; no change expected |
| `frontend/src/pages/HardwarePage.tsx` | Update `editModal.onSaved` callback to also invalidate detail or reset `selectedId` if needed |
| `frontend/src/components/EditHardwareModal.test.tsx` | Add/extend test asserting cache invalidation is called with correct keys |

No other files within or outside `frontend/src/` are in scope.

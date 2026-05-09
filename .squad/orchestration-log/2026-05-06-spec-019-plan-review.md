# Orchestration Log — 2026-05-06

**Review**: Spec 019 Implementation Plan Review — Hardware & Maintenance Add Flows  
**Branch**: `feat/019-hardware-maintenance-add-flows`  
**Participants**: Maya (Principal Engineer) · Alex (Backend Engineer) · Finn (Frontend Engineer) · Quinn (QA Engineer) · Priya (PM) · Aria (Designer)  
**Session Date**: 2026-05-06  

---

## Timeline

### 1. **Priya (PM)** — Scope & Product Review

**Focus**: User story coverage, FR completeness, scope boundary enforcement, user value delivery  
**Inputs**:
- `specs/019-hardware-maintenance-add-flows/spec.md` — 7 user stories, 19 FRs, 7 SCs
- `specs/019-hardware-maintenance-add-flows/plan.md` — §6 task list, §7 FR cross-reference, §9 out-of-scope confirmations
- `frontend/src/pages/HardwarePage.tsx` — current page state (EDIT stubs, no add/maintenance flows)

**Analysis**:

Cross-referenced all 19 functional requirements against §7 of the plan:

| FR | Task(s) | Status |
|---|---|---|
| FR-001 (per-category "+ Add" buttons, always-visible headers) | T008b | ✓ Plan removes `if (!items.length) return null` guard; headers always render |
| FR-002 / FR-002b (Add modal fields + pre-select) | T005 + T008b | ✓ `initialCategory` prop wires per-category button to pre-selected dropdown |
| FR-003 (Save disabled on empty name) | T005 | ✓ `canSave = category !== '' && name.trim().length > 0` |
| FR-004 (invalidate + auto-select new item) | T005 + T008d | ✓ `onSaved(item.hardware_id)` → `setSelectedId(newId)` in HardwarePage |
| FR-004b / FR-004c (image pipeline + COLUMNS extension) | T001 + T002 | ✓ |
| FR-005 (glass-card empty state with CTA) | T008c | ✓ Replaces plain-text fallback |
| FR-006 (Log maintenance only for Machine/Grinder) | T008d | ✓ Conditional render gated on category |
| FR-007 to FR-012 (Log Maintenance modal) | T006 | ✓ All fields, validation, invalidation covered |
| FR-013 to FR-015 (Edit Hardware modal) | T007 + T008d | ✓ EDIT button wired, category field absent |
| FR-016 to FR-019 (modal styling, errors, loading, action types) | T005–T007 | ✓ All three modals implement all four cross-cutting FRs |

All 7 success criteria (SC-001 – SC-007) are achievable with this plan as written.

**One advisory note**: The Add Hardware modal Product URL field uses `type="text"` on the frontend. Users entering `ftp://example.com` will receive a generic "Couldn't save hardware" error after a round-trip to the backend. Spec acceptance scenario US-1/8 only requires a generic retry prompt (not a specific URL validation message), so this is spec-compliant. Flagging as a future UX enhancement: add a `pattern` or `type="url"` guard on the input.

Out-of-scope confirmations (§9) match the spec's "Out of scope" section exactly. No scope drift detected.

**Decision**: **APPROVE WITH NOTES**
- All 19 FRs covered and correctly tasked.
- Product URL frontend validation UX gap: spec-compliant, flag for future sprint.

---

### 2. **Maya (Principal Engineer)** — Architecture & Engineering Correctness

**Focus**: Image pipeline correctness, exception handling, `FakeSheetsClient` edge cases, typing, logging quality, security  
**Inputs**:
- `app/repos/hardware.py` — `HardwareRepo`, `COLUMNS`, `upsert()`, `next_id()`
- `app/routers/api_hardware.py` — current `_hw_to_out()`, `api_hardware_create`
- `app/routers/api_catalog.py` — reference image pipeline (`api_catalog_create`)
- `app/services/image_sourcer.py` — `source_bean_image()`, `fetch_image_bytes()`, `_is_safe_url()`
- `app/services/image_store.py` — `upload_image()`
- `app/deps.py` — `get_llm_client`
- `tests/doubles.py` — `FakeSheetsClient.update_row` header-derivation logic

**Analysis**:

**Finding 1 — T002: Bare `except Exception:` swallows exception text (must fix)**

Plan proposes:
```python
except Exception:  # noqa: BLE001
    logger.warning("image pipeline failed for hardware %r", hardware_id)
```

The catalog reference implementation logs the exception:
```python
except Exception as exc:
    logger.warning("image upload failed for %r: %s", catalog_id, exc)
```

Without capturing `exc`, the log line `"image pipeline failed for hardware M01"` gives no actionable information when debugging a real failure (e.g., GCS credentials expired, network timeout, SSRF block). This diverges from the catalog pattern without justification and will make production debugging significantly harder. Should be:
```python
except Exception as exc:  # noqa: BLE001
    logger.warning("image pipeline failed for hardware %r: %s", hardware_id, exc)
```
This is a **must-fix at implementation time**.

**Finding 2 — T002: `ext` derivation differs from catalog pattern (advisory)**

Plan uses:
```python
ext = content_type.split("/")[-1].replace("jpeg", "jpg")
```

Catalog uses:
```python
if "png" in content_type:    ext = "png"
elif "webp" in content_type: ext = "webp"
else:                        ext = "jpg"
```

The plan's approach is correct given `fetch_image_bytes()` only returns one of three content-types (`image/jpeg`, `image/png`, `image/webp`). Not a correctness issue, but less readable. Implementer may choose either; catalog's explicit form is preferred for parity.

**Finding 3 — T003: `_hw_to_out()` fallback removal is safe (confirmed)**

The Hardware sheet's `COLUMNS` tuple never included `Image_URL` — that column exists only in Catalog. The `Product_URL` fallback was also always `None` since the column didn't exist in Hardware. Removing both and reading only `Local_Image_Path` is safe for all existing rows (they have no image to lose). The `or None` guard correctly converts `""` to `None`. ✓

**Finding 4 — T001/T002: `FakeSheetsClient.update_row` header-derivation risk**

`update_row` derives column headers from the first existing row's `.keys()` (see `doubles.py:41-42`). If any test seeds a `Hardware` tab with old 3-column rows (`Hardware_ID`, `Category`, `Name`) before calling `upsert()` with new 5-column rows, `Product_URL` and `Local_Image_Path` will be silently dropped. Plan §10 correctly flags this. Tests in T009/T010 must seed all 5 columns.

**Finding 5 — Security: SSRF protection confirmed (no action needed)**

The plan routes user-supplied `product_url` through `_is_safe_url()` (blocks private IPs, localhost, non-http/https schemes) before any HTTP request. This is enforced inside `fetch_page_context()` and `source_bean_image()`. The scheme validation at the router level (step 4 in T002) provides an early 422 for clearly invalid schemes before any I/O. Defence-in-depth is correct. ✓

**Finding 6 — `get_llm_client` injection (confirmed present)**

T002's import update includes `get_llm_client` in the `app.deps` import. The handler signature adds `llm_client=Depends(get_llm_client)`. `get_llm_client` is already defined in `app/deps.py:100-104`. No new dependency wiring needed. ✓

**Decision**: **APPROVE WITH NOTES**
- **Must-fix**: Change `except Exception:` to `except Exception as exc:` and log `exc` in T002.
- Advisory: Match catalog's explicit `if/elif` extension check for parity.

---

### 3. **Alex (Backend Engineer)** — API Contract, Schema & Pydantic Review

**Focus**: Request/response model correctness, schema migration safety, `product_url` validation, backward compatibility  
**Inputs**:
- `app/routers/api_hardware.py` — current endpoints and models
- `app/routers/api_catalog.py` — reference for `_CatalogCreateBody`, image pipeline integration
- `app/repos/hardware.py` — `COLUMNS`, `upsert()`, `add_many()`
- `tests/doubles.py` — `FakeSheetsClient`

**Analysis**:

**Finding 1 — `_HardwareCreateBody` extension is correct**

Plan adds `product_url: str | None = None` to the Pydantic model. Default `None` means the field is optional and existing callers sending `{ category, name }` remain valid without change. ✓

**Finding 2 — `COLUMNS` extension and `add_many()` compatibility (confirmed safe)**

`add_many()` materialises rows as:
```python
values = [[row.get(col, "") for col in self.COLUMNS] for row in rows]
```
Adding `"Product_URL"` and `"Local_Image_Path"` to `COLUMNS` means `add_many()` will write `""` for those columns when the source dict doesn't include them. `row.get(col, "")` handles missing keys correctly. No code change to `add_many()` is needed; the plan correctly notes this. ✓

**Finding 3 — `upsert()` backward compatibility with existing sheet data**

The current sheet has rows with only `{ Hardware_ID, Category, Name }`. After `COLUMNS` is extended, any `upsert()` call for an existing row will build a dict including `"Product_URL": ""` and `"Local_Image_Path": ""`. `FakeSheetsClient.update_row` derives headers from the **first existing row's keys** — if that row was seeded before COLUMNS expansion, the new keys are dropped. For the live `RealSheetsClient`, the sheet itself has columns in its header row; columns absent from the sheet header are silently dropped by gspread. This means the migration of existing rows to the new schema requires the sheet to have the two new columns added before the code is deployed. This dependency is implicit in the plan but not stated explicitly. **Implementer note**: Add `Product_URL` and `Local_Image_Path` columns to the live Hardware sheet tab before deploying T001.

**Finding 4 — Image pipeline T002: step ordering matches catalog pattern exactly**

1. Initial upsert (hardware row with `Local_Image_Path: ""`) ✓
2. Image pipeline in non-fatal try block ✓
3. Second upsert on success to write `Local_Image_Path` back ✓
4. `row["Local_Image_Path"] = image_path` before returning ✓
5. `_hw_to_out(row)` reads the in-memory `row` (not a re-fetch) ✓

This matches the catalog create pattern precisely. ✓

**Finding 5 — `product_url` whitespace handling**

The validation step uses `urlparse(body.product_url.strip()).scheme`. The row construction uses `(body.product_url or "").strip()`. Both apply `.strip()`. Consistent. ✓

**Finding 6 — Sheet migration prerequisite (advisory)**

The plan documents the schema change but does not include a migration task (e.g., `scripts/migrate_hardware_schema.py` to add columns to existing rows or to the sheet header). For the live Google Sheet, `Product_URL` and `Local_Image_Path` columns must exist in the sheet header before `upsert()` writes them — otherwise gspread drops them. This is an operational prerequisite, not a code gap.

**Decision**: **APPROVE WITH NOTES**
- Live sheet must have `Product_URL` and `Local_Image_Path` columns added before deployment. Add as an explicit deployment checklist item.
- No code-level blockers.

---

### 4. **Finn (Frontend Engineer)** — Component Contracts, State Wiring, TypeScript Safety

**Focus**: Modal prop interfaces, state machines, query invalidation keys, rendering edge cases, TypeScript correctness  
**Inputs**:
- `frontend/src/pages/HardwarePage.tsx` — current page (EDIT stub, grouped list, detail panel)
- `frontend/src/api/hardware.ts` — `createHardware()`, `updateHardware()`, `getActionTypes()`
- `frontend/src/api/maintenance.ts` — `createMaintenance()`
- `frontend/src/types/entities.ts` — `HardwareItem`, `HardwareDetail`, `MaintenanceEvent`
- `frontend/src/components/AddBeanModal.tsx` — DaisyUI modal pattern reference
- Plan T004–T008 code sketches

**Analysis**:

**Finding 1 — T008a: `useQueryClient` declared in HardwarePage is unused (must fix)**

Plan T008a adds:
```tsx
const queryClient = useQueryClient()  // needed here for inline invalidation if any
```

However, all three modals (`AddHardwareModal`, `LogMaintenanceModal`, `EditHardwareModal`) each call `useQueryClient()` internally and perform their own cache invalidation. `HardwarePage` itself never calls `queryClient.*` anywhere in the T008 code. This is dead code that will trigger a TypeScript `noUnusedLocals` warning and a potential ESLint `no-unused-vars` error. The `import { useQueryClient }` and the const declaration should be removed from `HardwarePage` unless a direct use is introduced. **Must remove to prevent lint failure in CI.**

**Finding 2 — T008d + T005: Redundant `onClose()` call pattern (advisory)**

`AddHardwareModal.onSuccess` calls:
```tsx
onSaved(item.hardware_id)  // calls setAddModal({ open: false }) + setSelectedId(newId)
onClose()                  // calls setAddModal({ open: false }) again
```

Both `onSaved` and `onClose` in `HardwarePage` set the same `addModal.open = false`. Calling them both is harmless (React batches same-state updates), but the pattern is inconsistent: the spec for `AddHardwareModalProps` defines `onSaved` as the "success" callback and `onClose` as the "dismiss" callback. On success, only `onSaved` should fire; `onClose` is for cancel/backdrop. Recommendation: remove the `onClose()` call from the mutation's `onSuccess` handler in `AddHardwareModal`; let the `HardwarePage` `onSaved` prop handle closing. `LogMaintenanceModal` has the same pattern and should be corrected consistently.

**Finding 3 — T008b: Empty-category rendering logic (confirmed correct)**

When `hardware.length > 0`, the `CATEGORY_ORDER.map()` runs. Inside, the `if (!items.length) return null` guard is removed, so all 4 category headers always render. When `hardware.length === 0`, the empty-state card renders instead (not the category map). Loading state is handled by `if (isLoading) return <LoadingSpinner />` before the map runs. No case renders an empty list and empty-state simultaneously. ✓

**Finding 4 — T006: `staleTime: Infinity` on action types query (advisory)**

```tsx
useQuery({ queryKey: ['actionTypes'], queryFn: getActionTypes, staleTime: Infinity })
```

This is correct for static-ish data. However, if the backend's `_ACTION_TYPES_BY_CATEGORY` ever changes, the user must manually reload to pick up new types. The spec notes "action type management is a backend concern and not configurable from the UI," making this an acceptable trade-off. Confirmed with spec assumption: "The `getActionTypes()` call can be made once… and its result cached for the lifetime of the modal." ✓

**Finding 5 — T004: `createHardware` type update is correct**

```typescript
// After
export const createHardware = (data: { category: string; name: string; product_url?: string }) =>
```

`product_url?: string` (optional, not `string | null`) is the right TypeScript idiom for "omit if not present." The modal passes `product_url: productUrl.trim() || undefined`, which correctly omits the key when empty. ✓

**Finding 6 — Product URL input type (advisory)**

All three modals use `type="text"` for text inputs. The Product URL field should use `type="url"` to give mobile users the URL keyboard layout and browser-level URL syntax hints. Single character change, no functional impact on validation logic.

**Decision**: **APPROVE WITH NOTES**
- **Must-fix**: Remove `const queryClient = useQueryClient()` from `HardwarePage` T008a (unused, will fail lint).
- Advisory: Remove redundant `onClose()` from `AddHardwareModal.onSuccess` for prop-contract clarity.
- Advisory: Change Product URL `type="text"` → `type="url"`.

---

### 5. **Quinn (QA Engineer)** — Test Coverage, Fixture Correctness, Assertion Strength

**Focus**: T009/T010 test design, fixture isolation, assertion adequacy, coverage gaps, FakeSheetsClient edge cases  
**Inputs**:
- `tests/doubles.py` — `FakeSheetsClient.update_row` header-derivation behavior
- `tests/test_repos.py` — existing fixture patterns and assertion style
- Plan T009 (new backend tests), T010 (extended `test_hw_cache.py`), T011 (optional frontend tests)

**Analysis**:

**Finding 1 — T011 (frontend tests) classified P2/optional: should be P1 (advisory)**

The three new modals each implement: validation gates, loading states, error states, cache invalidation, and conditional rendering. The plan labels T011 as "optional — P2." Given the project's existing Test Quality Checklist (assertion strength, fixture isolation, coverage per new public function), and the fact that Vitest is already in the frontend stack, frontend component tests for these modals should be treated as **required before merge**, not optional. Each modal has 7–9 test cases listed in the plan. They directly validate correctness of the spec's success criteria (SC-001, SC-002, SC-003, SC-004, SC-005).

Recommendation: Promote T011 to P1 required, add to merge gate.

**Finding 2 — T009 seeding requirement: explicit column list required**

`FakeSheetsClient.update_row` derives column headers from the first existing row's `.keys()` (line 41 of `doubles.py`). If any T009 test creates a `Hardware` tab with a 3-column row first, then calls `upsert()` with a 5-column dict, `Product_URL` and `Local_Image_Path` will be silently dropped. All T009 and T010 fixtures that seed the `Hardware` tab **must** use all 5 columns:

```python
FakeSheetsClient({"Hardware": [{"Hardware_ID": "M01", "Category": "Machine", "Name": "Test",
                                 "Product_URL": "", "Local_Image_Path": ""}]})
```

Plan §10 identifies this risk but the individual test descriptions (T009, T010) do not repeat the requirement. Test reviewer should verify every `FakeSheetsClient` initialization in those test files uses the full 5-column schema.

**Finding 3 — T009 test 2: assertion should verify both item creation AND empty `Local_Image_Path` (advisory)**

T009 test case 2 (`test_create_with_product_url_image_sourcing_fails_gracefully`) asserts:
> "Assert response status 201. Assert `image_path` is `None`. Assert item was still created."

The assertion "Assert item was still created" should also verify that `Local_Image_Path == ""` in the sheet row (not `None`), confirming the initial `upsert()` persisted before the pipeline was attempted. This distinguishes "pipeline failed after initial write" from "initial write never happened."

**Finding 4 — T010 test 3 assertion ambiguity (advisory)**

T010 test case 3 (`test_hw_to_out_with_empty_local_image_path`) says: "seeded row with `Local_Image_Path = ''` → `image_path` is absent from response (or null)." The actual behavior of `_hw_to_out()` with `row.get("Local_Image_Path") or None` is to return `None`, which serializes as `null` in JSON (not absent). The test assertion should check `response.json()["image_path"] is None` (null), not look for field absence. Field absence would require `exclude_none=True` in the Pydantic response model, which is not specified.

**Finding 5 — T009 happy path: verify second upsert updates the sheet (advisory)**

T009 test case 1 (`test_create_with_product_url_sources_and_uploads_image`) asserts `hardware_repo.get(hardware_id)["Local_Image_Path"] == GCS_path`. This is exactly the right assertion — it verifies the second upsert landed. ✓ No gap.

**Finding 6 — `test_columns_tuple_includes_new_fields` is a good regression guard (confirmed)**

T010 test 2 asserting `"Product_URL" in HardwareRepo.COLUMNS` and `"Local_Image_Path" in HardwareRepo.COLUMNS` is a simple but effective guard against accidental revert of the COLUMNS tuple. ✓

**Decision**: **APPROVE WITH NOTES**
- Promote T011 frontend tests from P2/optional to P1/required before merge.
- All T009/T010 fixtures must seed `Hardware` tab with all 5 columns explicitly.
- T010 test 3: assert `image_path is None` (null), not field absence.
- T009 test 2: add assertion that `Local_Image_Path == ""` in the sheet row.

---

### 6. **Aria (Designer)** — Visual Consistency, DaisyUI Pattern Compliance, UX Quality

**Focus**: Modal styling, empty state presentation, loading/error feedback, button hierarchy, accessibility  
**Inputs**:
- `frontend/src/components/AddBeanModal.tsx` — canonical modal reference (DaisyUI pattern)
- `frontend/src/pages/HardwarePage.tsx` — existing amber/stone design tokens
- Plan T005, T006, T007, T008b, T008c, T008d code sketches

**Analysis**:

**Finding 1 — Modal box styling: compliant with FR-016 ✓**

All three modals use:
```tsx
<dialog className="modal modal-open">
  <div className="modal-box bg-stone-900 border border-amber-900/30">
```
This exactly matches `AddBeanModal.tsx`'s pattern. The `modal-backdrop` form-element close-on-click is also present in all three. ✓

**Finding 2 — Empty state (T008c): visually appropriate ✓**

The glass-card empty state uses:
- `glass-card` container class (consistent with right-panel placeholder)
- `text-amber-400/40` SVG icon (muted amber, appropriate for empty state)
- `text-amber-200/60` descriptive text
- `bg-amber-600 hover:bg-amber-500` primary CTA button

This is visually consistent with the right panel's "Select a piece of hardware" placeholder. The icon reuses the same machine SVG already used in `HardwareIcon`, which creates visual coherence. ✓ FR-005 satisfied.

**Finding 3 — "Log maintenance" button: secondary action hierarchy (advisory)**

The detail panel's Log maintenance button uses:
```tsx
className="btn btn-sm bg-amber-800/60 hover:bg-amber-700/60 border border-amber-600/30 text-amber-200"
```
This lower-opacity amber style creates a secondary action distinction from the primary `bg-amber-600` Save buttons in the modals. The visual hierarchy is correct (primary = modal save, secondary = page-level CTA), but this is a new button style not previously used in the codebase. The implementer should document this as a "secondary-action" button variant or add it to `index.css` as a named utility class for future consistency.

**Finding 4 — Loading states: DaisyUI spinner correctly applied ✓**

All three modals use `<span className="loading loading-spinner loading-xs" />` inside the Save button when `isPending`. This matches the DaisyUI loading component spec and provides inline visual feedback without modal layout shift. ✓ FR-018 satisfied.

**Finding 5 — Error state: red text on dark background ✓**

Error messages use `text-xs text-red-400 text-center`. Red on dark stone background provides sufficient contrast for error signaling. The messages are positioned above the action buttons, which is the correct reading-order position. ✓ FR-017 satisfied.

**Finding 6 — Product URL input: `type="text"` vs `type="url"` (advisory)**

The Product URL input in `AddHardwareModal` uses `type="text"`. On mobile, `type="url"` surfaces the URL keyboard (with `.com` shortcut) which meaningfully improves the experience for adding a product URL on a phone. Single-attribute change, no styling impact.

**Finding 7 — "+ Add" button alignment (confirmed ✓)**

Per-category "+ Add" buttons use:
```tsx
<button className="text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium" aria-label={`Add ${cat}`}>
```
This matches the EDIT button's style exactly (`text-xs text-amber-400 hover:text-amber-300 transition-colors font-medium tracking-wide`), maintaining visual consistency for in-list action text buttons. The `aria-label` attribute is a good accessibility addition. ✓

**Decision**: **APPROVE WITH NOTES**
- Product URL input: change `type="text"` → `type="url"` for mobile UX.
- Log maintenance button uses a new secondary-action style — document as intentional pattern or add a CSS utility class.
- All FR-016, FR-017, FR-018 compliance confirmed.

---

## Consensus Decision

| Reviewer | Domain | Verdict | Blocking? |
|---|---|---|---|
| **Priya** (PM) | Scope, user stories, FR coverage | APPROVE WITH NOTES | No |
| **Maya** (Principal Engineer) | Architecture, exception handling, security | APPROVE WITH NOTES | No |
| **Alex** (Backend Engineer) | API contracts, schema, Pydantic, DI | APPROVE WITH NOTES | No |
| **Finn** (Frontend Engineer) | Component contracts, state wiring, TypeScript | APPROVE WITH NOTES | No |
| **Quinn** (QA Engineer) | Test coverage, fixture correctness, assertion strength | APPROVE WITH NOTES | No |
| **Aria** (Designer) | Visual consistency, DaisyUI compliance, accessibility | APPROVE WITH NOTES | No |

**UNANIMOUS VERDICT**: **APPROVED WITH NOTES — Proceed to implementation**

No reviewer issued a HOLD. The plan is architecturally sound and specification-complete. Two issues should be addressed **at implementation time** (before PR merge), not before implementation begins:

1. **T002 logging fix** (Maya): `except Exception as exc:` with `logger.warning("...", hardware_id, exc)` — makes image pipeline debugging possible.
2. **T008a unused import** (Finn): Remove `const queryClient = useQueryClient()` from `HardwarePage` — prevents lint failure in CI.

---

## Action Items

| Owner | Item | Priority | When |
|---|---|---|---|
| Implementer | T002: Change `except Exception:` → `except Exception as exc:` and log exc text | **P0** | Before merge |
| Implementer | T008a: Remove unused `const queryClient = useQueryClient()` from HardwarePage | **P0** | Before merge |
| Implementer | Add `Product_URL` and `Local_Image_Path` columns to live Hardware sheet tab | **P0** | Before deployment |
| Implementer | T008d: Remove redundant `onClose()` call from `AddHardwareModal.onSuccess` | P1 | Implementation |
| Implementer | T009/T010: Seed all `Hardware` fixtures with full 5-column schema | P1 | When writing tests |
| Implementer | T010 test 3: Assert `image_path is None` (null), not field absence | P1 | When writing tests |
| Implementer | T009 test 2: Assert `Local_Image_Path == ""` in sheet row (not just response) | P1 | When writing tests |
| Implementer | Promote T011 frontend component tests from P2/optional to P1/required | P1 | Before PR merge |
| Implementer | Product URL input: `type="text"` → `type="url"` in AddHardwareModal | P2 | Nice to have |
| Aria | Document "secondary-action" button variant (`bg-amber-800/60`) as intentional pattern | P2 | Post-implementation |
| Priya | Backlog: add client-side URL format validation on Product URL field | P3 | Future sprint |

---

## Artifacts

- **Spec**: `specs/019-hardware-maintenance-add-flows/spec.md`
- **Plan**: `specs/019-hardware-maintenance-add-flows/plan.md`
- **Review log**: `.squad/orchestration-log/2026-05-06-spec-019-plan-review.md`
- **Reference review**: `.squad/orchestration-log/2025-07-14-storage-method-review.md`

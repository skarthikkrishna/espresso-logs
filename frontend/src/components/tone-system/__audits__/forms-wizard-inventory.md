# spec-043 T001 forms/wizard inventory

Source-of-truth inventory for the spec-043 forms/wizard unification audit. Paths are repository-relative. Status values describe the planned terminal state for the surface after the canonical forms/wizard work lands:

- `CHANGED` — migrate to a canonical route-backed form/wizard or canonical action destination.
- `SHIMMED` — keep only as redirect/compatibility wrapper after the canonical route ships.
- `INTENTIONALLY-UNTOUCHED` — not part of spec-043 form/wizard unification; do not fail T027 for this surface.

## Route inventory

| Surface ID | Current route / entry | Current file path | Current pattern | Planned status | Owning task(s) | Notes for T027/static audit |
|---|---|---|---|---|---|---|
| route-home | `/` | `frontend/src/router.tsx`; `frontend/src/pages/Dashboard.tsx` | Full-page list/home with CTAs | CHANGED | T026, T027, T028 | Sweep `LogShotAction`, manage catalog, AddBagAction, Import CTA, bag cards, recent shot cards to canonical destinations. |
| route-catalog-list | `/catalog` | `frontend/src/router.tsx`; `frontend/src/pages/CatalogList.tsx` | Full-page list plus add modal | CHANGED | T012, T018, T026, T027 | Add coffee CTA currently opens `AddBeanModal`; canonical destination is `/catalog/new`. |
| route-catalog-detail | `/catalog/:id` | `frontend/src/router.tsx`; `frontend/src/pages/CatalogDetail.tsx` | Full-page detail with inline edit/add-bag/status forms | CHANGED | T012, T018, T019, T022, T026, T027 | Detail remains; create/edit/add-bag/status controls route or use approved narrow confirmation. |
| route-brew-log-list | `/brew-log` | `frontend/src/router.tsx`; `frontend/src/pages/BrewLogList.tsx` | Full-page list | CHANGED | T010, T026, T027, T028 | Log shot and shot-card entries must route to canonical add/detail/edit destinations. |
| route-brew-log-add | `/brew-log/add` | `frontend/src/router.tsx`; `frontend/src/pages/BrewLogAdd.tsx` | Full-page legacy primitive form | CHANGED | T009, T011, T026, T027, T028 | Migrate to `FormPageShell`/`EntityFormActions`; remove `components/ui` form atoms or use approved adapters. |
| route-brew-log-detail | `/brew-log/:id` | `frontend/src/router.tsx`; `frontend/src/pages/BrewLogDetail.tsx` | Full-page detail with inline correction form and delete dialog | CHANGED | T010, T011, T026, T027, T028 | Correction/edit becomes `/brew-log/:id/edit`; delete remains a narrow canonical destructive confirmation. |
| route-brew-log-edit-missing | _not declared_ | `frontend/src/router.tsx` | Missing canonical edit route | CHANGED | T010, T011, T026, T027 | Add `/brew-log/:id/edit`. |
| route-inventory-detail-missing | _not declared_ | `frontend/src/router.tsx`; `frontend/src/components/tone-system/BagCard.tsx` | Bag cards link to `/inventory/:bagId`, but router has no route | CHANGED | T007, T008, T012, T019, T026, T027 | Add reload-safe bag detail route. |
| route-inventory-edit-missing | _not declared_ | `frontend/src/router.tsx` | Missing canonical bag edit route | CHANGED | T012, T019, T022, T026, T027 | Add `/inventory/:bagId/edit`. |
| route-inventory-new-missing | _not declared_ | `frontend/src/router.tsx`; `frontend/src/pages/CatalogDetail.tsx` | Add-bag is inline inside catalog detail | CHANGED | T012, T019, T022, T026, T027 | Add `/catalog/:catalogId/inventory/new`. |
| route-hardware-list | `/hardware` | `frontend/src/router.tsx`; `frontend/src/pages/HardwarePage.tsx` | Full-page list plus query-param detail and modals | CHANGED | T012, T020, T021, T022, T026, T027 | Add hardware CTA currently opens `AddHardwareModal`. |
| route-hardware-detail-query | `/hardware?item=:id` | `frontend/src/pages/HardwarePage.tsx` | Query-param in-page detail takeover | SHIMMED | T012, T020, T022, T026, T027 | Canonical detail route is `/hardware/:id`; query-param entry may remain only as redirect/compat. |
| route-hardware-detail-missing | _not declared_ | `frontend/src/router.tsx`; `frontend/src/pages/HardwarePage.tsx` | Missing canonical hardware detail route | CHANGED | T012, T020, T022, T026, T027 | Add `/hardware/:id`. |
| route-hardware-new-missing | _not declared_ | `frontend/src/router.tsx`; `frontend/src/components/AddHardwareModal.tsx` | Missing canonical hardware create route | CHANGED | T012, T020, T022, T026, T027 | Add `/hardware/new`. |
| route-hardware-edit-missing | _not declared_ | `frontend/src/router.tsx`; `frontend/src/components/EditHardwareModal.tsx` | Missing canonical hardware edit route | CHANGED | T012, T020, T022, T026, T027 | Add `/hardware/:id/edit`. |
| route-maintenance-new-missing | _not declared_ | `frontend/src/router.tsx`; `frontend/src/components/LogMaintenanceModal.tsx` | Missing canonical maintenance create route | CHANGED | T012, T021, T022, T026, T027 | Add `/hardware/:id/maintenance/new`. |
| route-import | `/import` | `frontend/src/router.tsx`; `frontend/src/pages/ImportWizard.tsx` | Admin full-page legacy primitive wizard | CHANGED | T023, T024, T025, T026, T027, T028 | Migrate visual/layout grammar only; preserve Upload → Preview → Done behavior. |
| route-household-settings | `/household/settings` | `frontend/src/router.tsx`; `frontend/src/pages/HouseholdSettings.tsx` | Full-page household settings form | INTENTIONALLY-UNTOUCHED | none | Household governance/settings are outside spec-043 entity form/wizard scope; do not include in T027 in-scope failures. |
| route-household-new | `/household/new` | `frontend/src/router.tsx`; `frontend/src/pages/HouseholdNew.tsx` | Full-page household creation form | INTENTIONALLY-UNTOUCHED | none | Household onboarding is outside spec-043 entity form/wizard scope. |
| route-auth-login | `/login` | `frontend/src/router.tsx`; `frontend/src/pages/Login.tsx` | Auth form | INTENTIONALLY-UNTOUCHED | none | Auth is outside spec-043 entity form/wizard scope. |
| route-auth-register | `/register` | `frontend/src/router.tsx`; `frontend/src/pages/Register.tsx` | Auth form | INTENTIONALLY-UNTOUCHED | none | Auth is outside spec-043 entity form/wizard scope. |
| route-welcome | `/welcome` | `frontend/src/router.tsx`; `frontend/src/pages/Welcome.tsx` | Onboarding/join form | INTENTIONALLY-UNTOUCHED | none | Onboarding is outside spec-043 entity form/wizard scope. |

## Surface inventory: forms, wizards, modals, and inline confirmations

| Surface ID | User surface | Current file path | Current pattern | Planned status | Owning task(s) | T027/static audit target |
|---|---|---|---|---|---|---|
| form-shot-add | Brew Log add shot | `frontend/src/pages/BrewLogAdd.tsx` | Full-page legacy `components/ui` form (`FormField`, `Input`, `Select`, `Textarea`, `Button`, `PageHeader`, `ActionExpander`) | CHANGED | T009, T011, T026, T027 | No in-scope legacy form atoms after migration; route stays `/brew-log/add`. |
| form-shot-correction-inline | Brew Log detail correction/edit | `frontend/src/pages/BrewLogDetail.tsx` | Inline detail form using tone-system fields (`ToneInput`, `ToneSelect`, `ToneTextarea`) | CHANGED | T010, T011, T026, T027 | Move to `/brew-log/:id/edit` canonical form; detail CTA routes there. |
| confirm-shot-delete | Brew Log detail delete | `frontend/src/pages/BrewLogDetail.tsx` | `AccessibleDialog` destructive confirmation using legacy `Button` | CHANGED | T010, T011, T028 | May remain only as narrow canonical destructive confirmation; replace legacy button atoms where covered. |
| form-catalog-create-modal | Catalog create/add bean | `frontend/src/components/AddBeanModal.tsx`; opened from `frontend/src/pages/CatalogList.tsx` | Modal with URL inference, manual fields, image select/upload, legacy `components/ui` atoms | SHIMMED | T012, T018, T022, T026, T027 | Canonical create route is `/catalog/new`; modal may remain only redirect/compat shim. |
| form-catalog-edit-inline | Catalog/bean edit | `frontend/src/pages/CatalogDetail.tsx` | Inline detail edit form using tone-system fields | CHANGED | T012, T018, T022, T026, T027 | Move to `/catalog/:id/edit`; preserve URL inference/manual/media parity as applicable. |
| media-catalog-image-replace | Catalog image replace | `frontend/src/pages/CatalogDetail.tsx`; `frontend/src/components/AddBeanModal.tsx` | Inline/file input and modal file input | CHANGED | T016, T017, T018, T022, T027 | Use `EntityMediaField`; shared catalog/hardware media parity. |
| form-bag-add-inline | Add inventory bag from catalog detail | `frontend/src/pages/CatalogDetail.tsx` | Inline add-bag form in detail page | CHANGED | T012, T019, T022, T026, T027 | Move to `/catalog/:catalogId/inventory/new`; preserve roast split/no ownership cleanup. |
| form-bag-status-inline | Finish/reactivate bag from catalog detail | `frontend/src/pages/CatalogDetail.tsx` | Inline row action on `BagCard` | CHANGED | T019, T022, T026, T027, T028 | Use approved narrow status confirmation/canonical action; no broad modal alternative. |
| form-bag-edit-missing | Inventory bag edit | _not present_ | Missing route/form | CHANGED | T012, T019, T022, T026, T027 | Add `/inventory/:bagId/edit`. |
| page-bag-detail-missing | Inventory bag detail | `frontend/src/components/tone-system/BagCard.tsx` links; router missing page | Missing route-backed detail page | CHANGED | T007, T008, T012, T019, T026, T027 | Add `/inventory/:bagId`; visible labels must not show raw IDs. |
| form-hardware-create-modal | Hardware create | `frontend/src/components/AddHardwareModal.tsx`; opened from `frontend/src/pages/HardwarePage.tsx` | Modal with legacy `FormField`, `Input`, `Select`, `ModalFooter` | SHIMMED | T012, T020, T022, T026, T027 | Canonical route is `/hardware/new`; modal may remain only redirect/compat shim. |
| page-hardware-detail-query | Hardware detail | `frontend/src/pages/HardwarePage.tsx` | Query-param detail panel inside `/hardware` | SHIMMED | T012, T020, T022, T026, T027 | Canonical route is `/hardware/:id`; query-param state should not remain user-facing destination. |
| form-hardware-edit-modal | Hardware edit | `frontend/src/components/EditHardwareModal.tsx`; opened from `frontend/src/pages/HardwarePage.tsx` | Modal with legacy `FormField`, `Input`, `ModalFooter`; only edits name/category payload | SHIMMED | T012, T013, T020, T022, T026, T027 | Canonical route is `/hardware/:id/edit`; displayed fields editable or explicitly deferred/read-only. |
| media-hardware-image-replace | Hardware image replace/upload | `frontend/src/pages/HardwarePage.tsx` (`HardwareHeroImage`) | Inline file input and tone button in query detail | CHANGED | T016, T017, T020, T022, T027 | Use `EntityMediaField`; match catalog media states/cache behavior. |
| form-maintenance-create-modal | Log maintenance | `frontend/src/components/LogMaintenanceModal.tsx`; opened from `frontend/src/pages/HardwarePage.tsx` | Modal with legacy `FormField`, `Input`, `Select`, `Textarea`, `ModalFooter` | SHIMMED | T012, T021, T022, T026, T027 | Canonical route is `/hardware/:id/maintenance/new`; route fetches hardware context. |
| wizard-import | Import CSV wizard | `frontend/src/pages/ImportWizard.tsx` | Full-page legacy wizard with local `ImportStepper`, `components/ui` `FormField`/`Button`/`Badge`/`GlassCard`/`PageHeader` | CHANGED | T023, T024, T025, T026, T027, T028 | Use `WizardShell`, `ToneStepper`, `ImportPreviewRows`; preserve import logic. |
| form-household-settings | Household settings/admin | `frontend/src/pages/HouseholdSettings.tsx` | Full-page legacy `components/ui` settings form | INTENTIONALLY-UNTOUCHED | none | Outside spec-043 entity forms/wizard. |
| form-household-new | Household creation | `frontend/src/pages/HouseholdNew.tsx` | Full-page legacy `components/ui` form | INTENTIONALLY-UNTOUCHED | none | Outside spec-043 entity forms/wizard. |
| form-auth-login | Login | `frontend/src/pages/Login.tsx` | Auth form with legacy `components/ui` atoms | INTENTIONALLY-UNTOUCHED | none | Outside spec-043 entity forms/wizard. |
| form-auth-register | Register | `frontend/src/pages/Register.tsx` | Auth form with legacy `components/ui` atoms | INTENTIONALLY-UNTOUCHED | none | Outside spec-043 entity forms/wizard. |
| form-welcome-join | Welcome/join household | `frontend/src/pages/Welcome.tsx` | Onboarding form with legacy `components/ui` atoms | INTENTIONALLY-UNTOUCHED | none | Outside spec-043 entity forms/wizard. |

## Entry-point inventory

| Entry ID | Current file path | Current CTA/link/button | Current destination/pattern | Planned status | Owning task(s) | Notes |
|---|---|---|---|---|---|---|
| entry-home-log-shot | `frontend/src/pages/Dashboard.tsx`; `frontend/src/components/tone-system/actions/LogShotAction.tsx` | Hero `LogShotAction` | Navigates to `/brew-log/add` | CHANGED | T009, T026, T027 | Keep route-backed add-shot; add prefill when bag context exists. |
| entry-home-manage-catalog | `frontend/src/pages/Dashboard.tsx` | `Manage catalog` button | Navigates to `/catalog` | CHANGED | T026, T027 | Valid list route; verify no alternate modal path. |
| entry-home-add-first-bag | `frontend/src/pages/Dashboard.tsx`; `frontend/src/components/tone-system/actions/AddBagAction.tsx` | Fresh/empty `AddBagAction` | Navigates to `/catalog` unless catalogId provided | CHANGED | T019, T026, T027 | Canonical add-bag should become route-backed once a catalog context exists; otherwise list entry remains discovery. |
| entry-home-import-csv | `frontend/src/pages/Dashboard.tsx` | Empty-state `Import CSV` | Navigates to `/import` | CHANGED | T024, T026, T027 | Canonical import route remains. |
| entry-home-bag-card | `frontend/src/pages/Dashboard.tsx`; `frontend/src/components/tone-system/BagCard.tsx` | Active bag card | Defaults to `/brew-log/add?bag_id=:bagId` for `variant="card"` | CHANGED | T007, T008, T019, T026, T027 | Bag cards/detail scope requires canonical bag detail route and log-shot action. |
| entry-home-recent-shot-card | `frontend/src/pages/Dashboard.tsx`; `frontend/src/components/tone-system/ShotCard.tsx` | Recent shot card | Navigates to `/brew-log/:id` | CHANGED | T010, T026, T027 | Add edit/log-similar canonical actions on detail/list as required. |
| entry-brew-list-log-shot | `frontend/src/pages/BrewLogList.tsx`; `frontend/src/components/tone-system/actions/LogShotAction.tsx` | Header/empty `LogShotAction` | Navigates to `/brew-log/add` | CHANGED | T009, T026, T027 | Canonical add route. |
| entry-brew-list-shot-card | `frontend/src/pages/BrewLogList.tsx`; `frontend/src/components/tone-system/ShotCard.tsx` | Shot card | Navigates to `/brew-log/:id` | CHANGED | T010, T026, T027 | Detail actions route to edit/log-similar. |
| entry-brew-detail-correct | `frontend/src/pages/BrewLogDetail.tsx` | `Correct` button | Opens inline correction form | CHANGED | T010, T011, T026, T027 | Route to `/brew-log/:id/edit`. |
| entry-brew-detail-delete | `frontend/src/pages/BrewLogDetail.tsx` | Delete button | Opens `AccessibleDialog` | CHANGED | T010, T011, T028 | Narrow destructive confirmation allowed after canonicalization. |
| entry-catalog-list-add | `frontend/src/pages/CatalogList.tsx`; `frontend/src/components/tone-system/actions/AddBeanAction.tsx` | Header/empty add coffee | Opens `AddBeanModal` | CHANGED | T012, T018, T026, T027 | Route to `/catalog/new`; modal shim only. |
| entry-catalog-card | `frontend/src/pages/CatalogList.tsx` | Catalog `EntityCard` | Navigates to `/catalog/:catalog_id` | CHANGED | T018, T026, T027 | Detail route stays; edit/create moved to canonical routes. |
| entry-catalog-detail-add-bag | `frontend/src/pages/CatalogDetail.tsx`; `frontend/src/components/tone-system/actions/AddBagAction.tsx` | `AddBagAction` in detail header | Opens inline add-bag form via `onAdd` | CHANGED | T012, T019, T026, T027 | Route to `/catalog/:catalogId/inventory/new`. |
| entry-catalog-detail-edit | `frontend/src/pages/CatalogDetail.tsx` | `Edit` button | Opens inline catalog edit form | CHANGED | T012, T018, T026, T027 | Route to `/catalog/:id/edit`. |
| entry-catalog-detail-bag-card | `frontend/src/pages/CatalogDetail.tsx`; `frontend/src/components/tone-system/BagCard.tsx` | Bag row | `BagCard` row has `/inventory/:bagId` default, but row rendering currently returns non-link wrapper when `variant="row"` | CHANGED | T007, T019, T026, T027 | Ensure bag row/card has real canonical destination where expected. |
| entry-catalog-detail-bag-status | `frontend/src/pages/CatalogDetail.tsx` | Finish/reactivate button | Inline mutation | CHANGED | T019, T022, T026, T027 | Use canonical narrow status flow. |
| entry-catalog-detail-recent-shot | `frontend/src/pages/CatalogDetail.tsx` | Recent shots table row | Navigates to `/brew-log/:shotId?back=/catalog/:id` | CHANGED | T010, T026, T027 | Keep reload-safe detail route; add canonical edit/log-similar actions. |
| entry-hardware-list-add | `frontend/src/pages/HardwarePage.tsx` | Header/empty `Add hardware` | Opens `AddHardwareModal` | CHANGED | T012, T020, T026, T027 | Route to `/hardware/new`; modal shim only. |
| entry-hardware-card | `frontend/src/pages/HardwarePage.tsx`; `frontend/src/components/tone-system/HardwareCard.tsx` | Hardware card | Sets `?item=:hardwareId` in list page | CHANGED | T012, T020, T026, T027 | Route to `/hardware/:id`. |
| entry-hardware-detail-edit | `frontend/src/pages/HardwarePage.tsx` | Detail `Edit` button | Opens `EditHardwareModal` | CHANGED | T012, T020, T026, T027 | Route to `/hardware/:id/edit`. |
| entry-hardware-detail-maintenance | `frontend/src/pages/HardwarePage.tsx` | Detail `Log maintenance` button | Opens `LogMaintenanceModal` for Machine/Grinder | CHANGED | T012, T021, T026, T027 | Route to `/hardware/:id/maintenance/new`; Basket/Storage redirect/explanation required. |
| entry-hardware-detail-image | `frontend/src/pages/HardwarePage.tsx` | `Upload image` / `Replace image` | Inline hidden file input | CHANGED | T016, T017, T020, T027 | Route/detail page consumes `EntityMediaField`. |
| entry-import-nav | `frontend/src/router.tsx`; app navigation surfaces | `/import` protected admin route | Full-page import wizard | CHANGED | T024, T026, T027 | Keep route; canonical wizard grammar. |

## Legacy primitive import inventory

`T027` should fail on these imports only when they are in-scope and not converted to approved adapters/shims. Out-of-scope auth/household imports are recorded so the guard can avoid false positives.

| Import ID | Current file path | Imported legacy atoms | Planned status | Owning task(s) | Guard expectation |
|---|---|---|---|---|---|
| legacy-brew-log-add | `frontend/src/pages/BrewLogAdd.tsx` | `Button`, `FormField`, `Input`, `PageHeader`, `Select`, `Textarea`, `ActionExpander` from `../components/ui` | CHANGED | T009, T011, T027 | Remove or replace with approved canonical adapters. |
| legacy-import-wizard | `frontend/src/pages/ImportWizard.tsx` | `Badge`, `Button`, `FormField`, `GlassCard`, `PageHeader` from `../components/ui` | CHANGED | T023, T024, T025, T027 | Remove in favor of wizard/tone-system primitives. |
| legacy-catalog-add-modal | `frontend/src/components/AddBeanModal.tsx` | `Button`, `FormField`, `Input`, `Select`, `ModalFooter` from `./ui` | SHIMMED | T012, T018, T027 | User-facing modal import prohibited except redirect/compat shim/tests. |
| legacy-hardware-add-modal | `frontend/src/components/AddHardwareModal.tsx` | `FormField`, `Input`, `Select`, `ModalFooter` from `./ui` | SHIMMED | T012, T020, T027 | User-facing modal import prohibited except redirect/compat shim/tests. |
| legacy-hardware-edit-modal | `frontend/src/components/EditHardwareModal.tsx` | `FormField`, `Input`, `ModalFooter` from `./ui` | SHIMMED | T012, T020, T027 | User-facing modal import prohibited except redirect/compat shim/tests. |
| legacy-maintenance-modal | `frontend/src/components/LogMaintenanceModal.tsx` | `FormField`, `Input`, `Select`, `Textarea`, `ModalFooter` from `./ui` | SHIMMED | T012, T021, T027 | User-facing modal import prohibited except redirect/compat shim/tests. |
| legacy-brew-detail-delete | `frontend/src/pages/BrewLogDetail.tsx` | `Button` from `../components/ui` | CHANGED | T010, T011, T028 | Delete confirmation may remain narrow but should use canonical action primitives. |
| legacy-hardware-page | `frontend/src/pages/HardwarePage.tsx` | `Button`, `GlassCard` from `../components/ui` | CHANGED | T020, T026, T027 | In-scope hardware page should not rely on legacy page primitives after migration. |
| legacy-household-settings | `frontend/src/pages/HouseholdSettings.tsx` | `Badge`, `Button`, `FormField`, `Input`, `PageHeader`, `Select` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope; allow unless a future spec claims household settings. |
| legacy-household-new | `frontend/src/pages/HouseholdNew.tsx` | `Button`, `FormField`, `Input`, `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-login | `frontend/src/pages/Login.tsx` | `Button`, `FormField`, `Input`, `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-register | `frontend/src/pages/Register.tsx` | `Button`, `FormField`, `Input`, `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-welcome | `frontend/src/pages/Welcome.tsx` | `Button`, `FormField`, `Input`, `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-profile | `frontend/src/pages/Profile.tsx` | `Badge`, `Button`, `GlassCard`, `PageHeader` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope and not an entity create/edit form. |
| legacy-guest-view | `frontend/src/pages/HouseholdGuestView.tsx` | `Badge` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-invite-accept | `frontend/src/pages/InviteAccept.tsx` | `Button`, `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-invite-invalid | `frontend/src/pages/InviteInvalid.tsx` | `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-invite-expired | `frontend/src/pages/InviteExpired.tsx` | `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |
| legacy-not-found | `frontend/src/pages/NotFound.tsx` | `LayerTransition` | INTENTIONALLY-UNTOUCHED | none | Out-of-scope. |

## Modal component inventory

| Modal ID | Current file path | Opened by | Current pattern | Planned status | Owning task(s) | Required terminal state |
|---|---|---|---|---|---|---|
| modal-add-bean | `frontend/src/components/AddBeanModal.tsx` | `frontend/src/pages/CatalogList.tsx` | User-facing create modal | SHIMMED | T012, T018, T026, T027 | Redirect/compat only after `/catalog/new` ships. |
| modal-add-hardware | `frontend/src/components/AddHardwareModal.tsx` | `frontend/src/pages/HardwarePage.tsx` | User-facing create modal | SHIMMED | T012, T020, T026, T027 | Redirect/compat only after `/hardware/new` ships. |
| modal-edit-hardware | `frontend/src/components/EditHardwareModal.tsx` | `frontend/src/pages/HardwarePage.tsx` | User-facing edit modal | SHIMMED | T012, T020, T026, T027 | Redirect/compat only after `/hardware/:id/edit` ships. |
| modal-log-maintenance | `frontend/src/components/LogMaintenanceModal.tsx` | `frontend/src/pages/HardwarePage.tsx` | User-facing create maintenance modal | SHIMMED | T012, T021, T026, T027 | Redirect/compat only after `/hardware/:id/maintenance/new` ships. |
| dialog-delete-shot | `frontend/src/pages/BrewLogDetail.tsx` | `frontend/src/pages/BrewLogDetail.tsx` | Narrow destructive `AccessibleDialog` | CHANGED | T010, T011, T028 | Allowed as canonical destructive confirmation if accessible and not an add/edit modal. |

## EXTRA SURFACES — needs coordinator/Tariq re-scope decision

None found in the in-scope surfaces named by spec-043/T001. The extra legacy form-primitive imports discovered are auth/onboarding/household/profile/invite/not-found surfaces and are classified above as `INTENTIONALLY-UNTOUCHED` because tasks.md scopes the migration to Home, Brew Log, Catalog/bags, Hardware/maintenance, and Import.

## Greppable task map

- T007/T008: `route-inventory-detail-missing`, `page-bag-detail-missing`, bag-card route safety and no raw IDs.
- T009/T011: `form-shot-add`, `route-brew-log-add`, `legacy-brew-log-add`.
- T010/T011: `route-brew-log-detail`, `route-brew-log-edit-missing`, `form-shot-correction-inline`, `confirm-shot-delete`.
- T012: canonical route skeletons/shims for catalog, inventory, hardware, maintenance, and import route foundations.
- T016/T017: `media-catalog-image-replace`, `media-hardware-image-replace` shared `EntityMediaField` tests.
- T018: `form-catalog-create-modal`, `form-catalog-edit-inline`, catalog media parity.
- T019: `form-bag-add-inline`, `form-bag-status-inline`, `form-bag-edit-missing`, inventory bag route/detail/edit surfaces.
- T020: `form-hardware-create-modal`, `page-hardware-detail-query`, `form-hardware-edit-modal`, hardware media parity.
- T021: `form-maintenance-create-modal`, `route-maintenance-new-missing`.
- T023/T024/T025: `wizard-import`, `route-import`, `legacy-import-wizard`.
- T026/T027: all `entry-*`, all in-scope `legacy-*`, all add/edit modal shims.
- T028: system-level responsive/a11y/security coverage and allowed narrow confirmations.

# Tariq Rollout Checklist — Component System Rebuild
## Operationalizing Maya's Architecture + Aria's Northstar Across the Full V2 Surface Map

**Author:** Tariq (TPM)  
**Date:** 2026-06-15  
**Status:** PLAN ARTIFACT — FOR OPERATOR REVIEW (no implementation yet)  
**Inputs:** Maya `technical-plan.md` (phases 0–10, shells A–E, 10 one-off categories), Aria `aria-principles-northstar.md` (12 principles), `surface-api-map.md` v2 (62 endpoints, 17 surface families), live spot-checks of 12 page files and the `components/ui/` barrel.  
**Covers:** 19 current page files (20 post Hardware split), all 62 registered endpoints.

---

## Quick Reference — Shell Pattern Assignments

| Shell | Pattern | Assigned Pages |
|-------|---------|----------------|
| **A** | Takeover Card (detail) | BrewLogDetail ★, CatalogDetail ★, HardwareDetail (new, Phase 8) |
| **B** | List/Grid Page | Dashboard, BrewLogList, CatalogList, HardwarePage (list mode), GuestView |
| **C** | Form/Wizard (narrow card) | Login, Register, Welcome, HouseholdNew, BrewLogAdd, ImportWizard |
| **D** | Settings/Admin (multi-section) | Profile, HouseholdSettings, InviteAccept |
| **E** | Static/Error | NotFound, InviteInvalid, InviteExpired |

★ = approved prototype anchor (v5 refinements only — not a full migration target)

---

## §1 Per-Page Checklist

> **How to use:** Each entry lists (1) the shell pattern the page adopts, (2) the shared primitives/composed components it must use post-migration, (3) the specific current one-offs in that page's code that must be retired, and (4) a Definition of Done. Check every box before closing the migration PR for that page.
>
> **Anchor pages (BrewLogDetail, CatalogDetail)** are marked ★. They are the approved northstar, not migration targets — they receive scoped v5 refinements only (see their entries).

---

### P-01 · Login (`frontend/src/pages/Login.tsx`)

**Shell:** C — `TonePageWrapper` + `TakeoverCard variant="form" size="narrow"` + `bg-auth-login`

**Shared primitives/composed components required post-migration:**
- `TonePageWrapper` (replaces `StandaloneHouseholdShell`)
- `TakeoverCard variant="form" size="narrow"`
- `TitleBlock` (app logo/wordmark + tagline)
- `FormSection` (username + password fields)
- `ToneInput` × 2 (username, password)
- `ToneButton variant="primary"` (Sign in)
- `ToneButton variant="secondary"` (Google OAuth trigger)
- `ToneLink` (→ /register)
- Shared `GoogleIcon` (extracted SVG — see one-offs)

**Current one-offs to retire:**
| One-off | Location | Replace With |
|---------|----------|--------------|
| `StandaloneHouseholdShell` | `Login.tsx:22, :29` | `TonePageWrapper` |
| Inline `GoogleIcon()` function | `Login.tsx` (local function) | Shared icon component in `components/ui/icons/` |
| `Button` (DaisyUI-backed) | `Login.tsx` | `ToneButton` |
| `Input` (DaisyUI-backed) | `Login.tsx` | `ToneInput` |
| `FormField` wrapper | `Login.tsx` | `FormSection` (tone-aware) |
| `LayerTransition` | `Login.tsx` | Shell entry animation in `TonePageWrapper` |

**Definition of Done:**
- [ ] Shell C wraps the page; `StandaloneHouseholdShell` removed
- [ ] Both fields use `ToneInput`; no DaisyUI `input` class in content
- [ ] Sign-in button uses `ToneButton variant="primary"`; Google button uses `ToneButton variant="secondary"`
- [ ] `GoogleIcon` exported from shared icon library; not an inline function
- [ ] No `LayerTransition` import; no `FormField` import
- [ ] Zero inline `style={{ }}` setting color/bg/font properties
- [ ] Tone toggle (DARK/BEIGE) renders correctly on both values
- [ ] Mobile (375px) layout verified; card fits viewport with gutters
- [ ] Desktop (1280px) layout verified; card centered, photo visible on sides

---

### P-02 · Register (`frontend/src/pages/Register.tsx`)

**Shell:** C — `TonePageWrapper` + `TakeoverCard variant="form" size="narrow"` + `bg-auth-register`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard variant="form" size="narrow"`, `TitleBlock`
- `FormSection` (4 fields: username, display name, password, confirm password)
- `ToneInput` × 4
- `ToneButton variant="primary"` (Create account)
- `ToneLink` (→ /login)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `StandaloneHouseholdShell` | `TonePageWrapper` |
| `Button` | `ToneButton` |
| `Input` × 4 | `ToneInput` × 4 |
| `FormField` × 4 | `FormSection` |
| `LayerTransition` | Shell entry animation |

**Definition of Done:**
- [ ] Shell C; all four fields via `ToneInput`; no `StandaloneHouseholdShell`
- [ ] Client-side validation errors render using `ToneText` / form error classes — no inline colors
- [ ] 409 server error renders under username field using shared error display pattern
- [ ] Tone toggle works; mobile + desktop verified

---

### P-03 · Welcome / Onboarding Wizard (`frontend/src/pages/Welcome.tsx`)

**Shell:** C — `TonePageWrapper` + `TakeoverCard variant="form" size="narrow"` + `bg-welcome`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard`, `TitleBlock`
- `FormSection` (`'create'` step: household name input + submit)
- `ToneInput` (household name)
- `ToneButton variant="primary"` (Create household, Choose action)
- `ToneButton variant="secondary"` (Back, Join via invite)
- `EmptyBlock` (invite-instructions step: static copy + no API)
- Wizard step state = React state machine (no shared component; pure logic)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `StandaloneHouseholdShell` | `TonePageWrapper` |
| `Button` | `ToneButton` |
| `Input` | `ToneInput` |
| `FormField` | `FormSection` |
| `LayerTransition` | Shell animation |

**Definition of Done:**
- [ ] All three wizard steps (choose / create / invite-instructions) render within Shell C
- [ ] `StandaloneHouseholdShell` removed; `TonePageWrapper` wraps the page
- [ ] `FormSection` + `ToneInput` own the create-household form
- [ ] Static invite-instructions step uses `EmptyBlock` or `ToneText` prose; no one-off markup
- [ ] Auth redirect logic unchanged; tone toggle works; mobile verified

---

### P-04 · Dashboard (`frontend/src/pages/Dashboard.tsx`)

**Shell:** B — `TonePageWrapper` + `TakeoverCard variant="list"` + `bg-dashboard`

**Shared primitives/composed components required:**
- `TonePageWrapper`
- `TakeoverCard variant="list"` (active bags section, recent shots section — separate cards)
- `TitleBlock` (integrated into shell header)
- `DataTable` + `TableRow` (recent shots list)
- `ParamGrid` + `ParamPair` (per-bag details: roast level, dose, yield)
- `ChipBar` + `RoastChip` (bag status + roast level)
- `ActionBar` + `ToneButton variant="primary"` (Log a shot FAB, Add bag CTA)
- `EmptyBlock` (no-bags, no-shots empty states)
- `HeroVisualFrame` **(EXEMPT — WebGL/canvas viz; stays as-is; not a layout component)**
- `ToneButton variant="secondary"` (Manage catalog, Import CSV CTAs)

**Current one-offs to retire:**
| One-off | Location | Replace With |
|---------|----------|--------------|
| `GlassCard variant="content"` | `Dashboard.tsx` + loading skeleton | `TakeoverCard` |
| `.kaapi-content-border` hardcoded ref | Loading skeleton: `bg-[var(--kaapi-content-border)]` | `TakeoverCard` built-in skeleton |
| `.kaapi-content-muted` hardcoded ref | Error state: `text-[var(--kaapi-content-muted)]` | `ToneText variant="muted"` |
| `PageHeader` component | `Dashboard.tsx` | Shell header (integrated into `TonePageWrapper`) |
| `SectionHeading` | `Dashboard.tsx` | `SectionHeader` |
| `Badge` (DaisyUI) | Status indicators | `Chip` (tone-aware) |
| `EmptyState` | `Dashboard.tsx` | `EmptyBlock` |
| `Button` | FAB, CTAs | `ToneButton` |
| Inline `kaapi-motion-card` class | Card stagger selector | Motion util (stays as-is; not a layout class) |

**Special note:** `DashboardHeroMotion` and `HeroVisualFrame` are motion/viz components, not layout. They are exempt from the tone system but should not use `.kaapi-content-*` token references internally.

**Definition of Done:**
- [ ] Shell B; active bag cards via `TakeoverCard` + `ParamGrid` + `ChipBar`
- [ ] Recent shots via `DataTable` + `TableRow`
- [ ] No `GlassCard` import; no `.kaapi-content-border`/`.kaapi-content-muted` inline refs
- [ ] FAB and CTAs via `ToneButton`; `Badge` replaced with `Chip`
- [ ] `EmptyState` → `EmptyBlock`; `PageHeader` → shell
- [ ] `HeroVisualFrame` exempt status confirmed; no tone-system changes to it
- [ ] Tone toggle works; dashboard responds to DARK/BEIGE on both tones

---

### P-05 · Brew Log List (`frontend/src/pages/BrewLogList.tsx`)

**Shell:** B — `TonePageWrapper` + `TakeoverCard variant="list"` + `bg-brew-log`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard variant="list"`, `TitleBlock`
- `DataTable` + `TableRow` (each shot row)
- `Pagination` (existing component — wraps or migrates to tone-aware variant)
- `ToneButton variant="primary"` (Log a shot FAB)
- `ChipBar` + `Chip variant="eligibility"` (eligibility status per row)
- `RoastChip` (roast level per row)
- `EmptyBlock` (no shots)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `GlassCard` | `TakeoverCard variant="list"` |
| `PageHeader` | Shell header |
| `Badge` (eligibility) | `Chip variant="eligibility"` |
| `EmptyState` | `EmptyBlock` |
| `eligibilityBadgeTone` util | `Chip` with variant mapping (util retired after this phase) |
| `Button` (FAB) | `ToneButton variant="primary"` |
| `LoadingSpinner` | Skeleton within `TakeoverCard` (or keep as shared spinner — evaluate) |

**Definition of Done:**
- [ ] Shell B; all shot rows via `DataTable` + `TableRow`
- [ ] Eligibility rendered by `Chip variant="eligibility"` — `eligibilityBadgeTone` util removed from this page
- [ ] Roast level via `RoastChip` — `roastChipClass` util removed from this page  
- [ ] No `GlassCard`; no `PageHeader`; no `Badge`; no `EmptyState`
- [ ] Pagination uses shared `Pagination` component (verify it uses `--kk-tc-*` tokens or wrap)
- [ ] Tone toggle works; FAB via `ToneButton`; mobile verified

---

### P-06 · Brew Log Add (`frontend/src/pages/BrewLogAdd.tsx`)

**Shell:** C (dense form) — `TonePageWrapper` + `TakeoverCard variant="form"` + `bg-brew-log`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard variant="form"`, `TitleBlock`
- `FormSection` (bag selection, hardware selection, shot parameters, notes — as distinct sections with `SectionHeader`)
- `ToneSelect` (bag picker, machine, grinder, basket, eligibility)
- `ToneInput` × multiple (dose, yield, time, grind setting)
- `ToneTextarea` (user notes)
- `ToneButton variant="primary"` (Submit shot)
- `ToneButton variant="secondary"` (Cancel)
- `EmptyBlock` (no active bags state with CTA to /catalog)
- `CompassChart` **(EXEMPT — specialized data viz; stays as-is)**
- `ActionExpander` — audit: if it uses DaisyUI internally, wrap or migrate it

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `PageHeader` | Shell header |
| `Button` | `ToneButton` |
| `Input` | `ToneInput` |
| `Select` | `ToneSelect` |
| `Textarea` | `ToneTextarea` |
| `FormField` wrapper | `FormSection` |
| `LoadingSpinner` | `TakeoverCard` skeleton variant |

**Definition of Done:**
- [ ] Shell C; all form fields use `ToneInput`/`ToneSelect`/`ToneTextarea` — no DaisyUI form classes in content
- [ ] Four logical sections (bag / hardware / parameters / notes) each wrapped in `FormSection` with `SectionHeader`
- [ ] `PageHeader` removed; `Button` replaced; `FormField` replaced
- [ ] `CompassChart` exempt; `ActionExpander` audited and either wrapped or migrated
- [ ] Tone toggle works; form pre-population (from defaults API) unchanged; mobile verified

---

### P-07 · Brew Log Detail ★ ANCHOR (`frontend/src/pages/BrewLogDetail.tsx`)

**Shell:** A — `TonePageWrapper` + `TakeoverCard` + `bg-brew-log` + `BackLink` + `ToneToggle`

**Status:** APPROVED PROTOTYPE — scoped v5 refinements only. This page is the reference baseline for all other Shell A pages. No architectural changes; only retire the specific patterns listed below.

**Shared primitives/composed components (already in use or will be after v5):**
- `TonePageWrapper` (scoping change: `.kk-b-page` → `[data-tone]`)
- `TakeoverCard`
- `TitleBlock` (shot title + subtitle metadata)
- `ParamGrid` + `ParamPair` (brew parameters: dose/yield/time/grind)
- `ActionBar` + `ToneButton variant="edit"` + `ToneButton variant="danger"` (correction / delete)
- `ChipBar` + `RoastChip` + `Chip variant="eligibility"`
- `MarkdownSection` + `Markdown` (AI feedback section)
- `FormSection` + `ToneInput` / `ToneSelect` / `ToneTextarea` (correction form in-page)
- `AccessibleDialog` (delete confirmation — stays shared)

**v5 one-offs to retire (targeted — not a full page rewrite):**
| One-off | v5 Action |
|---------|-----------|
| Direct `ReactMarkdown` import | Wrap in `<Markdown>` component (`.kk-tc-markdown` container) — Principle 11 |
| `roastChipClass` util call | Replace with `<RoastChip>` component |
| `eligibilityBadgeTone` util call | Replace with `<Chip variant="eligibility">` |
| Inline `style={{ color: 'var(--kk-tc-...)' }}` | Replace with semantic `.kk-tc-body` / `.kk-tc-body-muted` classes |
| Forced `text-transform: uppercase` on chip | Remove — Principle 7; render canonical casing |
| `.kk-b-page` scope on wrapper | Promote to `data-tone` attribute — Phase 0 token promotion |

**Definition of Done:**
- [ ] No inline `style={{ }}` setting token-covered properties
- [ ] `ReactMarkdown` wrapped in `<Markdown>` component; `.kk-tc-markdown` container applied
- [ ] `roastChipClass` → `<RoastChip>`; `eligibilityBadgeTone` → `<Chip variant="eligibility">`
- [ ] No `text-transform: uppercase` on data-value chips; section headers retain uppercase
- [ ] `[data-tone]` attribute drives tone (not `.kk-b-page`); tone toggle works on both DARK and BEIGE
- [ ] This page acts as the **visual reference snapshot** for all Shell A PRs — Playwright northstar screenshots captured here

---

### P-08 · Catalog List (`frontend/src/pages/CatalogList.tsx`)

**Shell:** B — `TonePageWrapper` + `TakeoverCard variant="list"` + `bg-catalog`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard variant="list"`, `TitleBlock`
- `ToneInput` (search — client-side filter)
- Card grid layout within `TakeoverCard` (beans may use grid, not table — per product behavior)
- `TitleIcon` (bean image or monogram fallback)
- `RoastChip` (per card)
- `Chip` (status: Active/Finished bag count)
- `ToneButton variant="primary"` (Add bean → opens `AddBeanModal`)
- `EmptyBlock` (no beans state with Import CTA)
- **`AddBeanModal`** must also migrate: `FormSection` + `ToneInput` + `ToneButton` + `ToneButton variant="secondary"` (LLM infer)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `GlassCard` | `TakeoverCard` |
| `PageHeader` | Shell header |
| `SectionHeading` | `SectionHeader` |
| `Badge` | `Chip` |
| `EmptyState` | `EmptyBlock` |
| `Input` (search) | `ToneInput` |
| `Button` | `ToneButton` |
| `CatalogCardFigure` (inline component in `CatalogList.tsx`) | `TitleIcon` + card layout in `TakeoverCard` |
| `.kaapi-content-surface-2` refs (if any) | `TakeoverCard` surface |

**Definition of Done:**
- [ ] Shell B; catalog cards via `TakeoverCard` grid + `TitleIcon` + `RoastChip`
- [ ] Search field uses `ToneInput`; no `Input` import; no `GlassCard`
- [ ] `CatalogCardFigure` inline component retired; replaced by shared `TitleIcon`
- [ ] `AddBeanModal` migrated to `FormSection`/`ToneInput`/`ToneButton`
- [ ] LLM infer CTA in AddBeanModal uses `ToneButton`
- [ ] Tone toggle works; empty state via `EmptyBlock`; mobile verified

---

### P-09 · Catalog Detail ★ ANCHOR (`frontend/src/pages/CatalogDetail.tsx`)

**Shell:** A — `TonePageWrapper` + `TakeoverCard` + `bg-catalog` + `BackLink` + `ToneToggle`

**Status:** APPROVED PROTOTYPE — scoped v5 refinements only. Reference baseline for Shell A alongside BrewLogDetail.

**Shared primitives/composed components (already in use or post-v5):**
- `TonePageWrapper` (scoping change), `TakeoverCard`, `TitleBlock` + `TitleIcon`
- `RoastChip`, `ChipBar` (bag status chips)
- `DataTable` + `TableRow` (bag list, recent shots)
- `FormSection` + `ToneInput` + `ToneSelect` (edit metadata form, add-bag form)
- `ToneButton variant="edit"`, `ToneButton variant="primary"` (Add bag, Replace image)
- `ActionBar` (edit / image-upload CTAs)

**v5 one-offs to retire:**
| One-off | v5 Action |
|---------|-----------|
| `roastChipClass` util | Replace with `<RoastChip>` |
| Local `[tone, setTone]` state | Remove; read tone from `TonePageWrapper`'s context (global) |
| `FormField` / `Input` / `Select` (DaisyUI) | Replace with `ToneInput` / `ToneSelect` in edit and add-bag forms |
| Inline `style={{ }}` per v5 audit | Replace with semantic CSS classes |
| `.kk-b-page` scope | Promote to `[data-tone]` |

**Definition of Done:**
- [ ] Local `[tone, setTone]` state removed; tone read from global `TonePageWrapper` context
- [ ] `roastChipClass` → `<RoastChip>`; no inline chip styling
- [ ] Edit form and add-bag form use `FormSection`/`ToneInput`/`ToneSelect`; no `FormField`/`Input`/`Select`
- [ ] Zero inline `style={{ }}` setting token-covered properties
- [ ] `[data-tone]` drives tone toggle; visual parity with BrewLogDetail verified
- [ ] Playwright northstar screenshot captured (both tones); this + P-07 form the Shell A regression baseline

---

### P-10 · Hardware Page (`frontend/src/pages/HardwarePage.tsx`)

**Shell:** B (list mode) → split in Phase 8: `HardwareList.tsx` (Shell B) + `HardwareDetail.tsx` (Shell A)

**Background:** `bg-hardware`

**Shell B — HardwareList (post-split):**
- `TonePageWrapper`, `TakeoverCard variant="list"`, `TitleBlock`
- `DataTable` + `TableRow` or card grid (per hardware item)
- `TitleIcon` (hardware image or category icon fallback)
- `Chip` (hardware category: Machine / Grinder / Basket / Storage)
- `ToneButton variant="primary"` (Add hardware → `AddHardwareModal`)
- `EmptyBlock` (no hardware)

**Shell A — HardwareDetail (new file, post-split):**
- `TonePageWrapper`, `TakeoverCard`, `TitleBlock` + `TitleIcon`
- `ParamGrid` + `ParamPair` (hardware specs: name, category, added date)
- `DataTable` + `TableRow` (maintenance history)
- `ActionBar` + `ToneButton variant="edit"` (Edit hardware, Log maintenance, Upload image)
- `SectionHeader` (Maintenance History section)

**Modals to migrate (AddHardwareModal, EditHardwareModal, LogMaintenanceModal):**
- All three: `FormSection` + `ToneInput`/`ToneSelect` + `ToneButton`

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `GlassCard` | `TakeoverCard` |
| `PageHeader` | Shell header |
| `SectionHeading` | `SectionHeader` |
| `Badge` | `Chip` |
| `EmptyState` | `EmptyBlock` |
| `LayerTransition` | Shell transition |
| Inline `HardwareIcon()` function (SVG per category) | `TitleIcon` with icon-category prop, or shared `HardwareCategoryIcon` component |
| `Button` | `ToneButton` |
| Per-section inline heading patterns | `SectionHeader` |

**Definition of Done:**
- [ ] `HardwarePage.tsx` split into `HardwareList.tsx` (Shell B) + `HardwareDetail.tsx` (Shell A)
- [ ] In-page list/detail state machine removed; detail is a real route (or modal-based — confirm with operator)
- [ ] `HardwareIcon` inline function extracted to shared icon component
- [ ] All three modals migrated to `FormSection`/`ToneInput`/`ToneButton`
- [ ] No `GlassCard`; no `PageHeader`; no `SectionHeading`; no `Badge`
- [ ] Tone toggle works on both list and detail views; mobile verified

---

### P-11 · Profile (`frontend/src/pages/Profile.tsx`)

**Shell:** D — `TonePageWrapper` + `TakeoverCard` + `bg-profile`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard`, `TitleBlock` (user display name + email)
- `TitleIcon` (monogram fallback — replaces inline `monogramFor()` call)
- `SectionHeader` (Households, Account sections)
- `DataTable` + `TableRow` (household membership list rows) or card-based list
- `ChipBar` + `Chip` (membership role per household)
- `ToneButton variant="secondary"` (Switch household, Manage)
- `ToneButton variant="danger"` (Sign out)
- `ToneLink` (→ /household/settings for admin)
- `ParamPair` (admin reset-password informational copy — static, no form yet; Gap #1)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `GlassCard` | `TakeoverCard` |
| `PageHeader` | Shell header |
| `Badge` (role) | `Chip variant="role"` |
| `Button` | `ToneButton` |
| `HouseholdRow` sub-component (inline) | `TableRow` within `DataTable` |
| Inline `monogramFor()` → just a util | `TitleIcon` with fallback monogram prop |

**Definition of Done:**
- [ ] Shell D; user header via `TitleBlock` + `TitleIcon`
- [ ] Household list via `DataTable`/`TableRow`; role via `Chip`
- [ ] Sign-out uses `ToneButton variant="danger"`; switch uses `ToneButton variant="secondary"`
- [ ] No `GlassCard`; no `Badge`; no `Button` (DaisyUI)
- [ ] Admin reset-password copy rendered as `ParamPair` or `ToneText` (no form — Gap #1 still open)
- [ ] Tone toggle works; mobile verified

---

### P-12 · Household Settings (`frontend/src/pages/HouseholdSettings.tsx`)

**Shell:** D — `TonePageWrapper` + `TakeoverCard` (multi-section) + `bg-household-settings`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard`, `TitleBlock` (household name)
- Four `.kk-tc-section` blocks: Members, Invitations, Guest Access, Danger Zone
- `SectionHeader` × 4
- `DataTable` + `TableRow` (members list, invitations list)
- `FormSection` + `ToneInput` (rename form, create-invite form)
- `ToneSelect` (member role dropdown, invite role dropdown)
- `ToneButton variant="edit"` (rename save, resend)
- `ToneButton variant="danger"` (remove member, revoke invitation, revoke guest link, delete household)
- `ToneButton variant="primary"` (create invitation, generate guest link)
- `Chip` (member role badge, invitation status)
- `ActionBar` (per-row: copy / resend / revoke actions in invitations table)
- `AccessibleDialog` (delete household confirmation — stays shared)
- `TitleIcon` with monogram (per member row)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `PageHeader` | Shell header |
| `Badge` | `Chip` |
| `Button` (all content-area instances) | `ToneButton` |
| `Input` | `ToneInput` |
| `Select` | `ToneSelect` |
| `FormField` | `FormSection` |
| Inline `monogramFor()` | `TitleIcon` fallback prop |
| Inline `formatDate()` | Date formatting util (stays a util; not a component concern) |
| Inline `apiErrorMessage()` | Error display in `FormSection` / `ToneText variant="error"` |
| DaisyUI `btn` classes in content | `ToneButton` |

**Definition of Done:**
- [ ] Shell D; four sections each as `.kk-tc-section` with `SectionHeader`
- [ ] Members list and invitations list via `DataTable`/`TableRow` + `ActionBar` per row
- [ ] Rename form and invite-create form via `FormSection`/`ToneInput`/`ToneSelect`
- [ ] All buttons in content area via `ToneButton`; zero DaisyUI `btn` classes in content
- [ ] No `GlassCard`; no `Badge`; no `Button`; no `Input`/`Select` (DaisyUI)
- [ ] Delete household dialog via `AccessibleDialog`; confirmation input via `ToneInput`
- [ ] Tone toggle works; all 13 household management actions (HH-02 through HH-13) remain functional; mobile verified

---

### P-13 · Household New (`frontend/src/pages/HouseholdNew.tsx`)

**Shell:** C — `TonePageWrapper` + `TakeoverCard variant="form" size="narrow"` + `bg-welcome`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard`, `TitleBlock`
- `FormSection` (household name)
- `ToneInput`
- `ToneButton variant="primary"` (Create)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `StandaloneHouseholdShell` | `TonePageWrapper` |
| `Button` | `ToneButton` |
| `Input` | `ToneInput` |
| `FormField` | `FormSection` |
| `LayerTransition` | Shell animation |

**Definition of Done:**
- [ ] Shell C; `StandaloneHouseholdShell` removed; form via `FormSection`/`ToneInput`
- [ ] Auth refresh after household creation unchanged (`POST /households` → `GET /auth/me`)
- [ ] Tone toggle works; mobile verified

---

### P-14 · Import Wizard (`frontend/src/pages/ImportWizard.tsx`)

**Shell:** C (dense form/wizard) — `TonePageWrapper` + `TakeoverCard variant="form"` + `bg-import`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard variant="form"`, `TitleBlock`
- `SectionHeader` as step labels (Step 1: Upload / Step 2: Preview / Step 3: Done)
- `FormSection` (file upload step, commit step)
- `ToneButton variant="primary"` (Upload, Commit rows)
- `ToneButton variant="secondary"` (Back / Reset)
- `DataTable` + `TableRow` (CSV preview with per-row validation)
- `Chip variant="error"` (per-row validation error indicators)
- `Chip variant="type"` (row type: catalog vs brew-log)
- `ToneText` (field guidance descriptions — replaces `FIELD_GUIDANCE` table currently rendered as ad-hoc markup)
- `EmptyBlock` (no rows state)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `GlassCard` | `TakeoverCard` |
| `PageHeader` | Shell header |
| `Badge` | `Chip` |
| `Button` | `ToneButton` |
| `FormField` | `FormSection` |
| `STEP_LABELS` stepper (ad-hoc `const STEP_LABELS`) | `SectionHeader` × 3 steps |
| `FIELD_GUIDANCE` table (ad-hoc inline array rendered as UI) | `DataTable` / `ToneText` structured guidance |

**Note:** Gap #2 (FE bypasses BE import session) is NOT addressed here — this is a data-flow architectural gap, not a component system concern. The wizard's UI migration is purely visual/compositional.

**Definition of Done:**
- [ ] Shell C; three wizard steps each with `SectionHeader` step label
- [ ] CSV preview rendered via `DataTable`/`TableRow`; validation errors via `Chip variant="error"`
- [ ] No `GlassCard`; no `Badge`; no `Button` (DaisyUI); no `FormField`
- [ ] Field guidance uses `ToneText` or `EmptyBlock` structured prose — not ad-hoc markup
- [ ] Gap #2 behavior unchanged (FE direct-POST path is intact)
- [ ] Tone toggle works; mobile verified

---

### P-15 · Invite Accept (`frontend/src/pages/InviteAccept.tsx`)

**Shell:** D — `TonePageWrapper` + `TakeoverCard` + `bg-invite-recovery`

**Shared primitives/composed components required:**
- `TonePageWrapper`, `TakeoverCard`, `TitleBlock` (household name + inviter)
- `ParamPair` (role, expiry date)
- `ChipBar` + `Chip` (role chip)
- `ActionBar` + `ToneButton variant="primary"` (Accept) + `ToneButton variant="secondary"` (Decline)
- `EmptyBlock` (post-decline / loading states)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `StandaloneHouseholdShell` | `TonePageWrapper` |
| `Button` | `ToneButton` |
| `LayerTransition` | Shell animation |

**Definition of Done:**
- [ ] Shell D; invite preview card via `TakeoverCard`/`TitleBlock`/`ParamPair`
- [ ] Accept/decline via `ActionBar`/`ToneButton`
- [ ] Unauthenticated redirect flow (→ /login?invite=) unchanged
- [ ] No `StandaloneHouseholdShell`; tone toggle works; mobile verified

---

### P-16 · Invite Invalid (`frontend/src/pages/InviteInvalid.tsx`)

**Shell:** E — `TonePageWrapper tone="dark"` + `TakeoverCard variant="form" size="narrow"` + `bg-invite-recovery`

**Shared primitives/composed components required:**
- `TonePageWrapper tone="dark"`, `TakeoverCard`, `EmptyBlock` (icon + error message)
- `ToneButton` or `ToneLink` (→ /login, → /register)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `StandaloneHouseholdShell` | `TonePageWrapper` |
| `.kaapi-content-surface` CSS class (direct use) | `TakeoverCard` |
| DaisyUI `btn btn-primary btn-bevel` | `ToneButton variant="primary"` |
| DaisyUI `btn btn-outline btn-bevel` | `ToneButton variant="secondary"` |
| `LayerTransition` | Shell animation |
| Hardcoded `text-error` (DaisyUI semantic) | `Chip variant="error"` or `ToneText variant="error"` |

**Definition of Done:**
- [ ] Shell E; error state via `EmptyBlock`; navigation via `ToneButton`/`ToneLink`
- [ ] No `.kaapi-content-surface` CSS class; no DaisyUI `btn` classes
- [ ] No `StandaloneHouseholdShell`; tone toggle works (fixed dark per Shell E); mobile verified

---

### P-17 · Invite Expired (`frontend/src/pages/InviteExpired.tsx`)

**Shell:** E — identical pattern to P-16 (Invite Invalid)

**One-offs to retire:** Same as P-16 (assumed same structure based on surface-api-map §2.15)

**Definition of Done:** Same as P-16. Both pages should share identical markup structure — consider extracting a shared `InviteErrorPage` render helper if the markup is identical.

---

### P-18 · Guest View (`frontend/src/pages/HouseholdGuestView.tsx`)

**Shell:** B (read-only variant) — `TonePageWrapper` + `TakeoverCard variant="list"` + `bg-guest`

**Shared primitives/composed components required:**
- `TonePageWrapper` (tone: operator open question — see §5 Q4), `TakeoverCard variant="list"`, `TitleBlock` (household name + banner)
- `ParamGrid` + `ParamPair` (dashboard stats from aggregate response)
- `DataTable` + `TableRow` (brew log entries list — up to 25)
- `ChipBar` + `RoastChip` (active bags)
- `Chip` (bag status)
- `EmptyBlock` (empty sections)
- No write-affordance components (all `ToneButton` instances removed; read-only)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `StandaloneHouseholdShell` | `TonePageWrapper` |
| `StatGrid` (inline component) | `ParamGrid` + `ParamPair` |
| `Badge` | `Chip` |
| Any hardcoded color refs | `--kk-tc-*` semantic classes |

**Definition of Done:**
- [ ] Shell B (read-only); stats via `ParamGrid`; brew list via `DataTable`; active bags via `ChipBar`+`RoastChip`
- [ ] No `StandaloneHouseholdShell`; `StatGrid` inline component retired → `ParamGrid`
- [ ] No write affordances (no `ToneButton` pointing to mutation endpoints)
- [ ] Tone toggle behavior confirmed per operator answer to Q4 (§5)
- [ ] Mobile verified

---

### P-19 · NotFound (`frontend/src/pages/NotFound.tsx`)

**Shell:** E — `TonePageWrapper tone="dark"` + `TakeoverCard variant="form" size="narrow"` + `bg-state-error`

**Shared primitives/composed components required:**
- `TonePageWrapper tone="dark"`, `TakeoverCard`, `EmptyBlock` (404 code + title + body)
- `ToneLink to="/"` or `ToneButton variant="secondary"` (Go home)

**Current one-offs to retire:**
| One-off | Replace With |
|---------|--------------|
| `.kaapi-content-surface` CSS class (direct use in JSX) | `TakeoverCard` |
| DaisyUI `btn btn-primary btn-bevel` on `<Link>` | `ToneButton` or `ToneLink` |
| `LayerTransition` (wrapping the content) | Shell animation |
| Inline flexbox centering on `<div>` wrapper | `TonePageWrapper` layout behavior |

**Definition of Done:**
- [ ] Shell E; 404 content via `EmptyBlock`; home navigation via `ToneLink`/`ToneButton`
- [ ] No `.kaapi-content-surface`; no DaisyUI `btn` classes; no `LayerTransition`
- [ ] Tone toggle works (fixed dark); mobile verified

---

## §2 Per-Endpoint/Method Coverage

> **How to read:** Each endpoint row shows its consuming UI surface(s), the shared component(s) that will own the affordance post-migration, a flag for current one-off status, and a gap/orphan flag. Endpoints with **no FE consumer** (not by design) are flagged ⚠️ORPHAN. Endpoints with no FE consumer **by design** (infra, browser assets) are marked 🔧INFRA.
>
> **"One-off" column:** `YES` = the current FE affordance is a page-local one-off (one of Maya's 10 categories). `POST-MIGRATION` = will be owned by a named shared component. `—` = no UI component (infra/browser layer).

---

### Auth Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 1 | GET | `/livez` | None (ops probe) | — | — | 🔧INFRA |
| 2 | GET | `/readyz` | None (ops probe) | — | — | 🔧INFRA |
| 3 | GET | `/health` | None (Cloud Run startup) | — | — | 🔧INFRA |
| 4 | GET | `/manifest.webmanifest` | Browser (PWA) | — | — | 🔧INFRA |
| 5 | GET | `/sw.js` | Browser (service worker) | — | — | 🔧INFRA |
| 6 | GET | `/auth/google` | Login.tsx — Google OAuth button (browser redirect) | `ToneButton variant="secondary"` in Shell C | YES | — |
| 7 | GET | `/auth/callback` | Browser OAuth redirect — no component | — | — | — |
| 8 | GET | `/auth/google/callback` | Browser OAuth redirect — no component | — | — | — |
| 9 | GET | `/auth/logout` | Not called from FE (legacy redirect to /auth/login) | — | — | ⚠️ORPHAN (legacy; Gap cleanup) |
| 10 | GET | `/auth/login` | Not called from FE (legacy redirect to /auth/google) | — | — | ⚠️ORPHAN (legacy; Gap cleanup) |
| 11 | POST | `/auth/register` | Register.tsx — registration form submit | `FormSection` + `ToneButton variant="primary"` in Shell C | YES | — |
| 12 | POST | `/auth/login` | Login.tsx — username/password login submit | `FormSection` + `ToneButton variant="primary"` in Shell C | YES | — |
| 13 | POST | `/auth/refresh` | AuthContext.tsx — automatic on every page load / 401 | Infrastructure — not a rendered component | NO (infra) | — |
| 14 | POST | `/auth/logout` | Profile.tsx — sign-out button | `ToneButton variant="danger"` in Shell D | YES | — |
| 15 | GET | `/auth/me` | AuthContext.tsx + HouseholdNew.tsx + InviteAccept.tsx + HouseholdSettings.tsx — post-action refresh | Infrastructure + page lifecycle (not a standalone component) | NO (infra + multi-page) | — |
| 16 | POST | `/auth/switch-household` | Profile.tsx — switch household button | `ToneButton variant="secondary"` + `ActionBar` in Shell D | YES | — |
| 17 | POST | `/auth/admin/reset-password` | **No FE surface** — Profile.tsx shows static copy only (Gap #1) | Will be: `FormSection` + `ToneButton variant="danger"` in Shell D — when Gap #1 is addressed | — | ⚠️ORPHAN Gap #1 |

---

### Household Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 18 | POST | `/households` | Welcome.tsx (create step) + HouseholdNew.tsx | `FormSection` + `ToneButton variant="primary"` in Shell C | YES | — |
| 19 | GET | `/households/me` | **Dead FE code** — `listHouseholds()` exists in `households.ts` but no page imports it (Gap #9) | — | — | ⚠️ORPHAN Gap #9 |
| 20 | POST | `/households/invitations` | HouseholdSettings.tsx — create invitation form | `FormSection` + `ToneInput` + `ToneButton` in Shell D | YES | — |
| 21 | GET | `/households/invitations/{token}` | InviteAccept.tsx — load invitation preview on mount | `TakeoverCard` + `ParamPair` in Shell D | YES | — |
| 22 | POST | `/households/invitations/{token}/accept` | InviteAccept.tsx — accept button | `ToneButton variant="primary"` in `ActionBar`, Shell D | YES | — |
| 23 | POST | `/households/invitations/{token}/decline` | InviteAccept.tsx — decline button (intentional no-op BE — by design) | `ToneButton variant="secondary"` in `ActionBar`, Shell D | YES | — |
| 24 | DELETE | `/households/invitations/{invitation_id}` | HouseholdSettings.tsx — revoke invitation action | `ToneButton variant="danger"` in `ActionBar`/`DataTable`, Shell D | YES | — |
| 25 | POST | `/households/invitations/{invitation_id}/resend` | HouseholdSettings.tsx — resend invitation action | `ToneButton variant="edit"` in `ActionBar`/`DataTable`, Shell D | YES | — |
| 26 | DELETE | `/households/members/{user_id}` | HouseholdSettings.tsx — remove member action | `ToneButton variant="danger"` in `DataTable` row, Shell D | YES | — |
| 27 | PATCH | `/households/members/{user_id}` | HouseholdSettings.tsx — update member role selector | `ToneSelect` in `DataTable` row, Shell D | YES | — |
| 28 | POST | `/households/{household_id}/guest-token` | HouseholdSettings.tsx — generate guest link | `ToneButton variant="primary"` in Guest Access section, Shell D | YES | — |
| 29 | DELETE | `/households/{household_id}/guest-token` | HouseholdSettings.tsx — revoke guest link | `ToneButton variant="danger"` in Guest Access section, Shell D | YES | — |
| 30 | GET | `/households/{household_id}` | HouseholdSettings.tsx — page load (household detail, members, invitations) | `TakeoverCard` + `DataTable` in Shell D | YES | — |
| 31 | PATCH | `/households/{household_id}` | HouseholdSettings.tsx — rename household form submit | `FormSection` + `ToneInput` + `ToneButton`, Shell D | YES | — |
| 32 | DELETE | `/households/{household_id}` | HouseholdSettings.tsx — delete household (with name confirm) | `AccessibleDialog` + `ToneInput` + `ToneButton variant="danger"`, Shell D | YES | — |

---

### Guest Endpoint

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 33 | GET | `/api/guest/households/{household_id}/view` | HouseholdGuestView.tsx — full household snapshot load | `TonePageWrapper` + `ParamGrid` + `DataTable` + `ChipBar`, Shell B | YES | — |

---

### Dashboard Endpoint

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 34 | GET | `/api/dashboard` | Dashboard.tsx — active bags load | `TakeoverCard` + `ParamGrid` + `ChipBar`, Shell B | YES | — |

---

### Catalog Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 35 | GET | `/api/catalog` | CatalogList.tsx — catalog list load | `TakeoverCard` card grid + `TitleIcon` + `RoastChip`, Shell B | YES | — |
| 36 | GET | `/api/catalog/{catalog_id}` | CatalogDetail.tsx — detail page load | `TakeoverCard` + `TitleBlock` + `DataTable`, Shell A ★ | YES (minor v5) | — |
| 37 | POST | `/api/catalog` | AddBeanModal (via CatalogList) + ImportWizard.tsx | `FormSection` + `ToneInput` + `ToneButton` in modal / Shell C | YES | — |
| 38 | PUT | `/api/catalog/{catalog_id}` | CatalogDetail.tsx — edit metadata form submit | `FormSection` + `ToneInput`/`ToneSelect`, Shell A ★ | YES (v5) | — |
| 39 | POST | `/api/catalog/infer` | AddBeanModal — LLM infer CTA | `ToneButton variant="secondary"` (Infer from URL) in `FormSection` | YES | — |
| 40 | POST | `/api/catalog/{catalog_id}/inventory` | CatalogDetail.tsx — add bag form submit | `FormSection` + `ToneInput`/`ToneSelect`, Shell A ★ | YES (v5) | — |
| 41 | POST | `/api/catalog/{catalog_id}/image` | CatalogDetail.tsx — image upload affordance | `ToneButton` + native `<input type="file">` (file input is not in tone system — retain native) | YES (v5) | — |

---

### Hardware Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 42 | GET | `/api/hardware/action-types` | LogMaintenanceModal (lazy — loaded when modal opens) | `ToneSelect` options in `FormSection`, Shell B/A modal | YES | — |
| 43 | GET | `/api/hardware` | HardwarePage.tsx (list) + BrewLogAdd.tsx (hardware picker) | `DataTable`/card grid Shell B; `ToneSelect` in Shell C | YES | — |
| 44 | GET | `/api/hardware/{hardware_id}` | HardwarePage.tsx (in-page detail) → post-split: HardwareDetail.tsx | `TakeoverCard` + `ParamGrid`, Shell A (post-split) | YES | — |
| 45 | POST | `/api/hardware` | AddHardwareModal (from HardwarePage) | `FormSection` + `ToneInput` + `ToneButton`, Shell B modal | YES | — |
| 46 | PUT | `/api/hardware/{hardware_id}` | EditHardwareModal (from HardwarePage) | `FormSection` + `ToneInput` + `ToneButton`, Shell B modal | YES | — |
| 47 | POST | `/api/hardware/{hardware_id}/image` | HardwarePage.tsx — upload hardware image | `ToneButton` + native `<input type="file">`, Shell A (post-split) | YES | — |

---

### Brew Log Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 48 | GET | `/api/brew-log` | BrewLogList.tsx (paginated list) + Dashboard.tsx (recent shots, top 5) | `DataTable` + `TableRow`, Shells B | YES | — |
| 49 | GET | `/api/brew-log/{shot_id}/feedback` | BrewLogDetail.tsx — AI feedback section | `MarkdownSection` + `Markdown`, Shell A ★ | YES (v5) | — |
| 50 | GET | `/api/brew-log/{shot_id}` | BrewLogDetail.tsx — shot detail load | `TakeoverCard` + `TitleBlock` + `ParamGrid`, Shell A ★ | YES (v5) | — |
| 51 | PATCH | `/api/brew-log/{shot_id}` | BrewLogDetail.tsx — correction form submit | `FormSection` + `ToneInput`/`ToneSelect`/`ToneTextarea`, Shell A ★ | YES (v5) | — |
| 52 | POST | `/api/brew-log/{shot_id}/feedback` | BrewLogDetail.tsx — on-demand AI regenerate | `ToneButton variant="primary"` in `ActionBar`, Shell A ★ | YES (v5) | — |
| 53 | POST | `/api/brew-log` | BrewLogAdd.tsx (new shot form) + ImportWizard.tsx (per-row submit) | `FormSection` + `ToneButton`, Shell C | YES | — |
| 54 | DELETE | `/api/brew-log/{shot_id}` | BrewLogDetail.tsx — admin delete (with dialog confirm) | `AccessibleDialog` + `ToneButton variant="danger"`, Shell A ★ | YES (v5) | — |

---

### Inventory Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 55 | GET | `/api/inventory` | BrewLogAdd.tsx — active inventory load (bag picker) | `ToneSelect` / card picker within `FormSection`, Shell C | YES | — |
| 56 | GET | `/api/inventory/{bag_id}` | **Dead FE code** — `getInventoryBag()` in `inventory.ts` but no page calls it (Gap #4) | — | — | ⚠️ORPHAN Gap #4 |
| 57 | PATCH | `/api/inventory/{bag_id}` | CatalogDetail.tsx — mark bag finished / reactivate | `ToneButton` in `ActionBar` within `DataTable` row, Shell A ★ | YES (v5) | — |

---

### Maintenance Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 58 | GET | `/api/maintenance` | **No FE page consumer** — `listMaintenance()` in `maintenance.ts` unused (Gap #5) | — | — | ⚠️ORPHAN Gap #5 |
| 59 | POST | `/api/maintenance` | LogMaintenanceModal (from HardwarePage) | `FormSection` + `ToneSelect` + `ToneButton`, Shell B modal | YES | — |

---

### Defaults Endpoints

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 60 | GET | `/api/defaults/{bag_id}` | BrewLogAdd.tsx — smart pre-fill (form pre-population, not a rendered component) | Data layer (form pre-population in `FormSection` via React Query) — no standalone component | NO (infra) | — |
| 61 | GET | `/api/defaults` | **Dead from FE** (query-param legacy variant — Gap #10) | — | — | ⚠️ORPHAN Gap #10 (legacy) |

---

### Import Endpoint

| # | Method | Path | Consuming Surface(s) | Post-Migration Owner | One-off Now? | Flag |
|---|--------|------|---------------------|---------------------|--------------|------|
| 62 | GET | `/import` | **BE session infra unused by FE** — ImportWizard.tsx never calls it (Gap #2) | — | — | ⚠️ORPHAN Gap #2 |

---

### Orphaned/Gap Summary

| Gap | Endpoint(s) | Nature | Component-System Impact |
|-----|------------|--------|------------------------|
| Gap #1 | POST /auth/admin/reset-password | No FE form wired | Primitives available (FormSection + ToneButton) — blocked on product decision to build the UI |
| Gap #2 | GET /import | BE session infra never called | No component impact; data-flow gap is a separate workstream |
| Gap #4 | GET /api/inventory/{bag_id} | Dead FE client code | Cleanup in Phase 10; component system provides `TakeoverCard` when a bag-detail page is built |
| Gap #5 | GET /api/maintenance | No page consumer | Cleanup in Phase 10; `DataTable` + Shell B ready when a maintenance-log page is built |
| Gap #9 | GET /households/me | Dead FE client code | Cleanup in Phase 10 |
| Gap #10 | GET /api/defaults (legacy) | Dead from FE | Cleanup in Phase 10 |
| Legacy | GET /auth/logout, GET /auth/login | Legacy redirects (non-JSON) | No component; cleanup candidates in Phase 10 |

**Count of FE-served endpoints (post-migration, all shared):** 49  
**Infra/browser-only (no component):** 7  
**Orphaned (gap / dead code / legacy):** 6 + 2 legacy redirects = 8  
**Total:** 49 + 7 + 8 = 64 rows — note: 62 registered endpoints + the 2 legacy redirect entries in §3a that overlap with "Auth" routing = aligns to 62.

---

## §3 Coverage Matrices

### 3a · Page × Shared Component Matrix

> ✓ = page uses the component post-migration. ★ = v5 refinement only (already partially compliant).

| Page | TonePageWrapper | TakeoverCard | TitleBlock | TitleIcon | ParamGrid | ActionBar | ChipBar | DataTable | FormSection | ToneInput | ToneSelect | ToneTextarea | ToneButton | ToneLink | RoastChip | Chip | SectionHeader | MarkdownSection | EmptyBlock |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Login** | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | — | — | ✓ | ✓ | — | — | — | — | — |
| **Register** | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | — | — | ✓ | ✓ | — | — | — | — | — |
| **Welcome** | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | — | — | ✓ | — | — | — | — | — | ✓ |
| **Dashboard** | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | — | — | — | ✓ | — | ✓ | ✓ | ✓ | — | ✓ |
| **BrewLogList** | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | — | — | — | — | ✓ | — | ✓ | ✓ | — | — | ✓ |
| **BrewLogAdd** | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | — | ✓ |
| **BrewLogDetail ★** | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | — |
| **CatalogList** | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | — | ✓ | — | — | ✓ | — | ✓ | ✓ | — | — | ✓ |
| **CatalogDetail ★** | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | — | — |
| **HardwarePage → List** | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | — | — | — | — | ✓ | — | — | ✓ | — | — | ✓ |
| **HardwareDetail (new)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | ✓ | — | — | ✓ | ✓ | — | — |
| **Profile** | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | — | — | — | — | ✓ | ✓ | — | ✓ | ✓ | — | — |
| **HouseholdSettings** | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | ✓ | ✓ | — | — |
| **HouseholdNew** | ✓ | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | — | — | ✓ | — | — | — | — | — | — |
| **ImportWizard** | ✓ | ✓ | ✓ | — | — | — | — | ✓ | ✓ | — | — | — | ✓ | — | — | ✓ | ✓ | — | ✓ |
| **InviteAccept** | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | — | — | — | — | — | ✓ | — | — | ✓ | — | — | ✓ |
| **InviteInvalid** | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | ✓ | ✓ | — | — | — | — | ✓ |
| **InviteExpired** | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | ✓ | ✓ | — | — | — | — | ✓ |
| **GuestView** | ✓ | ✓ | ✓ | — | ✓ | — | ✓ | ✓ | — | — | — | — | — | — | ✓ | ✓ | ✓ | — | ✓ |
| **NotFound** | ✓ | ✓ | — | — | — | — | — | — | — | — | — | — | — | ✓ | — | — | — | — | ✓ |

**Coverage count per component (pages that use it):**
- `TonePageWrapper`: 20/20 pages (100%) — universal
- `TakeoverCard`: 20/20 pages (100%) — universal
- `ToneButton`: 18/20 (GuestView is read-only; NotFound minimal)
- `FormSection`: 9/20 — all form/wizard + settings pages
- `DataTable`: 11/20 — all list + settings + import pages
- `RoastChip`: 7/20 — brew-log, catalog, dashboard, guest view surfaces
- `EmptyBlock`: 13/20 — broad empty-state coverage
- `MarkdownSection`: 1/20 — BrewLogDetail only (AI feedback)

---

### 3b · Endpoint × Consuming Surface Matrix

> Condensed validation view. For the full per-endpoint detail see §2. This matrix is the "no orphaned component" enforcement gate: every ✓ in the "Shared Component Owner" column means the endpoint is provably consumed by a named shared component, not a one-off.

| Endpoint Group | Endpoint Count | FE-Consumed Endpoints | Shared Component Owner (post-migration) | ⚠️ Orphaned |
|----------------|:-:|:-:|---|:-:|
| Auth — JSON API | 7 | 6 | `FormSection`/`ToneButton`/`ToneButton variant="danger"` (Login, Register, Profile) + AuthContext infra | 1 (Gap #1: reset-password) |
| Auth — Google OAuth | 3 | 1 (browser redirect) | `ToneButton variant="secondary"` (Login page) | 0 |
| Auth — Legacy redirects | 2 | 0 | — | 2 (legacy cleanup) |
| Households | 15 | 14 | `FormSection`/`DataTable`/`ActionBar`/`ToneButton`/`AccessibleDialog` (HouseholdSettings, Welcome, HouseholdNew, InviteAccept) | 1 (Gap #9: /households/me dead) |
| Guest | 1 | 1 | `ParamGrid`/`DataTable`/`ChipBar` (GuestView) | 0 |
| Dashboard | 1 | 1 | `TakeoverCard`/`ParamGrid` (Dashboard) | 0 |
| Catalog | 7 | 7 | `TakeoverCard`/`FormSection`/`ToneButton`/`TitleIcon` (CatalogList, CatalogDetail, AddBeanModal, ImportWizard) | 0 |
| Hardware | 6 | 6 | `DataTable`/`FormSection`/`ToneButton`/`ParamGrid` (HardwarePage, modals) | 0 |
| Brew Log | 7 | 7 | `TakeoverCard`/`ParamGrid`/`MarkdownSection`/`FormSection`/`ActionBar` (BrewLogDetail, BrewLogList, BrewLogAdd, Dashboard, ImportWizard) | 0 |
| Inventory | 3 | 2 | `ToneSelect` (BrewLogAdd bag picker) + `ToneButton`/`ActionBar` (CatalogDetail mark-finished) | 1 (Gap #4: bag detail dead) |
| Maintenance | 2 | 1 | `FormSection`/`ToneSelect` (LogMaintenanceModal) | 1 (Gap #5: list endpoint dead) |
| Defaults | 2 | 1 | Data layer / form pre-population in `FormSection` (BrewLogAdd) | 1 (Gap #10: legacy query-param) |
| Import | 1 | 0 | — | 1 (Gap #2: BE session infra) |
| Infra/Browser | 7 | 0 (by design) | — | 0 |
| **TOTAL** | **62** | **47 with FE components** | **All 47 → named shared component post-migration** | **8 orphaned/legacy** |

**"No orphaned component" guarantee:** After Phase 10 is complete, every FE-consumed endpoint (47 of 62) is owned by a component exported from `frontend/src/components/tone-system/index.ts`. The 8 orphaned endpoints are either infra-level gaps (tracked separately as Gaps #1–#10) or dead code candidates for Phase 10 cleanup. The 7 infra/browser-only endpoints require no UI component by design.

---

## §4 Dependency-Ordered Sequencing

### 4.1 Phase Dependency Graph

```
Phase 0 (Token Promotion)
    └── Phase 1 (Component Library)
            ├── Phase 2a (Anchor v5 Refinements) ─────────────────────────── baseline screenshots
            ├── Phase 2b (Static/Error Pages) ─────────────────────────────── (parallel with 2a)
            ├── Phase 3 (Form Pages: Login / Register / Welcome / HouseholdNew)
            │       └── Phase 6 (Settings: Profile / HouseholdSettings / InviteAccept)
            │                   (StandaloneHouseholdShell can be deprecated after Phase 6)
            ├── Phase 4 (List Pages: BrewLogList / CatalogList)
            │       ├── Phase 5 (Dense Forms: BrewLogAdd / ImportWizard)
            │       ├── Phase 7 (Dashboard) ── requires all composed components stable
            │       ├── Phase 8 (HardwarePage split)
            │       └── Phase 9 (Guest View)
            └── Phase 10 (Cleanup: remove legacy CSS/components/utils)
                        (requires ALL above phases complete)
```

**Cross-page primitive dependencies (must land before dependent pages can ship):**
- `DataTable`/`TableRow` in Phase 1 → blocks BrewLogList, CatalogList, Dashboard, HouseholdSettings, ImportWizard, HardwarePage, GuestView
- `FormSection`/`ToneInput`/`ToneSelect` in Phase 1 → blocks Login, Register, Welcome, BrewLogAdd, HouseholdSettings, ImportWizard, InviteAccept
- `TonePageWrapper` in Phase 1 → blocks ALL pages
- `TakeoverCard` generalization in Phase 1 → blocks ALL pages
- `RoastChip` in Phase 1 → blocks BrewLogDetail v5, CatalogDetail v5, BrewLogList, CatalogList, Dashboard, GuestView
- `MarkdownSection`/`Markdown` in Phase 1 → blocks BrewLogDetail v5 only

### 4.2 PR / Checkpoint Breakdown

| PR | Phase(s) | Title | Pages Changed | Key Gate |
|----|---------|-------|--------------|----------|
| **PR 1** | 0 | Token Promotion | 0 pages (CSS only) | No visual diff on any page; deprecation console.warn added |
| **PR 2** | 1 | Shared Component Library | 0 pages (new components only) | All shared components exported from barrel; unit tests pass |
| **PR 3** | 2a + 2b | Anchor v5 Refinements + Static Pages | BrewLogDetail, CatalogDetail, NotFound, InviteInvalid, InviteExpired | Playwright northstar screenshots captured; anchors verified on both tones |
| **PR 4** | 3 | Auth/Form Pages | Login, Register, Welcome, HouseholdNew | `StandaloneHouseholdShell` import count drops to 0 (partially — InviteAccept/GuestView still use it) |
| **PR 5** | 4 | List Pages | BrewLogList, CatalogList (+ AddBeanModal) | `GlassCard` import count drops significantly; `PageHeader` import count drops |
| **PR 6** | 5 | Dense Form Pages | BrewLogAdd, ImportWizard | DaisyUI `input`/`select`/`textarea` in content areas → 0 |
| **PR 7** | 6 | Settings/Admin Pages | Profile, HouseholdSettings, InviteAccept | `StandaloneHouseholdShell` import count → 0; `Badge` import count → 0 |
| **PR 8** | 7 | Dashboard | Dashboard | All composed components stable; most complex visual; HeroVisualFrame exempt confirmed |
| **PR 9** | 8 | Hardware Page (split + modals) | HardwarePage split → HardwareList + HardwareDetail; AddHardwareModal, EditHardwareModal, LogMaintenanceModal | `GlassCard` import count → 0 |
| **PR 10** | 9 | Guest View | HouseholdGuestView | `StandaloneHouseholdShell` truly → 0 (last consumer) |
| **PR 11** | 10 | Cleanup + Deprecation | 0 new pages; remove legacy CSS/components/utils | `GlassCard`, `PageHeader`, `SectionHeading`, `EmptyState`, `Badge`, `StandaloneHouseholdShell`, `.glass-card`, `.kaapi-content-surface`, `.kk-proto-043`, `roastChipClass`, `eligibilityBadgeTone` all removed; ESLint rule promoted from stub to enforced; CI gate added |

**Total: 11 PRs.** PRs 3 (2a and 2b) are parallel-eligible; all others are serial per the dependency graph.

### 4.3 Checkpoint Verification Queries

After each PR merges, run these mechanical checks before opening the next PR:

```bash
# After PR 3: anchor screenshots captured
# After PR 4: StandaloneHouseholdShell count dropping
grep -r "StandaloneHouseholdShell" frontend/src/pages/ | wc -l
# Expected: ≤2 after PR 4 (InviteAccept + GuestView still pending)

# After PR 5: GlassCard in pages dropping
grep -r "GlassCard" frontend/src/pages/ | wc -l

# After PR 7: StandaloneHouseholdShell fully removed from pages
grep -r "StandaloneHouseholdShell" frontend/src/ | wc -l
# Expected: 0 (only one FE consumer left: GuestView, covered in PR 10)

# After PR 9: GlassCard count → 0 in pages
grep -r "GlassCard" frontend/src/pages/ | wc -l
# Expected: 0

# After PR 11: legacy class audit (should return 0 matches)
grep -r "glass-card\|kaapi-content-surface\|kk-proto-043" frontend/src/ | wc -l
grep -r "from.*GlassCard\|from.*PageHeader\|from.*SectionHeading\|from.*EmptyState\|from.*Badge" frontend/src/pages/ | wc -l
grep -r "roastChipClass\|eligibilityBadgeTone" frontend/src/ | wc -l
```

### 4.4 Suggested PR Naming Convention

```
[P0] chore: promote kk-tc tokens to data-tone scope; deprecate glass-card/kaapi-content-surface
[P1] feat(ui): add tone-system shared component library (primitives + composed)
[P2] refactor(pages): brew-log-detail + catalog-detail v5 refinements; retire static-page one-offs
[P3] refactor(pages): auth + form pages → Shell C (Login, Register, Welcome, HouseholdNew)
[P4] refactor(pages): list pages → Shell B (BrewLogList, CatalogList, AddBeanModal)
[P5] refactor(pages): dense form pages → Shell C (BrewLogAdd, ImportWizard)
[P6] refactor(pages): settings/admin pages → Shell D (Profile, HouseholdSettings, InviteAccept)
[P7] refactor(pages): dashboard → Shell B (custom; HeroVisualFrame exempt)
[P8] refactor(pages): hardware page → Shell B+A split (HardwareList, HardwareDetail, modals)
[P9] refactor(pages): guest view → Shell B read-only
[P10] chore: remove all legacy CSS/components/utils; enforce ESLint tone-system rules
```

---

## §5 Ship-Safe / Operability Notes

### 5.1 No Half-Migration State

**Rule:** A page ships fully migrated or not at all. If a PR starts migrating a page, it finishes it in the same PR. No PR may ship a page that uses BOTH old patterns (`.glass-card`, `.kaapi-content-surface`, `GlassCard`) AND new patterns (`TakeoverCard`, `--kk-tc-*`) simultaneously.

**Enforcement:** Each PR description includes a checklist of "legacy imports removed from these files." Reviewer blocks the PR if any old-pattern imports remain in a file that has new-pattern imports.

### 5.2 Token Promotion is Backward-Compatible

During the transition period (PR 1 through PR 10), both scoping mechanisms are valid simultaneously:
- `.kk-b-page .kk-takeover-card.kk-tc--dark { --kk-tc-text-primary: ... }` — **old scope, still works**
- `[data-tone="dark"] { --kk-tc-text-primary: ... }` — **new scope, also works**

Both resolve the same token values. Pages not yet migrated are unaffected. BrewLogDetail and CatalogDetail currently use the old scope — the PR 3 v5 refinements change only these two pages to use `[data-tone]`.

**Risk:** none — the token VALUES are unchanged; only the CSS selector changes.

### 5.3 `.glass-card` / `.kaapi-content-surface` Retirement Strategy

| Stage | Action | When |
|-------|--------|------|
| Phase 0 (PR 1) | Add `console.warn("⚠️ glass-card is deprecated — use TakeoverCard")` in dev mode to `GlassCard.tsx` and `.kaapi-content-surface` class | Before any page migration |
| Phase 1–9 | Legacy classes continue to work; pages migrated one-by-one | PR by PR |
| Phase 10 (PR 11) | Remove `.glass-card`, `.card-bevel`, `.kaapi-content-surface`, `--kaapi-content-*` from `index.css`; delete `GlassCard.tsx`, `StandaloneHouseholdShell.tsx`, `PageHeader.tsx`, `SectionHeading.tsx`, `EmptyState.tsx`, `Badge.tsx` (or tombstone them) | After all pages confirmed migrated |

**Verification before Phase 10 removal:** Run the grep-audit commands from §4.3. Only proceed if all counts are 0.

### 5.4 DaisyUI Retention During Transition

DaisyUI is **retained** in the following areas throughout (not migrated):
- Bottom navigation bar (app chrome)
- Desktop top nav (app chrome)
- Toast notifications (`<Toaster>` component)
- Modal chrome (outer `<dialog>` frame — inner content uses tone system)
- `AccessibleDialog` outer frame

DaisyUI is **removed** from content areas page-by-page. Every migrated page PR explicitly removes `btn`, `input`, `select`, `badge`, `card` DaisyUI classes from content-area JSX.

### 5.5 Tone Toggle Global Promotion Schedule

| Stage | Tone Toggle Behavior |
|-------|---------------------|
| Phases 0–6 (PRs 1–7) | Per-page local state; only migrated pages respond to tone |
| Phases 7–9 (PRs 8–10) | `TonePageWrapper` reads from a central React context (but preference is still page-ephemeral) |
| Phase 10 (PR 11) | Promote to global `localStorage` persistence (`kaapi-tone-preference` key); one toggle affects all pages |

**Why delay:** Promoting the toggle before all pages are migrated would cause unmigrated pages (still on `.glass-card`) to not respond — visible incoherence. The global promotion in Phase 10 is clean only after all pages use `TonePageWrapper`.

**Depends on operator answer to Q1 (§5.7):** `localStorage` vs session-only.

### 5.6 Exempt Components (Not Subject to Tone System)

| Component | Exemption Reason |
|-----------|-----------------|
| `HeroVisualFrame` (Dashboard WebGL compass) | Canvas/WebGL rendering; not a layout component; not a UI token consumer |
| `CompassChart` (BrewLogAdd) | Same — data visualization, canvas-rendered |
| `AccessibleDialog` (outer frame) | App-chrome-level; DaisyUI `<dialog>` retained; inner content migrates |
| Per-route `app-bg` background CSS classes | Photography-anchored backgrounds stay per-route; not tone-token consumers |
| `LoadingSpinner` | Small shared utility; evaluate wrapping or keeping as-is |

### 5.7 Blocking Open Questions for Operator

These must be answered before the indicated phase begins:

| Q# | Question | Blocking Phase | Maya's Recommendation |
|----|----------|----------------|----------------------|
| **Q1** | Tone toggle persistence: `localStorage` (survives refresh) or session-only? | Phase 10 (global promotion) | `localStorage` with key `kaapi-tone-preference` |
| **Q2** | DaisyUI retention in app-shell chrome acceptable? (Nav stays `espresso-dark` regardless of DARK/BEIGE toggle) | Phase 10 | Acceptable — scope DaisyUI to shell; extend `--kk-tc-*` to shell only if desired as future phase |
| **Q3** | HardwarePage split: in-page state machine (current) → two separate routes, or keep as in-page with Shell A overlay? | Phase 8 | Split into two routes for consistency with brew-log pattern |
| **Q4** | Guest view tone: visitor's preference, or fixed (e.g., always BEIGE for warmth)? | Phase 9 | Confirm with operator — no strong recommendation |
| **Q5** | `WebGL`/`HeroVisualFrame` exemption confirmed? ("not a UI component — it's a data visualization, not subject to the no-one-offs mandate") | Phase 7 (Dashboard) | Confirmed exempt per Maya's plan §2.5 item 11 |

### 5.8 Validation Gate Before Each PR Merges

Every migration PR must pass ALL FOUR before merging:

1. **Ruff check** (`uv run ruff check app/ tests/`)
2. **Ruff format check** (`uv run ruff format --check app/ tests/`)
3. **mypy strict** (`uv run mypy app/ --strict`)
4. **Full CI test suite** (`SPREADSHEET_ID=dummy DATABASE_URL=... bash scripts/run-ci-tests.sh`)
5. **Playwright visual regression** — for migration PRs: both tones (DARK + BEIGE), mobile (375px) + desktop (1280px) for all migrated pages; diff threshold catch regressions against northstar screenshots from PR 3 (anchors)

Items 1–4 are the existing CI parity checks. Item 5 is the new visual regression gate added in Phase 1 infra. **No migration PR ships if Playwright diff exceeds threshold on any migrated page.**

---

*Checklist complete. Ready for operator review. No implementation begins until this document and its two inputs (Maya's plan + Aria's northstar) are jointly approved.*

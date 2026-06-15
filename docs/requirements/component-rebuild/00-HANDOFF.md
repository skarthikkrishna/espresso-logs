# spec-043 Component-System Rebuild — Continuation Handoff

> **Read this first.** This document lets a new session resume the rebuild cold, without context loss.
> Last updated: **2026-06-15 (PAUSED)**. Branch: `feat/043-design-coherence` (off `household_fixes`). Nothing pushed.

---

## ⛔ PAUSED 2026-06-15 — RESTART HERE

The operator **paused** the rollout. Detail pages are GREEN; the two immersive **list/summary pages are RED** (need rework). **Do NOT proceed to new pages until the RED items are fixed and re-approved.**

| Page | Status |
|---|---|
| Brew-log detail, Catalog detail (glass takeover) | 🟢 GREEN — approved, committed `71f60d2` |
| **Catalog summary** (`/catalog`, CatalogList.tsx) | 🔴 RED — see below |
| **Home / Dashboard** (`/`, Dashboard.tsx) | 🔴 RED — see below |
| Foundation (`tone-system/` library + ToneContext) | 🟢 good — RED is about the immersive list pages, not the library |
| Rollout phases p2b–p10 | ⏸️ not started — blocked behind the RED fixes |

### RED to-do list (exact fixes — precise values in `07-dashboard-and-beige-fixes.md`)
**Both list pages — immersive shell:**
1. **BEIGE "light mode" reads GREY.** Raise the `ImmersiveListShell` beige frost from `rgba(245,235,220,0.55)` → **`rgba(245,235,220,0.78)`** (matches the detail-page natural beige). Apply to `--kk-il-frost-tint` in `[data-tone="beige"]` AND the `#main-content:has(.immersive-list-shell[data-tone="beige"])` background. One reusable fix → corrects BOTH pages.
2. **EntityCards faint on DARK tone** — boost dark-tone tokens (surface 0.72→0.78, border 0.08→0.12, inner highlight 0.12→0.15, tighter shadow + subtle ring).

**Home/Dashboard only:**
3. **REMOVE the 2D coffee-graphics hero viz** entirely (`DashboardHeroMotion`/`HeroVisualFrame`/`DashboardHero3D`/`DashboardHeroFallback` from `Dashboard.tsx`) — operator dislikes it. Decide a replacement hero treatment (or none). (NOTE: `07-...fixes.md` §B "integrate the viz" is MOOT — the viz is being removed.)
4. **Page reads monochromatic** — restore color/contrast (the beige fix + card presence + ensure RoastChips / warm accents show).
5. **Bag monograms show "RE"** (bug) — all Active-Bags EntityCards show "RE" instead of per-bag initials; fix the monogram derivation in `Dashboard.tsx`.
6. **"Log a shot" primary CTA is weak** plain text — make it a proper primary `ToneButton`.

### Restart procedure
1. Apply `07-dashboard-and-beige-fixes.md` §A (beige frost) + §E (EntityCard dark presence). Skip its §B (viz integration — superseded by removal).
2. Remove the hero viz from `Dashboard.tsx`; fix the monogram bug + the "Log a shot" CTA; restore color/contrast.
3. Visual-check BOTH tones on home + catalog summary (beige natural not grey; not monochromatic; cards present) before re-showing the operator.
4. Only after both pages are re-approved 🟢, resume the rollout (p2b–p10 per `03-rollout-checklist.md`).
5. Dashboard build is committed as a WIP/RED checkpoint at the pause (see §7). Catalog summary's earlier-approved code is in `71f60d2` but now needs the beige fix.

---

---

## 1. What this is

We are rebuilding the espresso-logs React UI into a **principle-grounded, fully reusable component system** and rolling it out across the whole app surface. Operator mandate: *"every component grounded in principle, not an edge-case or template; not a single UI component on any page may be a one-off."*

The visual language is a **dual-tone (DARK smoky charcoal / BEIGE warm cream) frosted-glass system** with two page archetypes:
- **Detail views + entity cards** (brew-log/catalog/hardware/household detail; catalog/hardware/home cards) → **glass takeover card**.
- **List / summary pages** → **card-less, immersive** (blurred background, no page-level card); the entity ITEMS on them are glass cards.

The DARK/BEIGE toggle is persisted to `localStorage` — it is the **seed for a future P2 site-wide light/dark mode**.

---

## 2. Current status (DONE)

- ✅ **Plan approved** (spec approach **(c)**: product spec fine, only the technical/engineering spec changes — which live in the `coffee_tracker` repo; no recreate/archive of spec-043).
- ✅ **Phase 0** — ~84 `--kk-tc-*` tone tokens promoted from prototype-scope to **global** (`frontend/src/index.css`).
- ✅ **Phase 1** — shared library `frontend/src/components/tone-system/` (TakeoverCard, TonePageWrapper, Section, SectionHeader, TitleBlock, TitleIcon, Chip, RoastChip, ToneButton, ToneToggle, MarkdownProse, ParamGrid, FormSection, ToneInput/Select/Textarea, BackLink, **ImmersiveListShell, EntityCard, ListPageHeader, ImmersiveEmptyState, ImmersiveFab**) + `frontend/src/contexts/ToneContext.tsx` (localStorage persistence, key `kaapi-tone-preference`, default `dark`).
- ✅ **Phase 2a (detail anchors)** — `BrewLogDetail.tsx` + `CatalogDetail.tsx` compose exclusively from tone-system; render identical to the northstar + operator fixes (catalog & brew-log monograms, markdown heading scale, two-column extraction readout, "Light" casing).
- ✅ **Catalog summary (list page)** — `CatalogList.tsx` migrated to the card-less immersive shell + glass EntityCards; full-bleed monogram fill on the card's own glass; two-line header ("Catalog" + "BEANS / INVENTORY"); tone toggle synced with detail.
- ✅ Tests **565/565**, lint 0 warnings, build clean. Local Postgres DB tests NOT run this session (frontend-only work) — see CI-parity note below.

**Git:** all work UNCOMMITTED until the session-close commit (see §7). Option-A fallback (warm-translucent cards) is committed at **`1eb24bd`**.

---

## 3. Operator workflow rules (BINDING — follow exactly)

1. **Single PR to `household_fixes`** (NOT `main`, NOT many PRs). Commits accumulate on the branch.
2. **Phase-gated localhost review:** build a phase → if it yields a deployable/viewable entity, show the operator on `http://localhost:8000` → get approval → only then proceed.
3. **New components get Aria first:** when a page introduces a component not already in the shared library, the **design agent (Aria) designs & templatizes it** (principled, reusable) BEFORE Finn builds, then it goes to localhost.
4. **Visual check vs northstar every phase** (Quinn e2e screenshot capture, or coordinator views) BEFORE showing the operator — do NOT rely on lint/build/tests alone (a regression slipped through once; see §6).
5. **Kill the dev server between code changes** (start it only to review; stop before the next build).
6. **No push without explicit operator approval.** Ask, then wait.
7. **App-shell / nav chrome stays as-is** (DaisyUI + existing GSAP motion — `LayerTransition`, `useKaapiMotion`). Full shell toning is deferred to the P2 light/dark work. Do NOT tone the shell during the rollout.
8. **HeroVisualFrame / CompassChart are NOT exempt** — after their pages are built, Aria runs a screenshot principle-review against the northstar; if they clash, she returns fix recommendations.

---

## 4. Next steps (remaining rollout)

Sequencing (Tariq `03-rollout-checklist.md` §4), each gated by Aria-design→localhost per §3. Phase status (this session's todo list — SQLite, won't persist):

| Phase | Page family | Status |
|---|---|---|
| p0 tokens / p1 library / p2a anchors / catalog-summary | foundation + first list | **DONE** |
| p2b | static pages → Shell E | pending |
| p3 | auth/form pages → Shell C | pending |
| p4 | remaining list pages → Shell B (immersive) | pending |
| p5 | dense form pages → Shell C | pending |
| p6 | settings/admin → Shell D (retire StandaloneHouseholdShell) | pending |
| p7 | dashboard → Shell B | pending |
| p8 | hardware → split HardwareList + HardwareDetail | pending |
| p9 | guest view → Shell B read-only (default tone) | pending |
| p10 | legacy cleanup (remove `.glass-card`, `.kaapi-content-surface`, `PageHeader`, `SectionHeading`, `Badge`, `EmptyState`, `GlassCard`, `roastChipClass`, `eligibilityBadgeTone`, `StandaloneHouseholdShell`) + ESLint no-one-off gate + Aria viz review | pending |

**Operator-directed next page:** the catalog summary was done to validate summary-vs-detail. Pick the next page per Tariq's sequencing (p2b static, or another list page to extend the immersive shell). Apply §3 (Aria designs new components first).

---

## 5. Reference docs (in this folder) + other durable artifacts

- `00-HANDOFF.md` — this file.
- `01-technical-architecture.md` (Maya) — 4-layer architecture (tokens→primitives→composed→page-shell), the ~84 tokens, the 10 legacy one-off categories, page-shell patterns A–E, 10-phase rollout.
- `02-principles-northstar.md` (Aria) — **THE design northstar**: 12 principles + meta-principle, each → component/token → enforceable rule. Check every component against this.
- `03-rollout-checklist.md` (Tariq) — per-page (all routes) + per-endpoint (62) reusability coverage matrices + sequencing. The "no orphaned component" enforcement artifact.
- `04-list-vs-detail-northstar.md` (Aria) — the list(card-less immersive) vs detail/cards(glass) architectural primitive + the 4 detail-page fixes spec.
- `05-catalog-list-design.md` (Aria) — the immersive list shell + EntityCard + ListPageHeader design (note: operator then refined to full-bleed monogram-on-card-glass + 2-line header — see decision drops).
- `northstar-screenshots/` — 8 PNGs (brew-log + catalog detail, dark+beige, mobile+desktop) = the approved visual baseline (captured with E2E test data).
- `../surface-api-map.md` — the V2 surface→FE/BE/external map (62 endpoints), independently verified; the rollout coverage target.
- `.squad/decisions/inbox/2026-06-*-spec043-*.md` — every operator decision/feedback this session (merged into `.squad/decisions.md` by Scribe at session close).
- `~/.copilot/session-state/.../plan.md` — session plan (ephemeral; superseded by this handoff).

---

## 6. Gotchas / lessons (don't repeat these)

- **Scope your CSS to the right class.** The extraction-readout broke because its two-column grid/typography were scoped to the old `.kk-proto-043` class; the refactor to `.kk-takeover-card` dropped them. When migrating, migrate the STRUCTURAL CSS, not just colors. Always visual-check.
- **Multi-value/comma CSS tokens go in `:root`,** never inside `@plugin "daisyui/theme"` (DaisyUI truncates commas to the last value). Per-tone color tokens go in the `.kk-tc--dark`/`.kk-tc--beige` (or `[data-tone]`) blocks.
- **Casing:** chips/labels render canonical data casing ("Light" not "LIGHT"); `text-transform: uppercase` is reserved for section headers only.
- **The build output `app/static/spa/` is gitignored** — regenerated by `npm run build`; never commit it. The server (`uv run uvicorn app.main:app --reload --port 8000`) serves it; rebuild before reviewing.
- **e2e screenshot harness:** start backend with `E2E_AUTH_BYPASS=1`, auth via `POST /api/e2e/session` (see `frontend/e2e/fixtures.ts` + seed helpers). This is how northstar/verify screenshots were captured.
- **V2 map real gaps** (from the verified map) that touch UI: import-wizard FE bypasses the `/import` backend pipeline; `HardwareRepo.next_id()` still reads Google Sheets; declined invites stay reusable (intentional but a product/security question). Surface these when their pages are reached.

---

## 7. Session-close actions (this wrap)

- [ ] Coordinator commits the rebuild (frontend `tone-system/`, `ToneContext.tsx`, the 3 migrated pages, `index.css`, `package.json`/lock, `roastChipClass.ts`) + docs (this `component-rebuild/` folder, `surface-api-map.md`) locally. **No push.**
- [ ] Scribe merges `.squad/decisions/inbox/` → `.squad/decisions.md`, writes the session log, commits `.squad`.
- [ ] Ralph updates `.squad/identity/now.md` with current focus + open work.
- [ ] Do NOT push. Operator pushes to `household_fixes` when ready.

---

## 8. Local validation (run before any future push)

Per the repo CI-parity: `uv run ruff check app/ tests/` · `uv run ruff format --check app/ tests/` · `uv run mypy app/ --strict` · `SPREADSHEET_ID=dummy DATABASE_URL=postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs_test bash scripts/run-ci-tests.sh` (test-marked DB name required). Frontend: `cd frontend && npm run lint && npm run build && npm test`. **This session changed only frontend** — backend CI-parity was not re-run (no backend changes), but run all four before any push.

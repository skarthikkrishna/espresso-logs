# Team Decisions Log

**Project:** espresso-logs  
**Last Updated:** 2026-05-15T14:52:37-07:00

---

## 2026-05-15

### USE_POSTGRES belongs in APP_SECRETS, not as a standalone Cloud Run env var

**Author:** Alex  
**Branch:** config/use-postgres-to-app-secrets  
**Status:** Committed

`USE_POSTGRES` (which controls the Sheets vs Postgres backend switch) must live inside the `APP_SECRETS` Secret Manager JSON blob, not as a standalone Cloud Run env var.

**Rationale:**
1. `app/config.py`'s `_load_app_secrets` validator already injects all blob keys into `Settings` before individual env vars are evaluated. No code change was required to support blob-sourced `USE_POSTGRES`.
2. Centralising all non-infra configuration in the APP_SECRETS blob prevents config drift: operators only need to update one Secret Manager secret to flip the backend, rather than also editing Cloud Run revision environment variables.
3. `APP_ENV` and `OAUTH_REDIRECT_URI` remain as standalone Cloud Run env vars because they are infra/routing concerns, not application secrets.

**What was done:**
- Added inline comment on the `use_postgres` field in `Settings` (`app/config.py`) documenting the production sourcing rule.
- Added matching comment in `.env.example` explaining the local-dev vs production split.
- Updated Secret Manager: `APP_SECRETS` version 3 now includes `"USE_POSTGRES": true`.
- `cloudbuild.yaml` already omits `USE_POSTGRES` from `--set-env-vars`; no change required.

**Affected files:**
- `app/config.py`
- `.env.example`

**Rule:** In production (Cloud Run), `USE_POSTGRES` must be set via the APP_SECRETS JSON blob. It must NOT appear as a standalone `--set-env-vars` entry in `cloudbuild.yaml` or in any Cloud Run revision configuration.

---

## 2026-05-13

### Chrome desktop backdrop-filter + async background image pattern

**Author:** Finn  
**Branch:** fix/ui-safari-polish  
**Status:** Committed

When a `backdrop-filter` element has a `position: fixed; z-index: -1` sibling that loads a background image asynchronously, **always apply `will-change: transform` to the background element**.

**Rationale:** Chrome desktop's GPU compositor invalidates and re-promotes the background element's compositor layer when its `background-image` URL loads asynchronously. During the promotion window, `backdrop-filter` on a sibling element samples from a black/empty compositor layer. The `will-change: transform` hint pre-promotes the element to its own GPU layer before the image arrives, so the update happens in-place without disrupting the backdrop-filter chain.

Chrome mobile and Safari are unaffected, so the fix is Chrome desktop-only in effect but safe to apply universally.

**Also:** Remove `transition: background-image` from background elements. `background-image` is not a CSS-animatable property per CSS Transitions Level 1. Any `transition: background-image` declaration is a no-op in spec-compliant browsers and may interfere with compositor layer management.

**Implementation:** `.app-bg` in `frontend/src/index.css` now carries `will-change: transform` and the `transition: background-image 300ms ease` has been removed.

---

### Chip/Badge Sizing Convention

**Author:** Finn (Frontend)  
**Branch:** fix/ui-safari-polish  
**Status:** Committed

All roast/machine chip badges in the espresso-logs React SPA use the following consistent class pattern:

```
badge badge-sm text-xs <colour-tokens>
```

**Rationale:** DaisyUI's `badge-sm` sets a compact height but does not always enforce `font-size: 0.75rem` explicitly across all DaisyUI versions — it depends on the cascade. Adding `text-xs` explicitly guarantees the chip label text is 12px regardless of parent context or DaisyUI version. Without `text-xs`, badge text can inherit `text-sm` (14px) from the surrounding card or list context, which causes the label to push against the chip edges and appear broken.

**Applied to:**
- `frontend/src/pages/BrewLogDetail.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/CatalogList.tsx`
- `frontend/src/pages/CatalogDetail.tsx` (also fixed missing `badge-sm`)

**Rule:** When using DaisyUI `badge` as a compact metadata chip/tag, always specify both `badge-sm` **and** `text-xs`. Never rely on DaisyUI's implicit font-size inheritance for compact chips.

---

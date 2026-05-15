### 2026-05-15T14:37:34-07:00: Routing decision — USE_POSTGRES to APP_SECRETS

**By:** Alex (routing)
**What:** DIRECT_PERMITTED — move `USE_POSTGRES` from Cloud Run standalone env var into the `APP_SECRETS` JSON blob and ensure the app reads it exclusively via `settings.use_postgres`.
**Scope:**
- `app/config.py` — minor comment update only: clarify that `use_postgres` / `USE_POSTGRES` may be sourced from the APP_SECRETS blob in production (no logic changes required)
- Operational (not in repo): remove `USE_POSTGRES=true` standalone env var from Cloud Run service; add `"USE_POSTGRES": true` to the APP_SECRETS JSON blob in Secret Manager
- `.env.example` — no change needed (standalone `USE_POSTGRES=false` remains correct for local dev)
- `cloudbuild.yaml` — no change needed (`USE_POSTGRES` is not in `--set-env-vars` already)

**Why:** The `_load_app_secrets` model validator in `config.py` already handles this generically — it iterates all APP_SECRETS blob keys, lowercases them, and injects them into the pydantic-settings `data` dict before field validation. `USE_POSTGRES` from the blob maps directly to `use_postgres` field via `field_name = key.lower()`. No direct `os.environ.get("USE_POSTGRES")` calls exist anywhere in app code — all access is through `settings.use_postgres`. The change is bounded: one optional comment clarification in `config.py`; the rest is a GCP Console / Secret Manager operation outside the repo.

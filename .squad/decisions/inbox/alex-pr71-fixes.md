# Decision Drop — PR #71 Copilot Review Fixes

**Date:** 2026-05-15
**Author:** Alex
**Branch:** config/use-postgres-to-app-secrets
**Commit:** bffbe7a

## Decision

Narrow the `use_postgres` inline comment in `app/config.py` to accurately reflect:

1. **Precedence rule:** Env vars take precedence over APP_SECRETS blob values. A stale standalone `USE_POSTGRES` Cloud Run env var would silently override the blob entry — this is now explicitly documented as a warning.

2. **Scope boundary:** The "all config lives in the blob" framing was inaccurate. Corrected to:
   - **Secrets** (DATABASE_URL, USE_POSTGRES, API keys) → APP_SECRETS blob
   - **Infra config** (APP_ENV, OAUTH_REDIRECT_URI) → standalone Cloud Run env vars

3. **Operational docs updated:** `docs/requirements/engineering_architecture_v2.md` rollback instructions for M4/M5 previously told operators to "flip USE_POSTGRES env var in Cloud Run" — corrected to reference the APP_SECRETS blob.

## Rationale

The original comment could lead an operator to add `USE_POSTGRES=true` as a standalone Cloud Run env var (reasonable if they read "env var" in the comment). This would cause `_load_app_secrets` to skip setting the field from the blob (existing value ≠ None/""), leading to config drift. The corrected comment prevents this failure mode.

## No logic changes

The `_load_app_secrets` validator behaviour is unchanged. This is purely a documentation/comment correctness fix.

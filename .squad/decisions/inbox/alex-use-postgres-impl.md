# Decision: USE_POSTGRES belongs in APP_SECRETS, not as a standalone Cloud Run env var

**Date:** 2026-05-15  
**Author:** Alex  
**Branch:** config/use-postgres-to-app-secrets

## Decision

`USE_POSTGRES` (which controls the Sheets vs Postgres backend switch) must live inside the `APP_SECRETS` Secret Manager JSON blob, not as a standalone Cloud Run env var.

## Rationale

1. `app/config.py`'s `_load_app_secrets` validator already injects all blob keys into `Settings` before individual env vars are evaluated. No code change was required to support blob-sourced `USE_POSTGRES`.
2. Centralising all non-infra configuration in the APP_SECRETS blob prevents config drift: operators only need to update one Secret Manager secret to flip the backend, rather than also editing Cloud Run revision environment variables.
3. `APP_ENV` and `OAUTH_REDIRECT_URI` remain as standalone Cloud Run env vars because they are infra/routing concerns, not application secrets.

## What was done

- Added inline comment on the `use_postgres` field in `Settings` (`app/config.py`) documenting the production sourcing rule.
- Added matching comment in `.env.example` explaining the local-dev vs production split.
- Updated Secret Manager: `APP_SECRETS` version 3 now includes `"USE_POSTGRES": true`.
- `cloudbuild.yaml` already omits `USE_POSTGRES` from `--set-env-vars`; no change required.

## Affected files

- `app/config.py`
- `.env.example`

## Rule

> In production (Cloud Run), `USE_POSTGRES` must be set via the APP_SECRETS JSON blob. It must NOT appear as a standalone `--set-env-vars` entry in `cloudbuild.yaml` or in any Cloud Run revision configuration.

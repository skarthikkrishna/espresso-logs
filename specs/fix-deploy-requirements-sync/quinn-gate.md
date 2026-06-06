---
status: APPROVED
gate: pre-implementation
agent: Quinn
feature: fix-deploy-requirements-sync
created_at: 2026-06-06T09:54:15-07:00
---

# Quinn Pre-Implementation Gate: Deploy Requirements Sync

## Scope reviewed

- `pyproject.toml`
- `uv.lock`
- `requirements.txt`
- `Dockerfile`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

## Findings

- Docker installs production dependencies with `pip install --no-cache-dir -r requirements.txt`.
- `requirements.txt` is generated and already records `uv export --no-hashes -o requirements.txt` as the source command.
- `requirements.txt` is out of sync with the lock state: it pins `pydantic==2.13.4` and `pydantic-core==2.47.0`, while `uv.lock` currently resolves `pydantic==2.13.3` and `pydantic-core==2.46.3`.
- CI currently validates `uv sync --frozen`, but does not validate the Docker `requirements.txt` install path that failed in Cloud Build.

## Decision

status: APPROVED

The work is bounded and may proceed as a direct fix because the failure mode is deterministic: regenerate/sync the exported Docker requirements and add a PR-time validation that exercises that same requirements path before deploy.

## Implementation guardrails

1. Do not hand-edit the pydantic or pydantic-core pins to paper over the resolver failure. Regenerate `requirements.txt` from the existing project metadata/lock using the recorded export path. Prefer `uv export --frozen --no-hashes -o requirements.txt`; if the installed `uv` does not support `--frozen` for export, use the recorded `uv export --no-hashes -o requirements.txt` and stop if `uv.lock` changes unexpectedly.
2. Keep the implementation limited to syncing `requirements.txt` and adding Docker requirements-path CI validation unless a directly necessary workflow adjustment is discovered.
3. Add CI validation that runs on PRs and installs `requirements.txt` with pip under Python 3.12 in an isolated environment, using the same file and install path Docker uses (`pip install --no-cache-dir -r requirements.txt`). This must not require GCP credentials or a full deploy.
4. Preserve release discipline: use the existing branch and a PR; never push directly to `main`.
5. Before any push, all required local checks plus the new requirements-path validation must pass, and the operator must explicitly approve the push.

## Required validation before release

- Regenerate/export requirements and inspect the diff for generated dependency synchronization only.
- Run a local Docker-path requirements check, for example in a fresh project-local venv: `python -m pip install --no-cache-dir -r requirements.txt`.
- Run all four local CI-equivalent checks:
  - `uv run ruff check app/ tests/`
  - `uv run ruff format --check app/ tests/`
  - `uv run mypy app/ --strict`
  - `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/`
- Confirm the new CI validation is present in `.github/workflows/ci.yml` and targets the same `requirements.txt` path as the Dockerfile.

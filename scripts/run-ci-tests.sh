#!/bin/bash
#
# Backend test gate shared by local pre-push and GitHub Actions.
# Requires DATABASE_URL so SQL/RLS tests run locally exactly as they do in CI.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: DATABASE_URL is required for CI-parity backend tests." >&2
    echo "Example:" >&2
    echo "  SPREADSHEET_ID=dummy DATABASE_URL=postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs bash scripts/run-ci-tests.sh" >&2
    exit 2
fi

SPREADSHEET_ID="${SPREADSHEET_ID:-dummy}" \
    uv run pytest tests/ --cov=app --cov-report=xml --cov-fail-under=80 --ignore=tests/e2e/

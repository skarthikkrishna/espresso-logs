#!/bin/bash
#
# Pre-push CI checks — runs all required linting and tests before push.
# Usage: bash scripts/pre-push-check.sh
#
# Runs from repo root. Exits on first failure.

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

CHECKS_TOTAL=4
CURRENT_CHECK=0

# Helper: print section header
section_header() {
    local num=$1
    local title=$2
    echo ""
    echo "[${num}/${CHECKS_TOTAL}] ${title}"
    echo "─────────────────────────────────────────────────────────────"
}

# Helper: report success or failure
on_failure() {
    local step_num=$1
    local cmd=$2
    echo ""
    echo "❌ Pre-push checks FAILED at step ${step_num}."
    echo "   Command: ${cmd}"
    exit 1
}

# Check 1: ruff check
CURRENT_CHECK=1
section_header "$CURRENT_CHECK" "Ruff linter (ruff check app/ tests/)"
if ! uv run ruff check app/ tests/; then
    on_failure "$CURRENT_CHECK" "uv run ruff check app/ tests/"
fi

# Check 2: ruff format
CURRENT_CHECK=2
section_header "$CURRENT_CHECK" "Ruff formatter (ruff format --check app/ tests/)"
if ! uv run ruff format --check app/ tests/; then
    on_failure "$CURRENT_CHECK" "uv run ruff format --check app/ tests/"
fi

# Check 3: mypy strict
CURRENT_CHECK=3
section_header "$CURRENT_CHECK" "MyPy type checking (mypy app/ --strict)"
if ! uv run mypy app/ --strict; then
    on_failure "$CURRENT_CHECK" "uv run mypy app/ --strict"
fi

# Check 4: pytest
CURRENT_CHECK=4
section_header "$CURRENT_CHECK" "Pytest tests (SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/)"
if ! SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/; then
    on_failure "$CURRENT_CHECK" "SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/"
fi

# All checks passed
echo ""
echo "✅ All checks passed — safe to push."
echo ""

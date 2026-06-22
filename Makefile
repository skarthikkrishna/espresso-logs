.PHONY: help install install-tools dev test lint build spec043-evidence spec043-evidence-up spec043-evidence-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ── Developer tooling ─────────────────────────────────────────────────────────

install-tools: ## Install global dev tools (squad CLI). Re-run after `brew upgrade node`.
	@bash scripts/install-tools.sh

# ── Python / backend ──────────────────────────────────────────────────────────

install: ## Install Python dependencies via uv
	uv sync

test: ## Run Python tests
	SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/

lint: ## Run ruff linter
	uv run ruff check app/ tests/

pre-push: ## Run all pre-push checks (linting, types, tests)
	@bash scripts/pre-push-check.sh

# ── Frontend ──────────────────────────────────────────────────────────────────

build: ## Build React SPA (outputs to app/static/spa/)
	cd frontend && npm install && npm run build

dev: ## Start backend dev server (run `make build` or `cd frontend && npm run dev` first)
	uv run uvicorn app.main:app --reload --port 8000

spec043-evidence-up: ## Start the isolated spec-043 evidence Postgres on localhost:5433
	@bash scripts/spec043_evidence.sh up

spec043-evidence-down: ## Stop and remove the isolated spec-043 evidence Postgres volume
	@bash scripts/spec043_evidence.sh down

spec043-evidence: ## Run spec-043 isolated DB -> migrate -> backend/frontend -> screenshot grid -> teardown
	@bash scripts/spec043_evidence.sh run

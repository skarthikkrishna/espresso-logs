# GitHub Copilot Instructions — espresso-logs

This is the **application repository** for Espresso Logs — an open-source coffee tracking app built with FastAPI and React.

Reusable prompt templates for common subagent tasks live in `.github/copilot-prompts/`:

- `code-exploration.md`
- `implementation.md`
- `code-review.md`
- `bug-triage.md`
- `image-sourcing.md`

---

## Workflow

**Never push directly to `main`.** Every change goes through a branch and PR.

```bash
git checkout main && git pull origin main
git checkout -b <type>/<slug>   # e.g. fix/brew-log-ordering
```

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · FastAPI (JSON API only) |
| Frontend | React 18 · Vite · TypeScript · TailwindCSS + DaisyUI |
| Data store | Google Sheets via `gspread` |
| Auth | Google OAuth + email allowlist (`ALLOWLIST_EMAILS`) |
| AI | Gemini 2.5 Flash (default) · Anthropic Claude Haiku (adapter) |
| Hosting | Google Cloud Run (scale-to-zero) |
| Images | Google Cloud Storage (public-read bucket) |

## Key source files

- `app/main.py` — FastAPI app, middleware, route registration
- `app/deps.py` — dependency injection (sheets client, repos, LLM, idempotency store)
- `app/repos/` — data access layer (all use `SheetsClientProtocol`)
- `app/routers/` — API route handlers
- `app/services/` — inference, image store, image sourcer, idempotency
- `frontend/src/` — React SPA; `api/` for typed API clients, `pages/` for route components
- `app/static/spa/` — committed Vite build output (served by FastAPI)

## Code conventions

- All public functions and methods must have type annotations
- Module-level docstrings required on all routers and services
- Tests use `SPREADSHEET_ID=dummy` and `FakeSheetsClient` (never real sheets)
- `pytest-asyncio` in `auto` mode — no `@pytest.mark.asyncio` markers needed
- Linting: `uv run ruff check app/ tests/`
- Tests: `SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/`

## Documentation

- `docs/requirements/functional-spec.md` — product behaviour and entities
- `docs/requirements/engineering_architecture.md` — system design and decisions
- `docs/requirements/sheet-schema.md` — Google Sheets column schema

---

## Development Workflow — Squad + SpecKit First

**All significant work — features, bug fixes, and refactors — follows the Squad + SpecKit workflow by default.**

### The workflow

1. **Specify** — The relevant Squad agent authors the spec using `speckit.specify`
2. **Clarify** — `speckit.clarify` surfaces and resolves ambiguities before any code is written
3. **Plan** — `speckit.plan` produces the implementation design
4. **Tasks** — `speckit.tasks` generates a dependency-ordered task list
5. **Implement** — `speckit.implement` executes the tasks

### Squad agent ownership

Match the work to the agent whose domain fits:

| Agent | Domain |
|---|---|
| **Tariq** | Cross-repo sequencing, milestones, operability, CI/CD, release readiness |
| **Maya** | Architecture decisions, security, code quality gates, technical standards |
| **Finn** | React/TypeScript, frontend features, UI/UX, accessibility |
| **Alex** | FastAPI, backend features, data models, auth, multi-tenancy |
| **Priya** | User stories, acceptance criteria, product scope |
| **Quinn** | PR review, diff analysis, code quality |

### When it's OK to skip SpecKit

Only trivial, self-contained changes (typo fixes, single-line config patches) may skip the full SpecKit flow. When in doubt, spec it first.

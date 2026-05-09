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

### Squad-First Mandate — No Exceptions

**Every request to Copilot CLI — regardless of scope, size, or apparent triviality — requires Squad involvement before any action is taken.**

This is not optional. It applies to:
- Feature requests of any size
- Bug fixes and review feedback responses
- File edits (single-line or multi-file)
- Refactors and renames
- API or data model changes
- Frontend component and routing changes
- Test additions and CI configuration changes
- Repository documentation and contributing guide changes

**Copilot does not decide whether Squad is needed. A Squad agent decides.**

The routing sequence is always:
1. User makes a request → Copilot routes to the relevant Squad agent
2. Squad agent assesses the request and recommends one of:
   - **SpecKit required** — Squad agent invokes the appropriate SpecKit phase (`speckit.specify`, `speckit.clarify`, `speckit.plan`, `speckit.tasks`, or `speckit.implement`)
   - **Direct implementation permitted** — Squad agent explicitly classifies the work as self-contained and scoped, and gives the green light with rationale
3. Only after Step 2 does implementation or editing proceed

**SpecKit is invoked on the Squad agent's recommendation, not Copilot's unilateral judgment.** If a Squad agent does not give an explicit green light for direct implementation, SpecKit is the default path.

Non-feature work (CI workflow changes, dependency updates, process changes) follows the same rule: the relevant Squad agent (typically Tariq for CI/process, Maya for engineering standards) recommends whether SpecKit applies based on scope and impact.

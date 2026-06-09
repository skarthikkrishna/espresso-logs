# Espresso Logs

A self-hostable, multi-household espresso shot journal with AI-powered tasting notes — built with FastAPI and React.

---

## What it is

**espresso-logs** is an open-source PWA for tracking espresso shots. Log every extraction, build a bean catalog, monitor your hardware, and get AI feedback on your technique. Households let multiple people share a single journal with role-based access; guest links let anyone view your shots without signing in.

---

## Features

| Area | What you get |
|------|-------------|
| **Auth** | Username/password registration + optional Google OAuth sign-in. Short-lived JWT access tokens with HttpOnly refresh-cookie rotation. Rate-limited endpoints. |
| **Households** | Create and name a household, invite members by link, accept/decline invitations, manage roles (admin / member). |
| **Brew log** | Log espresso shots with dose, yield, time, and notes. Paginated shot list and per-shot detail. AI extraction feedback and tasting note generation (Anthropic Claude primary, Google Gemini fallback). |
| **Bean catalog** | Catalogue roasters and beans with roast level, origin, and optional images. Per-bean detail with shot history. |
| **Hardware** | Track your machines and grinders; log maintenance events. |
| **Inventory** | Monitor bag quantities and track what's in rotation. |
| **Import wizard** | Admin-only step-by-step wizard to bulk-import shot and catalog history from a spreadsheet (CSV/XLSX). Automatic image sourcing for beans. |
| **Guest view** | Share a read-only link to your household's shots — no sign-in required. |
| **PWA / SPA** | Installable progressive web app. Service worker for offline shell. Static SPA served from the FastAPI backend. |
| **Quality gates** | Extensive Pytest suite (unit + integration) and Playwright end-to-end tests. TypeScript strict mode throughout. |

---

## Architecture

![Architecture diagram: React SPA frontend communicates with FastAPI backend over HTTP/JSON; backend connects to PostgreSQL and optional AI providers (Anthropic Claude and Google Gemini); optional Google OAuth flow shown](docs/readme/architecture.svg)

```
espresso-logs/
├── app/                  FastAPI backend
│   ├── main.py           App entry point, middleware, route registration
│   ├── deps.py           Dependency injection (repos, LLM, idempotency, auth)
│   ├── config.py         Pydantic-settings configuration
│   ├── models/           SQLAlchemy ORM models (user, household, brew_log, catalog, hardware, …)
│   ├── repos/            Data-access layer — SQL repos + legacy Sheets shim
│   ├── routers/          API route handlers (auth, households, brew log, catalog, hardware, …)
│   └── services/         Inference, image store/sourcer, importer, idempotency, auth helpers
├── frontend/             React 19 SPA (Vite + TypeScript strict)
│   └── src/
│       ├── api/          Typed Axios API clients + TanStack Query keys
│       ├── components/   Shared UI (AppShell, modals, charts, nav)
│       └── pages/        Route components (Dashboard, BrewLog*, Catalog*, Hardware, Import, …)
├── tests/                Pytest suite — unit, integration, e2e (Playwright)
├── alembic/              Database migrations
└── docs/                 Architecture and requirements docs
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI, uvicorn, Pydantic v2, SQLAlchemy (async), Alembic, asyncpg |
| **Auth** | `python-jose` JWT, `passlib[argon2]`, Google OAuth 2.0 (Authlib), slowapi rate limits |
| **Database** | PostgreSQL |
| **AI** | Anthropic Claude API (primary), Google Gemini API (fallback) — both optional |
| **Frontend** | React 19, Vite, TypeScript strict, TailwindCSS v4, DaisyUI v5 |
| **State / data** | TanStack Query v5, react-router-dom v7, Chart.js |
| **Testing** | Pytest + pytest-asyncio, Vitest + Testing Library (frontend), Playwright (E2E) |
| **Linting / types** | Ruff, mypy (strict), ESLint (TypeScript strict) |

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.12.x | [python.org](https://www.python.org/downloads/) or `brew install python@3.12` |
| Node | 20+ or 22+ | [nodejs.org](https://nodejs.org/) or `brew install node` |
| `uv` | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Docker | any recent | [docker.com](https://www.docker.com/) — for local PostgreSQL |

---

## Quick start

### 1. Clone and configure

```bash
git clone https://github.com/skarthikkrishna/espresso-logs
cd espresso-logs
cp .env.example .env
# Edit .env — see the Environment variables section below
```

### 2. Start PostgreSQL (Docker)

```bash
docker compose -f docker-compose.dev.yml up db -d
```

### 3. Install dependencies and run migrations

```bash
uv sync                                         # install Python deps
uv run alembic upgrade head                     # apply DB migrations
```

### 4. Start the backend

```bash
make dev        # uvicorn on http://localhost:8000
```

### 5. Start the frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev     # Vite dev server on http://localhost:5173
```

> The backend serves the production SPA build from `app/static/spa/`. During development, run both processes and use the Vite server (`localhost:5173`) for hot reload. To build the SPA into the backend: `make build`.

---

## Environment variables

Copy `.env.example` to `.env` and fill in your values. The file is annotated — see it for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql+asyncpg://user:password@localhost:5432/espresso_logs` |
| `USE_POSTGRES` | Yes | Set to `true` to use the PostgreSQL backend |
| `SESSION_SECRET` | Yes | Session signing secret — generate with `openssl rand -hex 32` |
| `JWT_SECRET` | Yes | JWT signing secret — generate with `openssl rand -hex 32` |
| `APP_ENV` | Yes | `development` or `production` |
| `GOOGLE_OAUTH_CLIENT_ID` | No | Google OAuth 2.0 client ID (enables Google sign-in) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | No | Google OAuth 2.0 client secret |
| `OAUTH_REDIRECT_URI` | No | Must match your OAuth app's registered redirect URI |
| `ANTHROPIC_API_KEY` | No | Anthropic Claude API key (enables AI tasting notes) |
| `LLM_API_KEY` | No | Google Gemini API key (fallback AI provider) |
| `GCP_PROJECT_ID` | No | GCP project ID — needed only for GCS image uploads |
| `PORT` | No | Server port (default: `8000`) |

**Never commit `.env` to git.** The `.gitignore` excludes it by default.

---

## Development commands

### Backend

```bash
make install        # uv sync — install/update Python dependencies
make dev            # start uvicorn backend on :8000 with --reload
make test           # run Pytest suite (unit + integration, excludes e2e)
make lint           # ruff check app/ tests/
make pre-push       # full pre-push check: lint + types + tests
```

Individual commands:

```bash
uv run pytest tests/ -v                         # verbose test run
uv run pytest tests/ --cov=app                  # with coverage
uv run ruff check --fix app/ tests/             # lint with auto-fix
uv run mypy app/ --strict                       # type check
```

### Frontend

```bash
cd frontend
npm run dev         # Vite dev server on :5173
npm run build       # production build → app/static/spa/
npm run test        # Vitest unit tests
npm run lint        # ESLint strict TypeScript
npm run test:e2e    # Playwright end-to-end tests (requires running server)
```

Or from the repo root:

```bash
make build          # cd frontend && npm install && npm run build
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Make your changes and add tests.
4. Verify everything passes locally before opening a PR:
   ```bash
   make pre-push
   cd frontend && npm run lint && npm run test
   ```
5. Open a pull request targeting `main`. CI must pass and at least one review is required before merge.

### Privacy

This repository is public. **Do not include** in any commit or PR:
- Real credentials, API keys, tokens, or secrets of any kind
- Production URLs, GCP project IDs, or service account names
- Personally identifiable information (email addresses, names, etc.)
- Local paths, usernames, or hostnames

See `.env.example` for the accepted placeholder format for all sensitive values.

---

## License

See [LICENSE](LICENSE).

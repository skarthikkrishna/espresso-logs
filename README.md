# Espresso Logs

An open-source coffee shot tracking app built with FastAPI and React.

---

## Project overview

Espresso Logs is a personal espresso shot tracking application that lets you log shots, track hardware, and get AI-powered tasting notes. Built with:

- **Backend**: FastAPI (Python 3.12)
- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + DaisyUI
- **Data store**: Google Sheets via `gspread` (Postgres migration in progress — M6)
- **Auth**: Google OAuth + email allowlist
- **AI**: Anthropic Claude (primary) + Gemini (fallback)
- **Hosting**: Google Cloud Run (scale-to-zero)

For infrastructure and deployment, see [skarthikkrishna/tf-infra](https://github.com/skarthikkrishna/tf-infra).
For product specs and roadmap, see [skarthikkrishna/coffee_tracker](https://github.com/skarthikkrishna/coffee_tracker).

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.12+ | [python.org](https://www.python.org/downloads/) or `brew install python@3.12` |
| Node | 20+ | [nodejs.org](https://nodejs.org/) or `brew install node@20` |
| `uv` | latest | `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh` |

You also need:
- A Google Cloud project with the **Google Sheets API** and **OAuth 2.0** credentials enabled
- A Google Sheets spreadsheet to use as your data store
- (Optional) An Anthropic API key for AI tasting notes

---

## Quick start

```bash
git clone https://github.com/skarthikkrishna/espresso-logs
cd espresso-logs
cp .env.example .env
# Edit .env — fill in:
#   SPREADSHEET_ID, SESSION_SECRET, GOOGLE_OAUTH_CLIENT_ID,
#   GOOGLE_OAUTH_CLIENT_SECRET, ALLOWLIST_EMAILS, OAUTH_REDIRECT_URI

make dev        # starts FastAPI backend only on http://localhost:8080
```

**Frontend (in a second terminal)**:

```bash
cd frontend
npm install
npm run dev     # starts Vite dev server on http://localhost:5173
```

> **Note**: `make dev` starts the backend only. The frontend is a separate Vite dev server. Both must be running for the full application to work locally.

---

## Environment variables

See `.env.example` for the full annotated list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SPREADSHEET_ID` | Yes | Google Sheets spreadsheet ID (in the sheet URL) — *deprecated at M6* |
| `SESSION_SECRET` | Yes | Session secret, min 32 chars — generate with `openssl rand -hex 32` |
| `GOOGLE_OAUTH_CLIENT_ID` | Yes | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `OAUTH_REDIRECT_URI` | Yes | Must match what's registered in Google Cloud Console |
| `ALLOWLIST_EMAILS` | Yes | Comma-separated list of allowed login emails |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI tasting notes |
| `LLM_API_KEY` | No | Gemini fallback key |
| `GCP_PROJECT_ID` | No | GCP project ID — auto-detected on Cloud Run; required for local image uploads |
| `PORT` | No | Server port (default: `8080`) |
| `APP_ENV` | No | `development` or `production` (default: `development`) |

---

## Running tests

```bash
uv run pytest tests/ --ignore=tests/e2e/
```

For coverage:
```bash
uv run pytest tests/ --cov=app --cov-report=html --ignore=tests/e2e/
```

Set `SPREADSHEET_ID=dummy` in your `.env` or prefix the command:
```bash
SPREADSHEET_ID=dummy uv run pytest tests/ -v --ignore=tests/e2e/
```

---

## Running the linter

```bash
uv run ruff check app/ tests/
```

To auto-fix:
```bash
uv run ruff check --fix app/ tests/
```

---

## Type checking

```bash
uv run mypy app/ --strict
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and add tests
4. Ensure CI passes locally:
   ```bash
   uv run ruff check app/ tests/
   uv run mypy app/ --strict
   uv run pytest tests/ --ignore=tests/e2e/
   ```
5. Push and open a pull request targeting `main`
6. CI must pass (all 12 checks) and 1 review is required before merge

**PR workflow**: branch → PR → CI passes → 1 review → merge

---

## Architecture

The application is a FastAPI backend serving a React SPA. Key directories:

```
app/           FastAPI application
  main.py      App entry point, middleware, route registration
  deps.py      Dependency injection (sheets client, repos, LLM, idempotency)
  repos/       Data access layer (all use SheetsClientProtocol)
  routers/     API route handlers
  services/    Inference, image store, image sourcer, idempotency
  config.py    Pydantic-settings configuration
frontend/
  src/
    api/       Typed API clients
    pages/     Route components
    components/  Shared UI components
tests/         Pytest test suite (unit + integration)
```

For a detailed system design, see [docs/requirements/engineering_architecture_v2.md](docs/requirements/engineering_architecture_v2.md).

---

## License

See [LICENSE](LICENSE).

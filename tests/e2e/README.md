# E2E Tests (Playwright)

Playwright smoke tests that run against a live Cloud Run URL (or a local dev server).

## Prerequisites

Install Chromium once (one-time, per-machine):
```bash
uv run playwright install chromium
```

## Running locally

Start the app in one terminal:
```bash
uv run uvicorn app.main:app --reload
```

Run smoke tests in another:
```bash
E2E_BASE_URL=http://localhost:8000 uv run pytest tests/e2e/ -m smoke -v
```

## Running against the deployed service

```bash
E2E_BASE_URL=https://<your-cloud-run-service-url> \
  uv run pytest tests/e2e/ -m smoke -v
```

## CI

Cloud Build runs `e2e-smoke` automatically after every deploy.  
The step sets `E2E_BASE_URL` to the deployed service URL via the `$_SERVICE_URL` substitution variable.

## Test markers

| Marker | Meaning |
|--------|---------|
| `smoke` | Quick (< 30 s) post-deploy sanity checks. Always run in CI. |

## Adding tests

- Gate new tests with `@pytest.mark.smoke` (or a new marker).
- Use the `base_url` and `page` fixtures from `conftest.py`.
- Keep each test independently runnable — no shared state between tests.

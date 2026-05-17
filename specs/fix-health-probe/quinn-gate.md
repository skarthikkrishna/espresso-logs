# Quinn Gate — fix-health-probe

**status: APPROVED_WITH_NOTES**
**date: 2025-07-14**
**reviewer: Quinn (pre-implementation gate)**

---

## Change Summary

- **Fix A:** Add `GET /health` to `app/routers/health.py` — unauthenticated, returns `{"status": "ok"}` with HTTP 200.
- **Fix B:** Add `--startup-probe=httpGetPath=/health,httpGetPort=8080` (or equivalent) to the `gcloud run deploy` step in `cloudbuild.yaml` (lines 130–152).

---

## Risk Assessment

**Overall risk: LOW**

### Fix A — `/health` endpoint

- Pattern is 100% established. `app/routers/health.py` already implements `/livez` and `/readyz` with identical signatures, return types, docstrings, and response shape.
- Router is already registered in `app/main.py` via `app.include_router(health.router)` — no main.py changes required.
- The unauthenticated surface is minimal: a static JSON response with no app state, no dependencies, no auth context. Attack surface is equivalent to the existing livez/readyz endpoints.
- Root cause is confirmed: the SPA catch-all at `/{full_path:path}` requires `CurrentUser`, which raises `_RequiresLogin` → 302 redirect. Cloud Run's startup probe treats a non-2xx as a failed probe, causing deploy timeout. Adding the `/health` route ahead of the catch-all resolves this.

### Fix B — cloudbuild.yaml startup probe flag

- Purely additive config change. No application logic touched.
- Pinning the probe path to version control is the correct practice; it prevents console drift and makes the contract explicit.
- The `--startup-probe` flag syntax must be verified against the installed `gcloud` version in the Cloud Build worker. Acceptable alternatives: `--startup-probe` (GA) or the equivalent `--container` flag if using split-traffic syntax. Either is low risk.

---

## Test Coverage Assessment

**⚠️ NOTE — tests MUST be added as part of Fix A.**

The context note claiming `/livez` and `/readyz` have no tests is **incorrect**. `tests/test_health.py` already contains:

- `test_livez_returns_ok` — asserts HTTP 200 and `{"status": "ok"}`
- `test_readyz_returns_ok` — asserts HTTP 200 and `{"status": "ok"}`
- `test_livez_content_type` — asserts `application/json` content-type

The new `/health` endpoint must have equivalent coverage. The established pattern is:

```python
async def test_health_returns_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

async def test_health_content_type():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert "application/json" in response.headers["content-type"]

async def test_health_unauthenticated():
    # Verify the endpoint is reachable without a session cookie — this is the
    # property that makes it safe as a Cloud Run startup probe.
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test", follow_redirects=False
    ) as client:
        response = await client.get("/health")
    assert response.status_code == 200  # NOT a 302 redirect
```

The unauthenticated test is the most important: it directly validates the property that unblocks Cloud Run deploys and should be added in `tests/test_auth.py` alongside the existing T011 assertions for `/livez` and `/readyz`.

---

## Required Conditions Before Merge

1. **Tests added** — `tests/test_health.py` must include the three test functions above (or equivalent). The unauthenticated assertion may go in `tests/test_auth.py` T011 alongside the existing livez/readyz checks.
2. **All four local CI checks pass** — ruff check, ruff format --check, mypy --strict, pytest (excluding e2e).
3. **cloudbuild.yaml flag syntax verified** — confirm `--startup-probe` flag is supported in the `gcr.io/google.com/cloudsdktool/cloud-sdk:slim` image used in the deploy step. If not available, document the fallback syntax in a comment.

---

## Items That Are NOT Blockers

- The pre-existing absence of `test_health_unauthenticated` for `/livez` and `/readyz` — this is out of scope for this fix. A follow-up task to backfill that assertion is recommended but does not block this change.
- The `@pytest.mark.asyncio` decorator visible in `test_health.py` — `pytest-asyncio` is configured in `auto` mode so the markers are redundant but harmless. Implementer should follow existing style (include the marker if already present in the file).

---

## Gate Decision

**APPROVED_WITH_NOTES**

The implementation may proceed. The notes above are **required conditions**, not suggestions. Implementation is not complete until:
- Tests are added (condition 1 above)
- All four CI checks pass (condition 2 above)

Fix B (cloudbuild.yaml) is approved unconditionally — the syntax caveat in condition 3 is a verification step, not a blocker.

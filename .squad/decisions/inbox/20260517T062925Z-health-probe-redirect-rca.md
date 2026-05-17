# Decision Drop — Cloud Run Health Probe 302 Redirect: Root Cause Analysis

**Date:** 2026-05-17T06:29:25Z  
**Agent:** Tariq  
**Status:** DIAGNOSIS COMPLETE — fix required before next deploy  
**Type:** Deployment failure RCA

---

## Symptom

Cloud Run probes `GET /health` on the new revision and receives `302 Found` (redirect to `/auth/login`). Cloud Run requires a 2xx response to declare the revision healthy. The revision remains in "Deploying" state until the deploy step times out.

---

## Root Cause

### There is no `/health` route in the application.

`app/routers/health.py` exposes only two unauthenticated endpoints:

```
GET /livez   → {"status": "ok"}
GET /readyz  → {"status": "ok"}
```

`GET /health` is not defined. It was never defined — `git log` shows `health.py` has existed unchanged since the initial commit (`ed413fe`).

### What happens when Cloud Run probes `/health`

1. Request hits FastAPI. No router matches `/health`.
2. Falls through to the SPA catch-all in `app/main.py`:
   ```python
   @app.get("/{full_path:path}", include_in_schema=False)
   async def spa_catch_all(full_path: str, _user: CurrentUser) -> HTMLResponse:
   ```
3. `CurrentUser` → `_get_current_user(request)` → no session cookie on a Cloud Run probe → raises `_RequiresLogin`.
4. `requires_login_handler` in `app/main.py` catches `_RequiresLogin`:
   ```python
   @app.exception_handler(_RequiresLogin)
   async def requires_login_handler(request: Request, exc: _RequiresLogin) -> RedirectResponse:
       return RedirectResponse(url="/auth/login", status_code=302)
   ```
5. Cloud Run receives `302` → not 2xx → health check failure → deploy timeout.

### Why `cloudbuild.yaml` doesn't protect against this

The `gcloud run deploy` step in `cloudbuild.yaml` does not specify `--startup-probe` or any health check path. Cloud Run inherits whatever probe is persisted in the service's existing configuration. This configuration is set outside `cloudbuild.yaml` — most likely via the GCP Console or a prior `gcloud` invocation that explicitly set an HTTP startup probe at `/health`.

### Why it worked before

The most likely explanation: the Cloud Run service originally used **TCP probing** (the default for Cloud Run Gen1, and the initial Cloud Run Gen2 default when no probe is configured). TCP probing only checks that the container is listening on port 8080 — it doesn't make an HTTP request. This always succeeds once the app starts.

Something changed the probe to **HTTP GET `/health`** — either:
- A manual change in the GCP Console (Health checks tab on the revision or service)
- A previous `gcloud run deploy` call that included `--startup-probe=httpGet.path=/health`
- A Cloud Run platform update that changed default probe behaviour for this service generation

Once set, this probe configuration persists across all deployments because `cloudbuild.yaml` never explicitly configures or resets it.

---

## Evidence Summary

| Finding | File | Detail |
|---|---|---|
| No `/health` route | `app/routers/health.py` | Only `/livez` and `/readyz` defined |
| SPA catch-all requires auth | `app/main.py:196` | `CurrentUser` dependency on `/{full_path:path}` |
| Auth failure → 302 | `app/main.py:131-133` | `_RequiresLogin` → `RedirectResponse(url="/auth/login", status_code=302)` |
| No probe config in CI | `cloudbuild.yaml:125-152` | `gcloud run deploy` step has no `--startup-probe` flag |
| `/health` never existed | `git log -- app/routers/health.py` | Single commit: `ed413fe` initial commit |

---

## Fix Options

### Option A — Add `/health` to the application (recommended primary fix)

Add an unauthenticated `GET /health` route to `app/routers/health.py`:

```python
@router.get("/health")
async def health() -> JSONResponse:
    """Cloud Run startup probe — returns 200 as long as the process is running."""
    return JSONResponse({"status": "ok"})
```

**Pros:** Application explicitly handles the probe path. Works regardless of what probe path is configured in Cloud Run or any other infrastructure. Zero config change required in Cloud Build or GCP Console.

**Cons:** Slightly duplicates `/livez` functionality. (Acceptable — the paths serve different audiences: Cloud Run infrastructure vs Kubernetes-style tooling.)

### Option B — Pin the startup probe in `cloudbuild.yaml` (recommended defence-in-depth)

Add `--startup-probe=httpGet.path=/livez,port=8080` to the `gcloud run deploy` step:

```yaml
- '--startup-probe=httpGet.path=/livez,port=8080'
```

This makes the probe configuration explicit and version-controlled. Any manually-set probe in the GCP Console will be overridden on the next deploy.

**Pros:** Infrastructure-as-code — probe path is declared in the repo, not hidden in GCP Console. Explicit intent.  
**Cons:** Requires an operator to push a change to trigger the override.

### Recommendation

**Apply both.** A is the immediate unblock — it makes the app respond 200 on any probe path the infra team has configured. B is the long-term guard — it pins the probe to `/livez` in source and prevents this class of misconfiguration from recurring.

Do not apply B alone: if the GCP Console probe is still set to `/health`, B only fixes the probe on the next deploy. If Option A is applied first, both `/health` and `/livez` respond 200 and the deploy unblocks immediately.

---

## Action Required

1. **Alex or Karthik** to implement Fix A (`GET /health` in `health.py`) — one-line change, no auth, no deps.
2. **Karthik** to add Fix B (`--startup-probe` in `cloudbuild.yaml`) as the follow-up defence.
3. Verify by re-triggering the Cloud Build pipeline after Fix A is merged to main.

**Blocked state:** Every deploy will fail until Fix A or an equivalent probe reconfiguration (pointing `/health` to `/livez` via a Cloud Run console update) is in place.

---

## Out of Scope

- Investigating the exact mechanism that changed the probe to `/health` (Cloud Run console audit log would show this but is not accessible from this repo)
- Changing the existing `/livez` or `/readyz` routes
- Any changes to auth middleware or `_RequiresLogin` handling

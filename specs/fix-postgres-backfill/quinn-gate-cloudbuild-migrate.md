---
status: APPROVED_WITH_NOTES
---
# Quinn Gate — Cloud Build Migrate Step Fix (curl → proxy image)

**Commit:** `a7c5c2a` (`fix(deploy): use cloud-sql-proxy image in migrate step — slim uv image has no curl`)
**Branch:** `main` (local, not pushed)
**Reviewed by:** Quinn
**Date:** 2025-07-09
**Scope:** `cloudbuild.yaml` — `migrate-proxy-install` and `migrate` steps only

---

## Summary

Tariq's split of the single `migrate` step into `migrate-proxy-install` + `migrate` is the correct solution to the `curl: command not found` failure. The proxy binary is now sourced directly from the official image rather than downloaded at runtime, which also eliminates the external network dependency during migration. The change is approved with three notes, none of which block the push.

---

## Finding 1 — Correctness ✅

**The proxy will be running before alembic connects.**

`migrate-proxy-install` copies `/cloud-sql-proxy` from `gcr.io/cloud-sql-connectors/cloud-sql-proxy:2` into `/workspace/cloud-sql-proxy`. `/workspace` is the Cloud Build shared volume, so the binary is available to the `migrate` container without any download step.

Inside `migrate`:
```bash
chmod +x /workspace/cloud-sql-proxy
mkdir -p /cloudsql
/workspace/cloud-sql-proxy --unix-socket=/cloudsql $_CLOUDSQL_INSTANCE &
PROXY_PID=$$!
sleep 3
uv run alembic upgrade head
kill $$PROXY_PID || true
```
Cloud Build substitutes `$_CLOUDSQL_INSTANCE` before the shell executes, so the proxy receives the correct instance name. The Unix socket at `/cloudsql/<instance>` matches the path DATABASE_URL must reference at runtime — consistent with the Cloud Run `--add-cloudsql-instances` flag on the deploy step.

---

## Finding 2 — Security ✅

`migrate-proxy-install` carries no `secretEnv` — it only copies a binary. Correct.

`migrate` carries `secretEnv: ['DATABASE_URL']` — the only secret it needs. `APP_SECRETS` is not present in this step. Correct.

No secret over-exposure in either step.

---

## Finding 3 — Idempotency / Orphan Proxy on Failure ✅ (with note)

With `set -e` at the top of the migrate script, if `uv run alembic upgrade head` exits non-zero the shell exits immediately and `kill $$PROXY_PID || true` never runs.

**This is not a defect.** Cloud Build runs each step in an isolated container. When the container exits — for any reason, success or failure — the container runtime terminates all remaining processes in the container's PID namespace. The proxy is cleaned up by the runtime. There is no orphan process risk across steps.

The `kill $$PROXY_PID || true` line is correct as graceful pre-exit cleanup for the success path (allows the proxy to flush connections cleanly). It is advisory on the failure path.

**Note:** The inline comment could make this explicit — see Note 1 below.

---

## Finding 4 — `waitFor` wiring ✅

Verified in full file:
- `migrate-proxy-install` → `waitFor: ['push']` ✓
- `migrate` → `waitFor: ['migrate-proxy-install']` ✓
- `deploy` → `waitFor: ['migrate']` ✓

The pipeline ordering is: `push` → `migrate-proxy-install` → `migrate` → `deploy`. A failed migration will block deploy. Correct.

---

## Finding 5 — `$$` shell variable escaping ✅

All shell variables that must NOT be substituted by Cloud Build use `$$`:
- `$$!` → `$!` (last background PID) ✓
- `$$PROXY_PID` → `$PROXY_PID` ✓

`$_CLOUDSQL_INSTANCE` correctly uses a single `$` — it IS a Cloud Build substitution variable and should be expanded by Cloud Build before the shell sees the script. Escaping is consistent throughout the migrate step and matches the pattern used in all other bash steps in the file.

---

## Finding 6 — Floating image tag (minor risk)

`gcr.io/cloud-sql-connectors/cloud-sql-proxy:2` is a floating major-version tag. Between two builds, `:2` could resolve to a different patch release of the proxy. This is standard practice for this image (Google uses `:2` as the recommended stable reference), and the tradeoff (automatic patch/security updates vs. strict pinning) is acceptable for CI. Not a blocker.

---

## Notes

### Note 1 — `sleep 3` startup delay is fragile (low severity)

The `sleep 3` hardcodes a 3-second window for the proxy to initialise its Unix socket. On normal Cloud Build infrastructure this is sufficient — the Cloud SQL Auth Proxy v2 typically establishes the socket in well under a second. However, on resource-contended runners or cold-start conditions it could fail silently, causing alembic to report a socket-not-found connection error that looks like a database misconfiguration.

**Recommendation:** Replace with a readiness poll before the next time this step is touched:
```bash
until [ -S /cloudsql/$_CLOUDSQL_INSTANCE ]; do sleep 0.5; done
```
This waits until the proxy's Unix socket file exists before proceeding. Not a blocker for this push — `sleep 3` has been the established pattern for this step and the risk is low in practice.

### Note 2 — Proxy cleanup comment could be clearer

The comment block above the migrate step (lines 84–91) describes the split correctly but does not explain that the proxy is cleaned up by the container lifecycle on failure. A one-liner noting this would prevent future readers from incorrectly concluding that `set -e` causes an orphan proxy leak. Not a blocker.

### Note 3 — Binary path in proxy image assumed, not verified in CI

The step assumes `/cloud-sql-proxy` is the binary path inside `gcr.io/cloud-sql-connectors/cloud-sql-proxy:2`. This is correct per the official image spec and has been the stable path since the v2 rewrite. If Google ever relocates the binary, the `cp` step would fail early with a clear error, which is acceptable behaviour. Not a blocker.

---

## Verdict

**APPROVED_WITH_NOTES** — push to remote is clear.

Note 1 (`sleep 3`) is a known-fragile pattern worth addressing in a future cleanup pass, but the risk is low and does not block this fix. Notes 2 and 3 are informational only.

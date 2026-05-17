# Decision Drop — Cloud Build Shell Variable Escape Fix

**Date:** 2026-05-17  
**Agent:** Tariq (CI/CD)  
**Type:** Hotfix  
**Status:** Committed (not pushed)

## Context

Deploy workflow run 25978094988 failed at submission time with:

```
ERROR: (gcloud.builds.submit) INVALID_ARGUMENT: generic::invalid_argument:
invalid value for 'build.substitutions': key in the template "PROXY_PID"
is not a valid built-in substitution
```

## Root Cause

In the `migrate` step of `cloudbuild.yaml`, the shell script used `$!` and `$PROXY_PID` as
POSIX shell variables to track the Cloud SQL Auth Proxy PID. Cloud Build parses **all** `$VAR`
references in step `args` as substitution variables at submission time — before the shell
ever executes. `PROXY_PID` is not a declared substitution variable, so the build was rejected
before any step ran.

## Decision

Escape both shell variable references with `$$` syntax (Cloud Build's escape sequence for a
literal `$` passed through to the shell):

- `PROXY_PID=$!`  →  `PROXY_PID=$$!`
- `kill $PROXY_PID || true`  →  `kill $$PROXY_PID || true`

`$_CLOUDSQL_INSTANCE` on the same line is a declared substitution variable and requires no
change.

## Validation

All four local CI checks passed after the fix:
- `ruff check` — ✅ All checks passed
- `ruff format --check` — ✅ 110 files already formatted
- `mypy --strict` — ✅ No issues found in 53 source files
- `pytest` — ✅ 403 passed, 4 skipped

## Commit

`fix(deploy): escape shell variables in cloudbuild migrate step`

## Rule Applied

Cloud Build YAML convention: shell variables in multi-line bash `args` must use `$$VAR`
syntax to prevent Cloud Build from interpreting them as substitution variables at submission time.

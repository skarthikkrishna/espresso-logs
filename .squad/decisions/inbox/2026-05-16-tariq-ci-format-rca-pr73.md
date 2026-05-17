# RCA: CI/format Failure on PR #73 — hotfix/beans-catalog-brew-log

**Author:** Tariq  
**Date:** 2026-05-16  
**Run ID:** 25954236107  
**PR:** #73  
**Branch:** hotfix/beans-catalog-brew-log  
**Failing job:** `CI/format`  
**Status:** Root cause identified. No fix applied. Awaiting operator authorisation.

---

## What Failed

```
Would reformat: app/routers/api_catalog.py
1 file would be reformatted, 109 files already formatted
Process completed with exit code 1
```

`ruff format --check app/ tests/` exits 1 because `app/routers/api_catalog.py` does not
comply with ruff's output format. All other 109 files pass.

---

## Why It Failed

**Proximate cause:** Commit `1e9a15c0ba24e4f81b695c562c533639a2449ad7` ("ci: force
synchronize event on PR #73") appended a trailing blank line to the end of
`app/routers/api_catalog.py`.

**Exact change:**
```diff
-    return JSONResponse({"image_path": image_path})
+    return JSONResponse({"image_path": image_path})
+
```

The file now ends with two newline characters (`\n\n`) — a blank trailing line after the
final statement. Ruff's formatter requires exactly one trailing newline with no blank line
after the last code line. The extra blank line causes ruff to report the file as needing
reformatting.

**Verified locally:**
```
$ uv run ruff format --check app/ tests/
Would reformat: app/routers/api_catalog.py
1 file would be reformatted, 109 files already formatted
Exit code: 1
```

---

## Scope

- **Only one file is affected:** `app/routers/api_catalog.py`, line 470 (trailing blank line).
- All other CI jobs (lint, mypy, pytest) pass. This is an isolated formatting issue.
- No logic, types, or tests are involved.

---

## Minimal Fix (authorisation required before applying)

Remove the trailing blank line from `app/routers/api_catalog.py` so the file ends with
exactly one newline after `return JSONResponse({"image_path": image_path})`. Equivalently,
run `uv run ruff format app/routers/api_catalog.py` and commit the result.

After the fix:
```
$ uv run ruff format --check app/ tests/
110 files already formatted
Exit code: 0
```

---

## Decision

**No fix has been applied.** This RCA is submitted to the coordinator for authorisation
per Inviolable Rule 3 (build failures trigger Tariq triage before any fix attempt).

The fix is trivial and self-contained. Once authorised, it can be committed directly on
`hotfix/beans-catalog-brew-log` with a `[skip ci]` commit message prefix, then CI should
be re-triggered on the resulting push to confirm green.

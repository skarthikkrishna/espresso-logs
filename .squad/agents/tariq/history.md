# Tariq — History

## 2026-05-06 — Onboarded

Joined coffee_tracker squad as TPM. Reviewed existing architecture and noted the project is at a multi-tenancy inflection point: the v1 single-user/single-Sheets model needs to evolve to support household-level multi-tenancy, proper database isolation, and a scalable auth model within a $0–$50/month cost envelope.

First task: contribute to v2 functional and engineering architecture specifications alongside Maya (Principal Engineer) and Priya (PM).

Current constraints:
- $50/month hard ceiling at peak traffic
- One-engineer operability requirement
- Must support future iOS/Android native app path without requiring a full rewrite
- Data migration from Google Sheets to a proper database is the critical path item

## 2026-05-06 — v2 spec review & amendments

Reviewed both `docs/requirements/functional-spec-v2.md` and `docs/requirements/engineering_architecture_v2.md` against TPM constraints. Made targeted amendments directly to both files.

## Learnings

### Cost model confirmed safe
- Cloud SQL db-f1-micro (~$7.67/month always-on) + Cloud Run (scale-to-zero) + all supporting services = ~$9.50 baseline, ~$14 peak (db-f1-micro), ~$35 peak (db-g1-small upgrade). Both peak scenarios are comfortably under the $50 ceiling.
- The db-g1-small upgrade is driven by connection count, not traffic volume. At 1,000 req/day (~0.7 req/min avg), Cloud Run rarely spins up >1 instance. db-f1-micro is very likely sufficient indefinitely at this scale.
- Cloud SQL backup costs are negligible: daily pg_dump of a small DB to GCS is <$0.01/month.
- Cloud SQL Auth Proxy connections from Cloud Run are free (no additional networking charge).

### Role naming is a cross-cutting concern — get it right before any implementation
- Maya used `manager`; Priya used `admin`. The functional spec (product doc) wins: all implementations must use `admin`.
- Lesson: PM and engineer should agree on role names before any architecture doc is written. Add a terminology section to the constitution.

### Catalog tenancy: spec beats architecture
- Architecture initially treated catalog as a global shared reference table. Functional spec explicitly defines it as household-scoped. Product intent is clear: households are fully isolated, including their bean library. The architecture was amended to match.

### Missing users table was a silent gap
- The architecture had no first-class `users` table — user identity lived as a TEXT field in `household_members`. The functional spec requires a full `User` entity (display_name, picture_url, last_seen_at). This was caught in review. Always check that every entity in the spec has a corresponding table in the architecture.

### Email delivery must be optional for operability
- Token-based invitation is already the right pattern. Requiring SMTP for MVP creates an operational dependency (credential management, deliverability testing) that blocks single-engineer deployment. The graceful-degradation NFR-D7 is the right call: attempt SMTP, fall back to out-of-band token sharing with a UI warning.

### Secret rotation requires Cloud Run redeploy
- Adding a new secret version to GCP Secret Manager does NOT automatically update a running Cloud Run service. The service must be redeployed (or updated via `gcloud run services update --update-secrets=...`) to pick up the new version. This is a common operational pitfall.

### Phase M5 naming was inconsistent between §7.1 and §10
- §7.1 called it "Write-only Postgres"; §10 described "Household and Roles". Both were right for different aspects of the same phase. The fix: merge them — M5 is "Household, Roles & Sheets write-disable" so the phase is both described and named consistently.

### Monitoring gap: no "2am broken" signal
- Both architecture and functional spec were silent on proactive alerting. Cloud Monitoring Uptime Check on `/health` with email alerting is free and takes 10 minutes to set up. Always require a monitoring minimum as part of any launch-gate checklist.

## 2026-05-15 — Issue #66: Pre-push check script created

Created `scripts/pre-push-check.sh` with all four required CI checks (ruff check, ruff format, mypy strict, pytest). Script runs checks in order with clear section headers and exits immediately on failure. Added `make pre-push` target to Makefile. File is executable and staged, ready for coordinator commit after CI verification.

### Key decision: Early exit pattern
- Used `set -e` at top and explicit `on_failure` helper function for clear error reporting
- Each check section prints `[N/4]` header for visibility
- SPREADSHEET_ID=dummy is set for pytest as required by copilot-instructions.md
- Script runs from repo root using `git rev-parse --show-toplevel` for robustness


---

## 2026-05-21: M5 Spec-034 Task Sequencing & Operability

**Scope:** Tasks + Runbook  
**Status:** COMPLETE  
**Commits:** 1 (tasks)

### Work Summary

- **Task Generation:** Created 34 tasks across 5 waves
  - Wave 1: Backend auth infrastructure + schema migration (hard gate)
  - Waves 2-5: Frontend UI, permission enforcement, testing, release
- **Dependency Validation:** Backend tasks gate frontend; hard dependencies honored
- **Operability:** Updated runbook with deployment checklist, rollback procedures, infrastructure requirements
- **Decision Record:** Documented task sequencing rationale (decision drop)

### Key Outputs

- `specs/034/tasks.md` — committed (34 tasks, 5 waves)
- `docs/runbooks/spec-034-deployment.md` — updated
- `.squad/decisions.md` — merged task sequencing decision

### Handoff

Tasks ready for Quinn gate. Wave 1 → 2 gate transition coordinated via run-book. Implementation fan-out ready.

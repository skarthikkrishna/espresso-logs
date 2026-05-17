---
updated_at: 2026-05-15T00:00:00Z
focus_area: Production hotfix for catalog/brew log/inventory — espresso-logs PR #73 open, awaiting review and merge
active_issues:
  - pr: 73
    repo: espresso-logs
    status: open
    branch: hotfix/beans-catalog-brew-log
---

# What We're Focused On

## Active Work — Hotfix: Catalog / Brew Log / Inventory

**PR #73 open** (`hotfix/beans-catalog-brew-log → main`) — CI green, `@copilot` review requested. Awaiting review and merge.

### Context

- IAM grants are live: tf-infra PR #26 merged, `terraform apply` succeeded.
- Migrations 0005 + 0006 already applied to production manually.

## Open / Next

1. **espresso-logs PR #73** — merge when review is approved.
2. **After merge (operator action):** Set Cloud Build trigger substitution `_CLOUDSQL_INSTANCE` to `espresso-logs-prod:us-west1:espresso-logs-db`.
3. **After deploy:** Verify catalog, brew log, and add-bean are working in production.

## Completed

- M4 DONE: PR #62 merged. Production migration complete. 75 brew logs live in Cloud SQL. System reads from Postgres in production.
- ADR-001 (household transition strategy) committed to `docs/architecture/adr-001-household-transition.md`.

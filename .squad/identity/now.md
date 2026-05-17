---
updated_at: 2026-05-17T00:00:00Z
focus_area: Spec 031 (brew log duplication + missing AI feedback) — implemented, PR #76 open awaiting CI + Copilot review
active_issues:
  - pr: 76
    repo: espresso-logs
    status: open
    branch: fix/031-brew-log-duplication-missing-ai
---

# What We're Focused On

## Active Work — Spec 031: Brew Log Duplication + Missing AI Feedback

**PR #76 open** (`fix/031-brew-log-duplication-missing-ai → main`) — implementation complete, awaiting CI green and `@copilot` review before merge.

### Context

- Spec 031 addresses two linked issues: duplicate brew log entries being created on submission, and AI tasting feedback not appearing after a brew is logged.
- Alex is running a diagnostic script to audit existing duplicate brew log entries in the production dataset.

## Open / Next

1. **espresso-logs PR #76** — wait for CI + Copilot review; merge when approved.
2. **After PR #76 merges:** Run Alex's diagnostic script against production to identify and clean up pre-existing duplicate brew log entries.
3. **Post-deploy:** Verify brew log submission creates exactly one entry and AI feedback renders correctly.

## Completed

- PR #73 merged (`hotfix/beans-catalog-brew-log`) — catalog, brew log, and inventory hotfix live.
- M4 DONE: PR #62 merged. Production migration complete. 75 brew logs live in Cloud SQL. System reads from Postgres in production.
- ADR-001 (household transition strategy) committed to `docs/architecture/adr-001-household-transition.md`.

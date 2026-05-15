---
updated_at: 2026-05-15T00:00:00Z
focus_area: M4 complete — Postgres read switchover in production; M5 planning pending
active_issues: []
---

# What We're Focused On

## Recent Completion — M4: PostgreSQL Read Switchover

**M4 DONE.** PR #62 merged. Production migration complete. 75 brew logs live in Cloud SQL. System is now reading from Postgres in production.

- Dual-write mode active: Sheets still written to; Postgres is the authoritative read source.
- ADR-001 (household transition strategy) committed to `docs/architecture/adr-001-household-transition.md`.
- All governance artifacts for M4 committed and pushed.

## Active Work

No active in-progress work items.

## Open / Next

- **M5 planning:** Data cleanup phase — enum allowlists, data quality. Not yet started.
- **Auth/household milestone:** Not yet planned. ADR-001 documents the transition constraint and open questions.
- **GitHub issue cleanup:** Close issues #64, #66, #67, #68, #69 referencing PR #62.
- **ADR-001 open questions:** Single-user vs multi-tenant decision needed from Krishna before auth milestone can be planned.

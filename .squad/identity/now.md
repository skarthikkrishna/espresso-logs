---
updated_at: 2026-05-15T03:18:07Z
focus_area: M4 read switchover — P1+P2 complete on feat/m4-prerequisites, awaiting Quinn re-gate + P3 backfill decision
active_issues: []
---

# What We're Focused On

## Current State (M4 Prerequisites)

**P1 — ORM + SQL Repo Writes:** ✅ Complete. All 5 ORM models updated with migration-0004 columns; migration 0005 ready. All 5 SQL repos rewritten with upsert-by-sheets_id pattern + v2 column writes.

**P2 — Async Read Path:** ✅ Complete. All 5 SQL repos have async `list()` / `get()`. All 5 DualWrite wrappers delegate to `self._sql` when `use_postgres=True`. All routers/services await read calls. 399 tests passing.

**Quinn Gate:** 🔴 BLOCKED — 3 findings: (1) migration 0005 artifact missing, (2) integration test missing, (3) P3 backfill plan decision required.

**Branch:** feat/m4-prerequisites — 7 commits staged locally, not pushed. Awaiting Karthik P3 decision + Quinn re-gate.

**Next Phase:** (1) Karthik decides M4 backfill scope, (2) Alex resolves Quinn blockers if decision proceeds, (3) Quinn re-gates, (4) P3 read switchover implementation begins.

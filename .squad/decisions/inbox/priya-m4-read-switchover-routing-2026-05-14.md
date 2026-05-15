### 2026-05-14: Routing decision — m4 read switchover
**By:** Priya (routing agent)
**What:** DIRECT_PERMITTED — M4 Read Switchover is execution of a pre-specified, pre-architected migration milestone. No new product scope. Implementation plan is already defined in `docs/requirements/engineering_architecture_v2.md` (§ Phase M4). All infrastructure is already in place: SQL repos have `list()`/`get()` read methods, `USE_POSTGRES` flag exists in `app/config.py`, and `self._sql` is injected into all five `_DualWrite*` wrappers in `app/deps.py`.
**Why:** The change is narrowly bounded — flip the read path in all five `_DualWrite*` classes in `app/deps.py` from `self._sheets` to `self._sql` when `settings.use_postgres=True`, with `self._sheets` fallback when `False`. Update tests to cover both read paths. Quinn gate is still required before implementation (touches application code). M3 backfill + validation must be confirmed complete before `USE_POSTGRES=true` is set in Cloud Run prod env.

**Scope:**
- `app/deps.py` — `list()`, `get()`, `list_*()` read methods in `_DualWriteCatalogRepo`, `_DualWriteBrewLogRepo`, `_DualWriteInventoryRepo`, `_DualWriteHardwareRepo`, `_DualWriteMaintenanceRepo`
- `tests/` — coverage for both `use_postgres=True` and `use_postgres=False` read paths
- No router, service, frontend, or schema changes required

**Gates:**
- Quinn gate required (application code change)
- M3 backfill completion must be verified before flipping env var in prod

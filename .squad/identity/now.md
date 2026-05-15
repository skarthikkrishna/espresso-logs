---
updated_at: 2026-05-15T02:48:50Z
focus_area: E2E auth bypass prod guard, thread safety fixes, chip/badge design unification
active_issues: []
---

# What We're Focused On

## Recent Session Close-Out (chip-design-fix)

**Chip/Badge Design:** `<Chip />` component extracted and unified across frontend. Single amber frosted-glass style, design corrections applied (border-radius, padding). All 5 call sites updated.

**E2E Auth Bypass Production Guard:** Hard startup failure gate added. `E2E_AUTH_BYPASS=1` only permitted in `"test"` or `"local"` environments. Production deployment with bypass active fails immediately.

**Thread Safety Fixes:** E2E_SEED schema alignment corrected; `delete_by_pk` promoted to public BaseRepo method; private repo coupling in api_e2e.py refactored to use public interface.

**Next Phase:** Return to V2 product spec implementation tasks (M1–M6 phases). Household/role layer, auth middleware updates, multi-tenancy patterns.

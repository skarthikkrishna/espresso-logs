# ADR-001: Household Transition Strategy for Multi-User Auth

**Date:** 2026-05-15  
**Status:** Pending  
**Author:** Maya (Lead Architect)  
**Stakeholders:** Krishna, Alex (backend), Priya (product)

---

## Context

### Current State (M4 — Post-PostgreSQL Migration)

The app has just migrated from Google Sheets to PostgreSQL (M4, PR #62). The migration introduced a database schema with:

- **`system_user`** table: seeded with a single synthetic `system_user` (UUID: `11111111-1111-1111-1111-111111111111`)
- **`household`** table: seeded with a single synthetic `default_household` (UUID, associated with `system_user`)
- **Data tables** (`brew_log`, `catalog`, `inventory_bags`, `hardware_log`, `maintenance_log`): every row has a foreign key to `household.id`, all currently pointing to the `default_household` UUID

### Migration Flow

```python
# scripts/migrate_sheets_to_postgres.py

system_user = ensure_system_user(engine)  # Creates system_user
default_hh = ensure_default_household(engine, system_user.id)  # Creates default_household

# All Sheets data migrated into PostgreSQL with FK → default_household.id
```

### Auth Today

- Single-user app (effective): Google OAuth + email allowlist (`ALLOWLIST_EMAILS`)
- No concept of user ownership or household isolation
- All authenticated requests silently use the `default_household`

### The Problem

When real **multi-user auth + household management** arrives (future M-series milestone):
- The app will have many users, each with their own household
- Each user's data must be scoped to their household
- The `default_household` (and all its migrated data) must be **claimed by / reassigned to the first real authenticated user**
- This transition must happen without breaking foreign key constraints or deleting data

---

## Decision

### Primary Strategy: UPDATE-Based Reassignment

When the real auth milestone is built:

1. **Claim ownership via UPDATE, not delete+recreate:**
   - Do NOT delete the `default_household` or regenerate it
   - Do NOT move rows from `default_household` to a new household
   - Instead, UPDATE the `system_user` and `household` records to reflect real user identity

2. **Transition flow (pseudo-code):**
   ```python
   # On first login by real user (e.g., Krishna with email krishna@example.com):
   
   # Option A: CREATE a real user, adopt default household
   real_user = create_user(email='krishna@example.com', google_id=...)
   UPDATE household 
     SET owner_user_id = real_user.id 
     WHERE id = default_household_id
   # All rows remain in default_household; no data moves
   
   # Option B: Alias the default household to the real user
   # (If multi-tenancy is not needed, default_household becomes user.primary_household)
   ```

3. **Data preservation:**
   - All rows tagged with `default_household.id` remain in place
   - No FK updates needed—the UUID is unchanged
   - Foreign key constraints remain valid throughout the transition

4. **No row mutation:**
   - `brew_log`, `catalog`, `inventory_bags`, `hardware_log`, `maintenance_log` rows do **not** change their `household_id` FK
   - The data "belongs" to the same household; only ownership changes

---

## Consequences

### Benefits
- **Data integrity:** Foreign keys remain valid; no row updates needed
- **Simplicity:** One UPDATE per record (user + household), not bulk row migrations
- **Safety:** Low risk of data loss or orphaning during transition
- **Testability:** Can write idempotent migration tests

### Risks & Constraints

1. **Historical system_user must be handled:**
   - The synthetic `system_user` must either:
     - Be soft-deleted or marked as `archived`
     - Persist as a shadow user (not visible in UI)
   - Cannot delete—it is the creator/owner of the default_household record in audit logs

2. **Single-user assumption baked in:**
   - If the app later grows to support multiple households per person (shared households), this design assumes `household.owner_user_id` is 1:1
   - Scaling to `household_members` or group ownership requires a new schema

3. **Backwards compatibility:**
   - Any code querying by `household_id` will continue to work without change
   - But code assuming `system_user` exists must handle either deletion or archival

4. **Audit trail clarity:**
   - `created_by` / `updated_by` columns (if present) will show `system_user`, not the real owner
   - ADR-002 must define audit semantics for migrated data

5. **First-time-user experience:**
   - On first login, the app must detect "this is the first real user" and trigger the claim
   - Recommendation: use a feature flag or database check for idempotency

---

## Open Questions

1. **Single-user or multi-tenant?**
   - Will each household ever have multiple users with different permissions?
   - Will a household ever be owned by a group?
   - Or is this effectively a single-user app where household ≈ user?
   - **Resolution path:** Priya + Krishna to confirm product scope in M5 planning

2. **Multi-household per user?**
   - Can one user own multiple households?
   - Can a user join a household owned by someone else?
   - **Resolution path:** Confirm in functional spec before auth milestone

3. **Soft-delete or hard-delete of system_user?**
   - Should `system_user` be archived or removed from prod?
   - What if production data is ever re-imported from Sheets?
   - **Resolution path:** Decide in auth milestone planning; document in ADR-002

4. **Transition automation level?**
   - Should the first-user claim be:
     - Automatic on first login (simplest)?
     - Manual via admin command (safest)?
     - Triggered by a database migration (most explicit)?
   - **Resolution path:** Discuss in the auth milestone PR

5. **Audit semantics for legacy data?**
   - Should migrated rows show `created_by = system_user` or be retroactively attributed to the real user?
   - What about `updated_at` timestamps (Sheets timestamps are coarse)?
   - **Resolution path:** Define in ADR-002 (audit + timestamps)

---

## Implementation Checklist (Future)

When the multi-user auth milestone is built, follow this sequence:

- [ ] Define `owner_user_id` FK on `household` table (if not already present)
- [ ] Write idempotent migration script: `scripts/claim_default_household.py`
- [ ] Add integration test: "first real user can claim default household without data loss"
- [ ] Update queries: ensure all `SELECT` statements filter by `household_id` (or current user's household)
- [ ] Document user-facing onboarding: what happens on first login
- [ ] Define archival strategy for `system_user`
- [ ] Write ADR-002: audit trail and timestamps for migrated data
- [ ] Write ADR-003: multi-household / multi-user ownership model (if needed)

---

## References

- `scripts/migrate_sheets_to_postgres.py` — seed logic
- `scripts/_seed.py` — `ensure_system_user()`, `ensure_default_household()`
- `.squad/decisions.md` — multi-tenancy decision context
- `docs/requirements/sheet-schema.md` — data model baseline

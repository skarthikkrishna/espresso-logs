# Decision Drop: Household Transition Strategy

**Date:** 2026-05-15  
**From:** Maya (Lead Architect)  
**Topic:** Multi-user auth household transition  
**ADR:** `docs/architecture/adr-001-household-transition.md`

---

## Key Constraint

When the multi-user auth milestone arrives, the `default_household` (seeded in M4, now containing all migrated data) **must be claimed by the first real authenticated user via UPDATE, not delete+recreate**.

- **MUST:** UPDATE `household.owner_user_id` or similar to link the default household to a real user
- **MUST NOT:** Delete or recreate the `default_household` UUID—all foreign keys depend on it
- **MUST NOT:** Move data rows to a different household UUID

---

## Rationale

1. **Data safety:** Rows are already tagged with `default_household.id`. Moving them requires bulk UPDATE of all 5 data tables + audit trail updates.
2. **FK integrity:** Foreign key constraints remain valid if the household UUID is unchanged.
3. **Idempotency:** Simple UPDATE logic is easier to test and re-run without side effects.

---

## Implications for Future Work

1. **Auth milestone:** When implementing real user login, include a step to claim the default household for the first user.
2. **Audit trail (ADR-002):** Clarify whether migrated data retains `system_user` as creator or is retroactively attributed to the real owner.
3. **Multi-tenancy scope (Priya + Krishna):** Confirm whether the app will ever support:
   - Multiple households per user
   - Household groups or shared ownership
   - If no: simplify model to `household ≈ user`, no separate owner_user_id needed

---

## Open Questions for Team

- Is this effectively a single-user app (household ≈ user) or multi-tenant (multiple households)?
- Should `system_user` be soft-deleted, hard-deleted, or archived?
- Should the default household claim be automatic (on first login) or manual (admin command)?

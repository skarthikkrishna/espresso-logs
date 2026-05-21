---
author: tariq
created_at: 2026-05-21T06:03:35-07:00
spec_id: "034"
phase: speckit.tasks
---

# Tariq — M5 Tasks Sequencing Decisions

## Decision 1: DualWrite Sheets write-disable moved to Wave 1 (not Wave 3)

**Context:** plan.md placed Sheets write-disable at W3-A1 (Wave 3). The task prompt requested it in Wave 1.

**Decision:** Moved to Wave 1 (US-1.6). Rationale: the DualWrite write-path change in `deps.py` has zero dependencies on auth infrastructure. It is purely a code deletion. Doing it in Wave 1 reduces scope of the Wave 3 `deps.py` overhaul and makes the Sheets-disable observable in CI earlier.

**Impact:** Wave 3 `deps.py` work (US-3.1) touches different sections of `deps.py` from US-1.6. No merge conflict risk — US-1.6 modifies the `_DualWrite*` class methods; US-3.1 adds new dep functions below.

---

## Decision 2: oauth_states table included in migration 0007 (not a new 0008)

**Context:** plan.md §5.1 offered "migration 0007 or a new 0008" for `oauth_states`. Maya's compliance MF-001 says "add `oauth_states` table in migration 0007 (or 0008)."

**Decision:** Added to migration 0007. Rationale: 0007 is already the M5 schema delta; adding `oauth_states` to the same migration avoids a second migration that must land atomically with the SessionMiddleware removal. Single migration = single deployment unit. No production data at risk.

---

## Decision 3: ALLOWLIST deprecation warning in both config.py and main.py lifespan

**Context:** compliance AC-063 requires warning if ALLOWLIST_EMAILS env var is set.

**Decision:** Warning is emitted in `app/config.py` via a Pydantic `@field_validator` (US-1.5), so it fires at Settings construction time (import). Also reinforced in `app/main.py` lifespan (US-1.7) for operator visibility in startup logs. Belt-and-suspenders; does not duplicate logic — config validator logs at module import, lifespan logs at application start.

---

## Decision 4: RefreshTokenRepo is a separate file (app/repos/sql/refresh_tokens.py)

**Context:** plan.md folded refresh token operations into the auth service. Task prompt listed RefreshTokenRepo as a separate Wave 2 file.

**Decision:** RefreshTokenRepo is its own file (`app/repos/sql/refresh_tokens.py`, US-2.3), following the repository pattern (constitution §II). The auth service calls `RefreshTokenRepo` methods; it does not own DB operations directly. This keeps auth service pure (crypto only) and data access in repos.

---

## Decision 5: Total task count is 34

**Task breakdown:**
- Wave 1: US-1.1 to US-1.8 = 8 tasks
- Wave 2: US-2.1 to US-2.3 = 3 tasks
- Wave 3 (Alex): US-3.1 to US-3.6 = 6 tasks
- Wave 3 (Finn): US-3.7 to US-3.12 = 6 tasks
- Wave 4 (Quinn): US-4.1 to US-4.5 = 5 tasks
- Wave 4 (Finn): US-4.6 = 1 task
- Wave 5: US-5.1 to US-5.2 = 2 tasks
- Process: P.1 to P.3 = 3 tasks
- **Total: 34 tasks**

---

## Decision 6: MF-004 (invited_by FK fix) included in US-1.2 migration 0007

**Context:** MF-004 flags that `household_members.invited_by` incorrectly FKs to `household_members.id` (self-referential) instead of `users.id`.

**Decision:** The FK correction is included in migration 0007 DDL (drop old FK, re-add pointing to `users.id`). Also corrected in US-1.3 ORM models. This is the correct zero-downtime approach since `household_members` has no production data yet at M5 first deployment.

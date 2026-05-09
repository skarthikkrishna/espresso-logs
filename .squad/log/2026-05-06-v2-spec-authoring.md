# Session Log: V2 Spec Authoring — May 6, 2026

**Session ID:** 2026-05-06-v2-spec-authoring  
**Start Time:** 2026-05-06T22:51:03-07:00  
**Objective:** Initiate v2 product specification for household multi-tenancy concept

## Team Spawned

- **Priya** — Authoring `docs/requirements/functional-spec-v2.md`
- **Maya** — Authoring `docs/requirements/engineering_architecture_v2.md`
- **Tariq** — Code review (post-completion): cost, phasing, operability assessment

## User Request Summary

Multi-tenancy product redesign targeting household-level sharing:

### Product Constraints
- **Unit economics:** $50/month ceiling per household
- **Core concept:** Household multi-tenancy (shared settings, user roles, audit trail)

### Technical Decisions in Scope
- **Data persistence:** Migration strategy from Google Sheets to database (TBD)
- **Authentication:** IAP vs OAuth trade-offs
- **Infrastructure:** Cloud Run vs GKE evaluation

## Deliverables

1. **Functional Spec v2** — Product behaviour, entities, user workflows for household tenancy
2. **Engineering Architecture v2** — Database schema, multi-tenancy isolation, auth flow, hosting topology
3. **Technical Review** — Cost analysis, phasing roadmap, operational readiness

## Notes

- Sequential handoff: Priya → Maya → Tariq
- All specs to reference cost ceiling and migration constraints
- Decision log to track IAP/OAuth and Cloud Run/GKE rationale

---

## Completion Log (Scribe)

**Date:** 2026-05-06  
**Time:** 22:51 – 23:09  

### All Agents Complete

**Priya (Product Manager):** ✅ DELIVERED  
- `docs/requirements/functional-spec-v2.md` (~8,800 words, 11 sections)  
- 8 functional decisions (PD-V2-01 through PD-V2-08)

**Maya (Principal Engineer):** ✅ DELIVERED  
- `docs/requirements/engineering_architecture_v2.md` (~4,900 words, 12 sections)  
- 6 architecture decisions (AD-V2-01 through AD-V2-06)

**Tariq (TPM, Reviewer):** ✅ DELIVERED  
- Comprehensive post-completion review of both docs
- **7 documented amendments:**
  1. **DEC-T01:** Role terminology — `admin` (canonical, not `manager`)
  2. **DEC-T02:** Catalog scoping — household-scoped (not global)
  3. **DEC-T03:** `users` table — first-class entity required
  4. **DEC-T04:** Email delivery — optional SMTP for MVP
  5. **DEC-T05:** Phase M5 renamed — "Household, Roles & Sheets write-disable"
  6. **DEC-T06:** Cost model — db-f1-micro confirmed within $50 ceiling
  7. **DEC-T07:** Cloud Monitoring — Uptime Check go-live requirement

### Decision Inbox Merged

- `.squad/decisions/inbox/priya-functional-spec-v2-decisions.md` → merged, archived
- `.squad/decisions/inbox/maya-architecture-v2-decisions.md` → merged, archived
- `.squad/decisions/inbox/tariq-v2-review-decisions.md` → merged, archived
- All 22 decisions consolidated in `.squad/decisions.md` with deduplication
- Inbox directory cleaned

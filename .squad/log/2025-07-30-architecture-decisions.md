# 2025-07-30: Architecture Decisions — Q1 Zones, Q2 Roast, Q3 LLM Enrichment

**Session Date:** 2025-07-30  
**Attendees:** Maya (Architecture), Finn (Frontend), Alex (Backend, new), Priya (PM)  
**Session Type:** Architecture Working Group  

## What We Decided

Three concurrent architecture questions resolved in a single decision cycle:

### Q1: ZoneBoundaries (Finn + Maya)
Frontend-only TypeScript constants utility. CompassChart gets optional `zoneBoundaries` prop; backward-compatible default (equal-thirds model). **No backend schema changes.**

### Q2: roast_level (Alex + Maya)
Field already exists end-to-end (Python and TypeScript layers). No new columns, no form changes. **Ready to use in inference enrichment.**

### Q3: LLM Enrichment (Alex + Maya + Priya)
Fire-and-forget inference pattern continues; enrich prompt with machine_name, basket_name, roast_level (server-resolved), zone_taste (client-sent). Persist Zone_Taste to Brew_Log. Frontend polls for feedback.

## Key Outcomes

1. **Frontend:** ZoneBoundaries utility ready; CompassChart extensible; no breaking changes to 87 tests
2. **Backend:** roast_level confirmed end-to-end; inference enrichment pattern locked; Zone_Taste column planned
3. **Payload:** _BrewLogCreateBody extended with zone_taste field (new)
4. **Polling:** GET /api/brew-log/{id}/feedback endpoint specified (3s interval, frontend-driven)

## Next Steps

1. Implement ZoneBoundaries utility file (Finn)
2. Extend _BrewLogCreateBody schema (Alex)
3. Add Zone_Taste column to Brew_Log sheet (Alex)
4. Implement feedback polling endpoint (Alex)
5. Update frontend form to collect zone_taste before submit (Finn)

---

**Scribe Note:** All three architecture questions resolved synchronously with unanimous verdicts. Squad verdicts documented in .squad/decisions/inbox/. Ready for implementation gate.

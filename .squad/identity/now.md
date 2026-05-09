---
updated_at: 2025-07-30T00:00:00Z
focus_area: CompassChart ZoneBoundaries + inference layer enrichment (Q1/Q2/Q3 answered)
active_issues: []
---

# What We're Focused On

**Q1 (ZoneBoundaries):** Frontend utility complete. CompassChart prop interface extended with optional `zoneBoundaries` parameter. No backend schema changes. Backward compatible.

**Q2 (roast_level):** Field confirmed end-to-end (Python + TypeScript). Already resolved in _resolve_names_from_dicts. No new columns or form inputs needed.

**Q3 (LLM Enrichment):** Fire-and-forget inference pattern; enrich prompt with machine_name, basket_name, roast_level, zone_taste; persist Zone_Taste to Brew_Log; frontend polls GET /api/brew-log/{id}/feedback for ai_feedback every 3s.

**Next Phase:** Implementation of ZoneBoundaries utility, _BrewLogCreateBody extension, Zone_Taste column, and feedback endpoint.

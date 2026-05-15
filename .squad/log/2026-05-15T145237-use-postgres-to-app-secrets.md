# Session Log: config/use-postgres-to-app-secrets

**Date:** 2026-05-15  
**Duration:** PR #71 completion  
**Team:** Alex (routing & implementation), Copilot (coordination)

## Summary

Fixed config.py comments per Copilot review feedback on PR #71. Alex responded to all review comments, clarifying that `USE_POSTGRES` configuration is sourced from the APP_SECRETS JSON blob in production, not as a standalone Cloud Run environment variable.

## Decision: USE_POSTGRES to APP_SECRETS

**Routing:** DIRECT_PERMITTED — bounded change to `app/config.py` and `.env.example` documentation only.

**Implementation:**
- Added inline comment on `use_postgres` field in `Settings` (`app/config.py`) documenting production sourcing rule
- Added matching comment in `.env.example` explaining local-dev vs production split
- No code logic changes required (validator already handles blob-sourced config generically)

**Affected Files:**
- `.squad/decisions/inbox/alex-use-postgres-impl.md` (merged)
- `.squad/decisions/inbox/alex-use-postgres-routing.md` (merged)
- `.squad/decisions/decisions.md` (updated with new decision record)

## Inbox Merge

Merged two decision inbox files into the team decisions log:
- Routing decision documentation
- Implementation decision record (scope, rationale, affected files, rules)

Cleared `.squad/decisions/inbox/` directory.

## Status

✓ Config changes complete  
✓ PR #71 review feedback addressed  
✓ Decision inbox merged  
✓ Ready for PR merge

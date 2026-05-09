# Session: SPA Auth Fix

**Date**: 2026-05-08  
**Agent**: Maya (Principal Engineer)  
**Branch**: fix/anon-root-redirect  

## Summary

Fixed SPA catch-all authentication regression in `app/main.py` by adding `CurrentUser` dependency to the catch-all route handler. This ensures FastAPI's dependency injection chain triggers authentication, properly redirecting anonymous users to Google OAuth instead of serving the React SPA HTML.

## Changes

- Added `_user: CurrentUser` parameter to `spa_catch_all` route handler
- Route now respects the `_RequiresLogin` exception handler
- Updated stale test suite

## Results

- 240 tests passed
- 7 tests skipped
- Changes pushed to `fix/anon-root-redirect`

## Decision Record

See `.squad/decisions/decisions.md` for the architectural decision on guarding SPA HTML routes with CurrentUser dependency.

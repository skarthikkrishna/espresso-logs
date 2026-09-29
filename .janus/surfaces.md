# Surfaces — espresso-logs (repo-level; one user-facing workflow/surface per line)

- Core authenticated tracking UI — dashboard, bean catalog, hardware, brew log (list/add/detail).
- User profile & memberships — the signed-in user's account view across households.
- Auth & onboarding — login, register, first-run create-household, OAuth interstitial.
- Household lifecycle & admin — create-household, settings (rename/delete, member roles, invitations, guest tokens), CSV import wizard.
- Invitation & guest access — invite accept/decline, expired/invalid states, guest-token read-only household view.
- Utility/error pages — 404 / not-found.
- Backend REST API (FastAPI) — the contract the SPA consumes (app/routers).
- Google Sheets integration — dual-write/sync (M6 decommission target).

### 2026-05-15: PR #72 feedback addressed

**By:** Alex
**What:**
1. **Stale inbox merged** — `decisions/inbox/alex-use-postgres-routing.md` appended to `decisions.md` and deleted.
2. **scribe-charter.md template synced** — Added `## Reuse Before Create (Non-Negotiable)` section; added APP_SECRETS line and "from Karthik" to Git Protocol; merged two-line push prohibition into single authoritative line.
3. **SKILL.md corrected** — `reuse-before-create/SKILL.md` now references `app/config.py` (`Settings._load_app_secrets`) as canonical APP_SECRETS pattern. Removed misleading references to `app/deps.py`/`app/main.py`. Fixed example code block to show `Settings` field addition + `settings.*` access, not direct `APP_SECRETS.get(...)` calls.
4. **charter.md template push wording** — Collapsed absolute "never push" two-liner into: "You MUST NOT run `git push` under any circumstances without explicit operator approval from Karthik."
5. **All 9 agent charters updated** — Same single-line push wording applied to alex, aria, finn, maya, priya, quinn, ralph, scribe, tariq charters.
**Why:** Copilot review requested these changes on PR #72 (`chore/squad-governance-protocols`).

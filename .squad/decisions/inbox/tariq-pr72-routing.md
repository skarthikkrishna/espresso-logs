### 2026-05-15T15:37:40-07:00: Routing decision — PR #72 feedback

**By:** Tariq

**What:** PR #72 feedback — 5 governance file updates. DIRECT_PERMITTED. Tariq executes inline.

**Why:** All changes are `.squad/` governance only (templates, skills, inbox merge). No feature work, no code, no tests. Mechanical template maintenance and policy wording. No SpecKit trigger; no blocking dependencies. Low risk, clear scope.

**Changes scope:**
1. `.squad/decisions/inbox/alex-use-postgres-routing.md` — merge into decisions.md, delete from inbox
2. `.squad/templates/scribe-charter.md` — add missing Reuse Before Create + APP_SECRETS sections  
3. `.squad/skills/reuse-before-create/SKILL.md:26,83` — add `app/config.py` reference (Settings._load_app_secrets)
4. `.squad/templates/charter.md:43` — reword "Never push" to "never push without explicit operator approval"
5. `.squad/templates/scribe-charter.md:140` — reword "Never push" to "never push without explicit operator approval"

**Next:** Coordinator executes fixes inline, commits, pushes to PR branch.

# Routing Decision: Post-Rebase Blocker Fixes
**Timestamp:** 2026-06-05T21:26:06Z  
**Routed by:** Tariq (TPM / CI workflow owner)  
**Status:** DIRECT_PERMITTED  

---

## Analysis

### Blocker 1: pip-audit failure
- **aiohttp 3.13.5** → CVE-2026-34993, CVE-2026-47265 | Fix: ≥ 3.14.0
- **pip 26.1.1** → PYSEC-2026-196 | Fix: ≥ 26.1.2
- **Nature:** Dependency version pins in pyproject.toml / uv.lock
- **Scope:** Mechanical, bounded update
- **Risk:** Low; versions are upstream-maintained; CI validates on update

### Blocker 2: gitleaks findings
- **Location:** `docs/ROTATION_PLAYBOOK.md` (6 findings, rule: generic-api-key)
- **Historical commits:** 7de8a9ca, 28a1c5ce (3 findings each)
- **Nature:** Documentation examples (JWT_SECRET rotation playbook) flagged as API keys
- **Assessment:** Guidance indicates these are documentation examples, not live secrets
- **Scope:** Safe allowlist or replace with template placeholders (e.g., `[SECRET]`, `<key>`)
- **Risk:** Medium; must verify none are actual secrets before committing

---

## Routing Decision

**status: DIRECT_PERMITTED**

### Rationale
- Both blockers are CI/operational maintenance — standard TPM scope
- No architectural decisions, no feature/product scope, no multi-repo coordination required
- Fixes are mechanical and well-scoped:
  - Dependency updates: standard `uv lock` workflow
  - Gitleaks: safe replacement + allowlist strategy
- Quinn gate not required (no application logic changes, no test coverage implications beyond existing CI)

### Exact Fix Scope

#### Fix 1: Dependency Updates (Owner: Copilot coordinator)
1. Update `aiohttp` to ≥ 3.14.0 in `pyproject.toml`
2. Update `pip` to ≥ 26.1.2 in `pyproject.toml` (or wherever pinned)
3. Run `uv lock --upgrade` to regenerate `uv.lock`
4. Verify: `uv run pip-audit --ignore-vuln PYSEC-2025-185` passes
5. Commit: "fix(deps): resolve CVE-2026-34993, CVE-2026-47265 (aiohttp), PYSEC-2026-196 (pip)"

#### Fix 2: Gitleaks Findings (Owner: Copilot coordinator)
1. **Review** `docs/ROTATION_PLAYBOOK.md` for actual secret exposure — redact any live values immediately if found
2. **Standardize** example placeholders to machine-readable format (e.g., `[SECRET]`, `<key>`, `YOUR_SECRET_HERE`)
3. **Update** `.gitleaksignore` to allowlist the known documentation pattern (commit + line hash) if replacement alone doesn't resolve
4. **Verify:** `uv run gitleaks git --redact --exit-code 1` passes
5. **Commit** both doc and `.gitleaksignore` changes: "fix(security): sanitize gitleaks findings in playbook docs + allowlist documentation pattern"

---

## Next Coordinator Action
- Verify current pin versions in `pyproject.toml`
- Apply both fixes in sequence (dependencies first, then gitleaks)
- Run all four local CI checks after each fix
- All checks must pass before requesting push approval from operator
- Do not push without explicit operator affirmative

---

## Assumptions
- No live secrets are exposed in `docs/ROTATION_PLAYBOOK.md` (guidance indicates examples only)
- Upstream `aiohttp` ≥ 3.14.0 and `pip` ≥ 26.1.2 are stable and tested
- `.gitleaksignore` allowlist strategy is acceptable for documentation patterns

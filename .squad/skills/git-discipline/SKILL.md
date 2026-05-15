# Git Discipline — No Push Without Approval

**Confidence:** High  
**Applies to:** All agents (see Scribe exception below)

---

## The Rule

Agents **NEVER** run `git push`.  
Agents **NEVER** run `git commit` unless explicitly told to by the coordinator or user.

Stage-only workflow: `git add` is permitted. `git commit` and `git push` are **NOT**.

---

## Why This Exists

Agents repeatedly pushed mid-session commits, triggering CI runs on every push and burning through the GitHub Actions weekly budget. Karthik explicitly flagged this as a structural failure. This gate exists to make that structurally impossible.

---

## Forbidden Commands (Never Run These)

```bash
git commit ...          # ❌ FORBIDDEN — requires explicit user confirmation
git commit -m "..."     # ❌ FORBIDDEN
git commit --amend      # ❌ FORBIDDEN
git push                # ❌ FORBIDDEN
git push origin <branch> # ❌ FORBIDDEN
git push --force        # ❌ FORBIDDEN
gh pr create            # ❌ FORBIDDEN unless user explicitly says "create the PR"
```

---

## Permitted Alternatives

```bash
git add <file>          # ✅ Stage changes
git add -p              # ✅ Interactive staging
git status              # ✅ Check what's staged
git diff --staged       # ✅ Review staged changes
git stash               # ✅ Save work-in-progress
```

---

## What to Do Instead of Committing

1. Make all file changes.
2. Run tests. Fix any failures.
3. Rebuild SPA if frontend files changed (`npm run build` in `frontend/`).
4. Run linting (`uv run ruff check app/ tests/`).
5. Stage changes with `git add`.
6. **STOP.** Report to the coordinator:

> "Changes are staged locally. Here's what changed: [list files]. Tests pass. Ready to push when you give the word."

The coordinator will ask Karthik for push approval before any commit or push happens.

---

## Scribe Exception

Scribe is the **only** agent permitted to run `git commit`, and **only** for `.squad/` state files:

- `.squad/decisions.md`
- `.squad/agents/*/history.md`
- `.squad/log/*`
- `.squad/orchestration-log/*`

Scribe **NEVER** commits source code, `app/` files, `frontend/` files, or build artifacts.  
Scribe **NEVER** runs `git push` — commit only, never push.

---

## Enforcement

This is a hard gate. No exceptions beyond Scribe's limited `.squad/`-only commit rights.  
If in doubt: stage, report, wait for the word.

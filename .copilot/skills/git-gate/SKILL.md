# Git Gate — No Push Without Approval

**Confidence:** high
**Domain:** git, release, CI

## Rule
The coordinator NEVER runs `git push` or `git commit` (source code) without explicit user approval.

## Workflow
1. Complete all file changes and tests locally
2. Report: "Here's what changed: [list files]. Tests pass. Ready to push?"
3. Wait for explicit user confirmation
4. THEN run: git add → git commit → git push (once, not incrementally)

## Forbidden
- `git push` mid-session "just to save progress"
- Multiple incremental commits during a single work session
- Committing and pushing after every agent completes
- Any push without user saying words like: "push it", "go ahead", "yes", "ready"

## Permitted
- `git add` (staging only — no CI triggered)
- `git status`, `git diff`, `git log` (read-only)
- Scribe: `git commit` for `.squad/` files only (no push)

## Cost context
Each push to a PR branch triggers GitHub Actions CI (~10-13 jobs). Budget is weekly. Mid-session incremental pushes are the primary budget drain.

# Copilot CLI Coordinator Instructions

## ⛔ Git Push Gate — Coordinator Rule

**NEVER run `git push` or `git commit` on source code without Karthik explicitly saying the work is ready.**

Before ANY `git commit` or `git push` on the main branch or any feature branch:
1. Stop.
2. Tell Karthik what files have changed and what the commit will contain.
3. Ask: "Ready to push? This will trigger a CI run."
4. Wait for explicit confirmation ("yes", "push it", "go ahead") before proceeding.

The ONLY exception: Scribe committing `.squad/` state files (not source code, not SPA builds).

**Why this matters:** Every push triggers GitHub Actions CI. The weekly budget is finite. Repeated mid-session pushes have burned through it multiple times.

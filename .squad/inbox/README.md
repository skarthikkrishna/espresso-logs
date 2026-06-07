# .squad/inbox/

This directory is the **handoff inbox** for `espresso-logs`.

## Purpose

The inbox receives committed handoff summary artifacts from `coffee_tracker` for each implementation spec. Each file is a self-contained summary that an espresso-logs implementation agent can use to execute the scoped task list without querying `coffee_tracker` directly.

## File Naming Convention

```
handoff-{spec_id}-summary.md
```

Examples:
- `handoff-038-summary.md` — Spec-038 cross-repo governance handoff
- `handoff-039-summary.md` — future spec handoff

## Lifecycle

| Phase | State |
|-------|-------|
| Active implementation cycle | File lives in `.squad/inbox/`; read by agents on spawn |
| Implementation-Cycle Close Retro (Step 4) | File archived to `.squad/archive/handoff-{spec_id}-summary.md`; this directory cleared |

## Agent Protocol

On every spawn, before beginning any task, an espresso-logs implementation agent must:

1. List all files in this directory
2. Read any unprocessed handoff summaries before starting scoped work
3. Confirm no coffee_tracker file path access is needed (the handoff summary should be self-contained)

If no handoff summary is present but a cross-repo task is being executed, surface the missing artifact to the coordinator before proceeding.

---

*Created by Spec-038 (T013). Permanent directory — README is never deleted.*

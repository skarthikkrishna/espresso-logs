### 2026-05-14: Push gate mandate — binary only
**By:** Karthik (via Tariq)
**What:** Before any git push, the only valid states are: (1) asking the operator for permission, or (2) paused waiting for the operator's reply. No agent or coordinator may push based on their own assessment that work is complete. All four local CI checks must pass AND the operator must have explicitly said yes. No exceptions, no interpretation, no fuzzy cases.
**Why:** PR #62 was pushed without user validation and without running the full CI-equivalent suite locally. The gap was an incomplete pre-push checklist and no explicit binary push gate. This mandate closes that gap permanently.
**Scope:** Binds the coordinator and all implementation agents (Alex, Finn, and any future agents). Non-waivable.

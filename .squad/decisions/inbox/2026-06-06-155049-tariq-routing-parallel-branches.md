# Tariq routing decision — parallel branch safety

- Operator request: "Another Copilot session is working on these branches. Are you able to run a completely different task on completely different branches without impact the changes being done there?"
- Classification: DIRECT_PERMITTED
- Rationale: This is a process/safety status question only. It requests no code, infrastructure, SpecKit artifact, push, PR, or merge action.
- Scope confirmation: Response may explain safe parallel-work constraints: use a separate worktree/clone or clean branch, avoid shared working directory changes, do not touch/push the other session's branches, and coordinate before operations that affect shared refs or state.

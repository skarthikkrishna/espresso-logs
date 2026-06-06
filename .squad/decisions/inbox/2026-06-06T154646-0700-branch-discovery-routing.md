# Routing decision: branch discovery

- Operator request: "what branch are we currently on espresso logs and coffee tracker?"
- Classification: DIRECT_PERMITTED
- Rationale: This is a read-only status request limited to discovering the current Git branch in the Espresso Logs repository and sibling/local Coffee Tracker repository. It does not change product behavior, code, configuration, CI, documentation, or governance artifacts beyond this required routing drop.
- Scope: Read-only branch discovery only; no code changes, no SpecKit, no push, no PR.

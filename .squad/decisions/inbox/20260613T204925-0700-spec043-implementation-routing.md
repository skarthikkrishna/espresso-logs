---
node_id: decision-20260613T204925-0700-spec043-implementation-routing
node_type: routing_decision
spec_id: spec-043
status: implementation_authorized
owned_by: tariq
created_at: 2026-06-13T20:49:25-07:00
---

# Decision Drop — spec-043 implementation routing

## Decision

Spec-043 Kaapi Kadai Design Coherence has completed SpecKit and both gates are green: Aria Stage-1 is `APPROVED`; Quinn is `APPROVED_WITH_NOTES` and GO. Routing decision: **PROCEED to implementation fan-out** using the dependency wave plan recorded in `.squad/inbox/handoff-043-summary.md`.

## Ralph-block resolution

Ralph blocked fan-out because the required cross-repo handoff summary was missing. Tariq authored `.squad/inbox/handoff-043-summary.md` as a self-contained executable brief for espresso-logs agents so implementation can proceed without reading upstream spec files.

## Carried Quinn notes

1. Ambient implementation must treat the lowered `--kaapi-ambient-*` names/values from the ambient design as source of truth over older fog/glint values if documentation drift appears.
2. Copy allowlist enforcement must target render sinks and accessibility props, with true-positive and false-positive exemption fixtures, and no false positives for technical strings such as classes, routes, query keys, enums, test IDs, or data values.
3. The six-width Playwright matrix needs deliberate runtime management: shard by family, install/cache browsers, separate fast static/computed audits from slower recordings, and retain only sanitized artifacts. Tariq tracks this as implementation infrastructure.
4. The app-repo design-language copy needs a durable sync/check mechanism after this feature; manual sync is not the long-term process.

## Privacy constraint

espresso-logs is public. All implementation evidence, screenshots, recordings, traces, logs, fixtures, and `.squad/` artifacts must exclude secrets, tokens, invite links, emails, production URLs, environment identifiers, local absolute paths, and household/user identifiers.

## Push/PR/deploy

No implementation wave may push, open a PR, deploy, or publish artifacts. After waves complete, the coordinator runs required local checks and asks the operator before any push.

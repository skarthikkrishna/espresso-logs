---
node_type: decision_drop
agent: Priya
role: product_spec
spec_id: spec-042
date: 2026-06-13
status: clarified
privacy_gate: .squad/privacy-gate.md reviewed before writing
---

# Clarify spec-042 US3: per-household `sheets_id` scope

## Outcome

spec-042 US3 is formally clarified to encode Maya's architecture decision `d1524c3`: tenant `sheets_id` values are household-local identifiers, not globally unique product identifiers.

## Gap recorded

The prior US3 scope covered app-layer read isolation but missed schema and write-path behavior. Global unique constraints on `sheets_id` could block a legitimate second household import using the same sheet-local ID, and unscoped read-before-write lookups could overwrite or return another household's row if database backstops were bypassed.

## Resolution recorded

- Replace global tenant-table `sheets_id` uniqueness with `UNIQUE(household_id, sheets_id)` on `catalog`, `inventory_bags`, `hardware`, `maintenance_log`, and `brew_log`.
- Require every write-path read-before-write lookup by `sheets_id` to include household scope, including `upsert`, get-by-`sheets_id` support paths, and startup backfill.
- Reconcile overlapping-`sheets_id` acceptance: after the composite migration, two households can hold the same non-null `sheets_id`, and isolation must prove Household A never reads or mutates Household B's same-`sheets_id` row.

## Task changes

- `T038` — Alex: per-household `sheets_id` uniqueness migration and ORM constraints for all five tenant tables.
- `T039` — Alex: household-scope catalog, inventory, hardware, maintenance, and startup-backfill write-path `sheets_id` lookups; brew-log remains scoped and uses composite uniqueness.
- `T040` — Quinn: repo-level and API-level overlapping-`sheets_id` isolation test for two households with the same sheet-local ID.

## Gate

Implementation remains blocked until the Quinn gate is present and approved for the amended US3 scope.

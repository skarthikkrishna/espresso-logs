---
node_id: privacy-gate-espresso-logs
node_type: privacy_gate
spec_id: spec-038
title: "Privacy Gate — espresso-logs"
enforced_by:
  - charter-prohibition
  - CI-scan
created_at: 2026-06-06
status: active
---

# Privacy Gate — espresso-logs

> **espresso-logs is a public repository.** All content committed here is publicly visible. This file defines the standing prohibition on sensitive content in all `.squad/` artifacts. Every agent reads this file on spawn before writing any `.squad/` artifact in this repository.

---

## Prohibited Content Categories

The following eight categories of content MUST NOT appear in any `.squad/` artifact committed to `espresso-logs`:

### 1. Credentials, Tokens, API Keys, and Secrets
Hard-coded credentials, API keys, tokens, OAuth client secrets, or secrets of any kind. This includes partial key fragments, key prefixes, and any value that could be used to authenticate to a service.

### 2. Google Service Account Names, Emails, and Key IDs
Service account email addresses (`*.iam.gserviceaccount.com`), service account names, key IDs, and any reference that identifies a specific GCP service account used in this project.

### 3. IAM Role Names, Bindings, and Policy Identifiers
IAM role names, role bindings, policy identifiers, custom role IDs, and any IAM construct specific to this project's GCP environment.

### 4. Cloud Run Service Names, Revision Hashes, and Internal Hostnames
Cloud Run service names, revision identifiers, internal `.run.app` hostnames, and any Cloud Run resource identifiers that expose the operational topology of the deployed application.

### 5. Postgres Connection Strings, Database Names, and Internal Hostnames
Postgres connection strings, database names, internal hostnames, IP addresses, port configurations, and any identifier that could be used to locate or connect to the database.

### 6. Household PII — User Identifiers, Email Patterns, Session Data
User identifiers, email addresses, session tokens, per-household usage data, and any personally identifiable information about households or individual users of the application.

### 7. Operationally Sensitive Identifiers
Cloud Build trigger IDs, GCP project numbers (numeric), GCP project IDs (string), billing account references, Cloud Monitoring alert IDs, and any operational identifier that scopes access to the project's GCP environment.

### 8. Internal Network Topology, VPC Configurations, and IP Ranges
VPC network names, subnet configurations, private IP ranges, firewall rule names, and any network topology detail that could aid in mapping the project's internal infrastructure.

---

## Agent Obligation

Every agent spawned to write `.squad/` artifacts in `espresso-logs` MUST:

1. **Read this file first** — before writing any `.squad/` artifact in this repository, read `.squad/privacy-gate.md` to internalize current prohibitions.
2. **Refuse to write prohibited content** — if a task requires committing content that matches any of the eight categories above, refuse and surface the potential violation to the coordinator before proceeding.
3. **Surface potential violations explicitly** — do not silently omit prohibited content; name the violation, identify the category, and obtain explicit coordinator authorization before any remediation approach is committed.
4. **Apply the prohibition to all artifact types** — decision drops, session logs, charter documents, ceremony definitions, handoff summaries, and any other `.squad/` content are all subject to this prohibition without exception.

This obligation applies whether the content would appear verbatim, in a truncated form, as an example, or as an operational note. The prohibition is categorical — there is no "documentation reference" exception for live operational values.

---

## CI Enforcement Reference

Layer 2 enforcement: `.github/workflows/squad-privacy-scan.yml` (to be created per T020, requires operator authorization before deployment). This workflow runs ripgrep scans against `.squad/**` on push and exits 1 on any prohibited pattern match.

Layer 1 enforcement (this file): written charter-level prohibition that agents apply at artifact-creation time. Layer 1 is the primary control — Layer 2 is the backstop.

> Note from Spec-038 (T020, Quinn gate): the `cloud_sql`/`cloud-sql`/`cloudsql` CI scan pattern may match documentation references as well as real operational values. On a match, human reviewer judgment is required to determine whether the match is a prohibited operational reference or an acceptable architectural description.

---

*Created by Spec-038 (T012). Permanent lifecycle — this file is never deleted or superseded.*

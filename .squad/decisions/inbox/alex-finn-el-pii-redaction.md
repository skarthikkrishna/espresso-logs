---
date: 2026-05-18
agent: Alex + Finn
topic: espresso-logs HEAD PII redaction + CLOUDSQL secret migration — spec-032 T-EL-01 + T-EL-02
decision: |
  - cloudbuild.yaml _CLOUDSQL_INSTANCE hardcoded value removed (set to '')
  - cloudbuild.yaml comment updated to reflect secret-based supply
  - deploy.yml updated to pass _CLOUDSQL_INSTANCE=${{ secrets.GCP_CLOUDSQL_INSTANCE }}
  - .squad/decisions.md: full legal name → skarthikkrishna (3 occurrences)
  - .env (gitignored, local only): ALLOWLIST_EMAILS email redacted locally — not a tracked file,
    no HEAD risk, but redacted for local hygiene.
  - Full grep validation clean on HEAD state (tracked files only).
  CRITICAL: T-CLOSE-01 pending — operator must add GCP_CLOUDSQL_INSTANCE secret to espresso-logs
  repo settings before next deploy triggers. Without it, Cloud Build will receive an empty
  _CLOUDSQL_INSTANCE substitution and the migrate step will fail at proxy startup.
files_changed:
  - cloudbuild.yaml
  - .github/workflows/deploy.yml
  - .squad/decisions.md
status: committed — branch chore/032-pii-redaction
---

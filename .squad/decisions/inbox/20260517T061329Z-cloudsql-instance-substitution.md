# Decision: _CLOUDSQL_INSTANCE placement in Cloud Build pipeline

**Date:** 2026-05-17  
**Authors:** Maya (architect) + Alex (backend engineer)  
**Status:** DECIDED  
**Urgency:** Production deploy was blocked — decision needed immediately.

---

## Decision

**Option A — Hardcode in `cloudbuild.yaml` substitutions block.**

`_CLOUDSQL_INSTANCE: espresso-logs-prod:us-west1:espresso-logs-db` is committed directly in the `substitutions:` block of `cloudbuild.yaml`. This is already the current state as of this decision.

---

## Rationale

### Maya (architectural view)

Option B (set in Cloud Build trigger via GCP Console) was invalidated by a concrete infrastructure fact: `buildtrigger.tf` in the tf-infra repo **explicitly states that `google_cloudbuild_trigger` resources have been removed**. Builds are triggered by GitHub Actions via `gcloud builds submit` — there is no GCP Console trigger to configure. Option B does not exist as an operational path.

Option C (parse from APP_SECRETS at build time) adds unjustified complexity. APP_SECRETS is a Cloud Run runtime secret injected by Cloud Run's `--set-secrets` mechanism — it is not available to Cloud Build steps without additional `secretEnv` wiring and JSON parsing logic. The complexity cost is high; the benefit (avoiding a single non-sensitive string in code) is negligible.

Option A is therefore the only viable choice, and it is architecturally sound:
- `_CLOUDSQL_INSTANCE` is **not sensitive**. Cloud SQL instance connection names appear in Cloud Run `--add-cloudsql-instances` flags, logs, and IAM bindings — they are infra identifiers, not secrets.
- **Precedent already exists in this file**: `_REGION: us-west1` and `_SERVICE_NAME: coffee-tracker` are hardcoded in the same substitutions block. `_CLOUDSQL_INSTANCE` is structurally identical — a non-sensitive, environment-specific infra identifier.
- Keeping it in code makes the build fully self-describing. Any developer can read `cloudbuild.yaml` and understand exactly what instance the migrate step connects to, without consulting GCP Console or a separate config store.

If the Cloud SQL instance ever changes, a one-line commit to `cloudbuild.yaml` is the correct mechanism — auditable, reviewable, and version-controlled.

### Alex (implementation view)

The value is already present in `cloudbuild.yaml` line 214 as of this decision:
```yaml
_CLOUDSQL_INSTANCE: espresso-logs-prod:us-west1:espresso-logs-db
```

No further implementation action is required for this variable. The migrate step (Step 5b-2) consumes it correctly:
```bash
/workspace/cloud-sql-proxy --unix-socket=/cloudsql $_CLOUDSQL_INSTANCE &
```

And the deploy step consumes it:
```
--add-cloudsql-instances=$_CLOUDSQL_INSTANCE
```

The only variables that legitimately belong in `<SET_IN_TRIGGER>` are those that **cannot be known at commit time** or that are **service-account email addresses** (which vary by GCP project setup and are closer to infrastructure identity than app config). `_RUNTIME_SA` and `_CLOUDBUILD_SA` correctly remain as `<SET_IN_TRIGGER>` — they are passed via `--substitutions` in the GitHub Actions workflow.

---

## Conditions and future considerations

- If the project ever moves back to GCP Console-managed Cloud Build triggers (e.g., Terraform codifies a `google_cloudbuild_trigger` resource again), `_CLOUDSQL_INSTANCE` should be migrated to that trigger's substitutions block to keep all environment-specific config in one place.
- If espresso-logs ever becomes multi-environment (staging vs. prod triggers), `_CLOUDSQL_INSTANCE` should be parameterised per trigger at that point.
- Neither condition applies today.

---

## Alternatives considered and rejected

| Option | Verdict | Reason |
|--------|---------|--------|
| B — GCP Console trigger | Rejected | No Cloud Build trigger exists; builds run via `gcloud builds submit` from GitHub Actions |
| C — Parse from APP_SECRETS | Rejected | APP_SECRETS is a Cloud Run runtime secret; making it available at build time requires extra `secretEnv` wiring and JSON parsing — unjustified complexity for a non-sensitive value |

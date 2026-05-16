# Decision Drop — IAM Grants for Cloud Build SA (hotfix)

**Date:** 2026-05-15  
**Agent:** Tariq  
**Triggered by:** hotfix/beans-catalog-brew-log — cloudbuild.yaml now requires two IAM grants before next deploy

---

## Context

`cloudbuild.yaml` in `espresso-logs` was updated to:
1. Mount `DATABASE_URL` via `--set-secrets` during `gcloud run deploy`
2. Pass `--add-cloudsql-instances espresso-logs-prod:us-west1:espresso-logs-db` at deploy time

Both steps require the Cloud Build SA (`coffee-tracker-cloudbuild@espresso-logs-prod.iam.gserviceaccount.com`) to hold permissions it did not previously have.

---

## Discovery

- **Secret confirmed:** `projects/23554984220/secrets/DATABASE_URL` exists in `espresso-logs-prod`
- **Cloud Build SA:** `coffee-tracker-cloudbuild@espresso-logs-prod.iam.gserviceaccount.com` (custom SA, managed via `google_service_account.cloudbuild` in `tf-infra/projects/espresso-logs/buildtrigger.tf`)
- **tf-infra pattern:** IAM is fully codified — both `google_secret_manager_secret_iam_member` (resource-scoped) and `google_project_iam_member` for `roles/cloudsql.client` patterns already exist for the runtime SA

---

## Decision

**Path taken: Terraform** (not gcloud direct)

Rationale: `tf-infra` already codifies IAM for this project with exact precedent for both required resource types:
- `secrets.tf` holds `runtime_database_url_accessor` — same pattern, different SA
- `iam.tf` holds `runtime_cloudsql_client` — same role, different SA

Applying out-of-band would create drift between live state and Terraform state.

---

## Changes Made

**Repository:** `skarthikkrishna/tf-infra`  
**Branch:** `hotfix/iam-cloudbuild-database-url`  
**Commit:** `23d1236`

### `secrets.tf` — new resource
```hcl
resource "google_secret_manager_secret_iam_member" "cloudbuild_database_url_accessor" {
  secret_id = google_secret_manager_secret.database_url.secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloudbuild.email}"
}
```

### `iam.tf` — new resource
```hcl
resource "google_project_iam_member" "cloudbuild_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudbuild.email}"
}
```

---

## Follow-up Actions Required

1. **Operator push + PR**: `git push origin hotfix/iam-cloudbuild-database-url` in `tf-infra` (requires operator approval)
2. **Terraform apply**: After PR is merged to tf-infra `main`, GitHub Actions `terraform.yml` must run `terraform apply` to materialise the grants in GCP
3. **Sequence dependency**: `hotfix/beans-catalog-brew-log` deploy in `espresso-logs` is BLOCKED until tf-infra PR is merged and `terraform apply` completes
4. **DEV-001 reminder**: The Compute Engine default SA still holds `roles/cloudbuild.builds.builder` (documented in `iam.tf` lines 143–173). This is dormant but unresolved — should be addressed before Phase 7

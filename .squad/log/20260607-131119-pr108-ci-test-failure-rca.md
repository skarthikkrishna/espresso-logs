# PR #108 CI/test failure RCA

- Timestamp: 2026-06-07 13:11:19 -0700
- Updated: 2026-06-07 13:20-13:30 -0700 by Tariq (CI/release-readiness triage)
- PR: #108, `fix/spec-039-production-readiness` -> `main`
- Head SHA: `e0837eccb81256d024d236f8d7414780efa49244`
- Failing check/run: GitHub Actions `CI` run `27103435257`, job `test` / `CI/test (pull_request)`, completed 2026-06-07T20:09:49Z with failure.

## Affected check

Only `CI/test (pull_request)` failed for PR #108 at run `27103435257`, job `79988191288`. `gh pr checks 108` showed the remaining backend, frontend, dependency, security, Semgrep, and gitleaks checks successful, with only `fe-e2e` skipped.

## Reproduction status

- CI: reproducible in GitHub Actions on run `27103435257`; `bash scripts/run-ci-tests.sh` produced `3 failed, 776 passed, 13 skipped, 78 warnings`.
- Local: targeted repro did **not** reproduce with the local runtime role:

  ```bash
  SPREADSHEET_ID=dummy DATABASE_URL=postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs uv run pytest \
    tests/repos/sql/test_inventory.py::test_inventory_get_is_household_scoped_by_rls \
    tests/test_api_catalog_create_image.py::test_sql_catalog_add_bag_cross_household_catalog_returns_404 \
    tests/test_api_catalog_create_image.py::test_sql_inventory_patch_cross_household_returns_404 -q
  ```

  Result: `3 passed, 7 warnings in 1.22s`.

- Local role verification returned `current_user='espresso'`, `rolsuper=False`, `rolbypassrls=False`, `inventory_owner='espresso'`.

## Evidence

GitHub Actions log evidence from job `79988191288`:

```text
Run bash scripts/run-ci-tests.sh
SPREADSHEET_ID: dummy
DATABASE_URL: ***localhost:5432/espresso_logs
...
FAILED tests/repos/sql/test_inventory.py::test_inventory_get_is_household_scoped_by_rls
FAILED tests/test_api_catalog_create_image.py::test_sql_catalog_add_bag_cross_household_catalog_returns_404
FAILED tests/test_api_catalog_create_image.py::test_sql_inventory_patch_cross_household_returns_404
=========== 3 failed, 776 passed, 13 skipped, 78 warnings in 17.53s ============
```

Key failed assertions:

```text
assert await repo.get("BAG-SPEC039-RLS") is None
E AssertionError: assert {'Bag_ID': 'BAG-SPEC039-RLS', ...} is None

E assert 201 == 404
E where 201 = <Response [201 Created]>.status_code

E assert 200 == 404
E where 200 = <Response [200 OK]>.status_code
```

Workflow evidence from `.github/workflows/ci.yml` lines 123-149:

- Postgres service is initialized with `POSTGRES_USER: ${{ vars.CI_DB_USER }}`.
- `uv run alembic upgrade head` uses `DATABASE_URL` built from the same `${{ vars.CI_DB_USER }}`.
- `bash scripts/run-ci-tests.sh` also uses `DATABASE_URL` built from the same `${{ vars.CI_DB_USER }}`.

RLS/design evidence:

- `alembic/versions/0007_m5_schema_corrections.py` documents that runtime isolation requires a role with no `BYPASSRLS`; `app_admin`/privileged roles must not be runtime because they defeat RLS.
- `alembic/versions/0014_brew_log_idempotency_rls.py` installs fail-closed `USING` and `WITH CHECK` RLS predicates on tenant tables including `catalog` and `inventory_bags`.
- `SqlCatalogRepo.get` and `SqlInventoryRepo.get/list/upsert` rely on active RLS/session context rather than adding duplicate household filters to every query.

## Root cause

CI is using the Postgres service bootstrap role as the runtime/test role. The official Postgres service image initializes `POSTGRES_USER` as the database superuser/bootstrap role. Because the workflow sets `POSTGRES_USER` from `${{ vars.CI_DB_USER }}` and then reuses that same user for both Alembic migrations and `scripts/run-ci-tests.sh`, the tests run as a privileged role that bypasses row-level security.

That makes the installed RLS policies ineffective in CI: cross-household `catalog` and `inventory_bags` rows remain visible/mutable, so the three RLS isolation tests fail. The same tests pass locally because the local `espresso` role is neither superuser nor `BYPASSRLS`.

## Bounded fix recommendation

Fix the CI environment, not the application or tests:

1. Keep a privileged/bootstrap role for the Postgres service and Alembic migrations.
2. Create a separate CI runtime/test role with `NOSUPERUSER` and `NOBYPASSRLS` after migrations, with only required database/schema/table/sequence grants.
3. Run `scripts/run-ci-tests.sh` with `DATABASE_URL` pointing to that non-privileged runtime role.
4. Alternatively, update repository CI variables so the service bootstrap role is distinct from the runtime role and `${{ vars.CI_DB_USER }}` is never both `POSTGRES_USER` and test `DATABASE_URL` user.
5. Re-run the three targeted tests in CI and then the full required local/CI-equivalent validation.

## Owner/domain

- Primary owner: Tariq — CI/release-readiness and workflow role separation.
- Consult as needed: Maya/Alex for database privilege/grant safety, but no application/frontend/test file changes are indicated by this triage.

## Remediation authorization

Direct remediation is **not** permitted under the current triage authorization because routing was `DIRECT_PERMITTED` for the diagnosis/log artifact only. A new routing decision/authorization is required before editing `.github/workflows/ci.yml`, repository scripts, application code, frontend code, or tests.

## Explicit non-actions

- No application, frontend, or test files were modified.
- No production data, secrets, deployments, review requests, merges, or pushes were accessed/performed.
- This RCA remains an uncommitted triage artifact unless the coordinator separately decides that committing only this RCA is necessary.

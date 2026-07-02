"""CI configuration evidence for SQL-backed household-isolation tests."""

from __future__ import annotations

from pathlib import Path


def test_ci_test_job_runs_sql_suite_with_fail_closed_database_guardrails() -> None:
    workflow = Path(".github/workflows/ci.yml").read_text()
    ci_script = Path("scripts/run-ci-tests.sh").read_text()
    root_conftest = Path("tests/conftest.py").read_text()

    assert "services:" in workflow
    assert "postgres:15" in workflow
    assert "NOBYPASSRLS" in workflow
    assert "NOSUPERUSER" in workflow
    assert "uv run alembic upgrade head" in workflow
    assert "bash scripts/run-ci-tests.sh" in workflow
    assert workflow.index("uv run alembic upgrade head") < workflow.index(
        "bash scripts/run-ci-tests.sh"
    )
    assert "DATABASE_URL: postgresql+asyncpg://espresso_ci_runtime:" in workflow

    assert 'if [ -z "${DATABASE_URL:-}" ]; then' in ci_script
    assert "CI-parity backend tests" in ci_script
    assert "uv run pytest tests/" in ci_script
    assert "--ignore=tests/e2e/" in ci_script

    assert '_assert_sql_test_database(purpose="SQL test schema migration")' in root_conftest
    assert '_assert_sql_test_database(purpose="SQL test tenant fixture seeding")' in root_conftest

from __future__ import annotations

import pytest

from app.e2e_safety import assert_e2e_database_is_isolated


def test_spec043_evidence_guard_rejects_operator_dev_database(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs",
    )

    with pytest.raises(RuntimeError, match="default Postgres port 5432"):
        assert_e2e_database_is_isolated()


def test_spec043_evidence_guard_rejects_default_dev_database_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@127.0.0.1:5433/espresso_logs",
    )

    with pytest.raises(RuntimeError, match="default/dev database name"):
        assert_e2e_database_is_isolated()


@pytest.mark.parametrize("app_env", ["production", "prod", "staging", "preview"])
def test_spec043_evidence_guard_rejects_non_test_app_environments(
    monkeypatch: pytest.MonkeyPatch,
    app_env: str,
) -> None:
    monkeypatch.setenv("APP_ENV", app_env)
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@127.0.0.1:5433/spec043_evidence",
    )

    with pytest.raises(RuntimeError, match="APP_ENV must be 'local' or 'test'"):
        assert_e2e_database_is_isolated()


def test_spec043_evidence_guard_rejects_non_loopback_database_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@db.internal:5433/spec043_evidence",
    )

    with pytest.raises(RuntimeError, match="host must be local loopback"):
        assert_e2e_database_is_isolated()


def test_spec043_evidence_guard_rejects_cloudsql_socket_target(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@localhost:5433/spec043_evidence"
        "?host=/cloudsql/project:region:instance",
    )

    with pytest.raises(RuntimeError, match="Cloud SQL/GCP database target"):
        assert_e2e_database_is_isolated()


def test_spec043_evidence_guard_rejects_prod_like_database_identifier(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@127.0.0.1:5433/spec043_prod_evidence",
    )

    with pytest.raises(RuntimeError, match="production-like database target"):
        assert_e2e_database_is_isolated()


def test_spec043_evidence_guard_rejects_database_without_test_or_evidence_marker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@127.0.0.1:5433/spec043_capture",
    )

    with pytest.raises(RuntimeError, match="must include 'test' or 'evidence'"):
        assert_e2e_database_is_isolated()


def test_spec043_evidence_guard_allows_isolated_evidence_database(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://espresso:espresso@127.0.0.1:5433/spec043_evidence",
    )

    assert_e2e_database_is_isolated()

"""Safety preflight for local E2E/evidence database writes."""

from __future__ import annotations

import os
from urllib.parse import parse_qs, urlparse


_SAFE_ENVIRONMENTS = frozenset({"local", "test"})
_UNSAFE_ENVIRONMENTS = frozenset({"production", "prod", "staging", "stage", "preview"})
_UNSAFE_DATABASE_NAMES = frozenset({"espresso_logs", "coffee_tracker", "postgres"})
_SAFE_DATABASE_MARKERS = ("evidence", "test")


def assert_e2e_database_is_isolated(database_url: str | None = None) -> None:
    """Fail loud unless DATABASE_URL is clearly an isolated test/evidence DB.

    This guard exists because a prior multi-tenant pollution incident showed that
    seed helpers can write realistic household data into an operator's dev
    household if the harness accidentally targets the default dev database.
    """

    app_env = os.environ.get("APP_ENV", "")
    if app_env not in _SAFE_ENVIRONMENTS or app_env.lower() in _UNSAFE_ENVIRONMENTS:
        raise RuntimeError(
            "Refusing E2E evidence writes: APP_ENV must be 'local' or 'test' "
            f"(got {app_env!r})."
        )

    url = database_url or os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("Refusing E2E evidence writes: DATABASE_URL is not set.")

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    socket_host = qs.get("host", [""])[0]
    host = parsed.hostname or ""
    port = parsed.port
    db_name = parsed.path.lstrip("/")
    combined = " ".join([url, host, socket_host, db_name]).lower()

    if socket_host.startswith("/cloudsql/") or "cloudsql" in combined or "googleapis" in combined:
        raise RuntimeError("Refusing E2E evidence writes: Cloud SQL/GCP database target detected.")

    if any(env in combined for env in _UNSAFE_ENVIRONMENTS):
        raise RuntimeError("Refusing E2E evidence writes: production-like database target detected.")

    if host not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError(
            "Refusing E2E evidence writes: DATABASE_URL host must be local loopback "
            f"(got {host!r})."
        )

    if port in {None, 5432}:
        raise RuntimeError(
            "Refusing E2E evidence writes: default Postgres port 5432 is reserved for "
            "operator dev data; use the spec-043 evidence port."
        )

    if db_name in _UNSAFE_DATABASE_NAMES:
        raise RuntimeError(
            "Refusing E2E evidence writes: default/dev database name detected "
            f"({db_name!r})."
        )

    if not any(marker in db_name.lower() for marker in _SAFE_DATABASE_MARKERS):
        raise RuntimeError(
            "Refusing E2E evidence writes: database name must include 'test' or "
            f"'evidence' (got {db_name!r})."
        )

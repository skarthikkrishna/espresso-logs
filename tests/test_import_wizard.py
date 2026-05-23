"""Unit tests for import wizard session bootstrap."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import get_db


@pytest.fixture()
def db_override() -> AsyncMock:
    mock_db = AsyncMock()

    async def _fake_db() -> Any:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


async def test_admin_can_start_import_wizard(db_override: AsyncMock) -> None:
    """GET /import creates a DB-backed import session and sets a cookie."""
    mock_db = db_override
    import_session_id = uuid.uuid4()
    import_session = SimpleNamespace(id=import_session_id)

    from app.deps import require_admin
    from tests.test_households import _fake_member

    admin_member = _fake_member(uuid.uuid4(), uuid.uuid4(), role="admin")
    app.dependency_overrides[require_admin] = lambda: admin_member

    with patch(
        "app.routers.import_wizard._create_import_session", AsyncMock(return_value=import_session)
    ):
        mock_db.commit = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/import")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 200
    assert resp.json() == {"session_id": str(import_session_id)}
    assert "import_session_id=" in resp.headers.get("set-cookie", "")


async def test_import_session_cookie_uses_two_hour_max_age(db_override: AsyncMock) -> None:
    """Import wizard session cookies expire after two hours."""
    mock_db = db_override
    import_session = SimpleNamespace(id=uuid.uuid4())

    from app.deps import require_admin
    from tests.test_households import _fake_member

    admin_member = _fake_member(uuid.uuid4(), uuid.uuid4(), role="admin")
    app.dependency_overrides[require_admin] = lambda: admin_member

    with patch(
        "app.routers.import_wizard._create_import_session", AsyncMock(return_value=import_session)
    ):
        mock_db.commit = AsyncMock()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/import")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 200
    assert "Max-Age=7200" in resp.headers.get("set-cookie", "")

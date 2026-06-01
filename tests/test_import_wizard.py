"""Unit tests for import wizard session bootstrap."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import sqlalchemy as sa
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
    set_cookie = resp.headers.get("set-cookie", "")
    assert "Max-Age=7200" in set_cookie
    assert "Secure" in set_cookie


# ---------------------------------------------------------------------------
# Unit tests for private helpers — covers lines uncovered by route-level tests
# ---------------------------------------------------------------------------


class TestComputeDryRun:
    """_compute_dry_run: pure function, no I/O."""

    def test_empty_sections_returns_empty_dict(self) -> None:
        from app.routers.import_wizard import _compute_dry_run
        from app.services.importer import ImportState

        state = ImportState(
            sections={},
            column_mappings={},
            enum_divergences={},
            confirmed_enum_maps={},
        )
        result = _compute_dry_run(state)
        assert result == {}

    def test_unknown_section_skipped(self) -> None:
        from app.routers.import_wizard import _compute_dry_run
        from app.services.importer import ImportState

        state = ImportState(
            sections={"Unknown_Section": [{"col": "val"}]},
            column_mappings={},
            enum_divergences={},
            confirmed_enum_maps={},
        )
        result = _compute_dry_run(state)
        assert "Unknown_Section" not in result

    def test_grinder_calibration_not_in_output_as_own_key(self) -> None:
        from app.routers.import_wizard import _compute_dry_run
        from app.services.importer import ImportState

        state = ImportState(
            sections={
                "Grinder_Calibration": [{"Grinder_ID": "GR001", "Date": "2024-01-01", "Notes": ""}]
            },
            column_mappings={},
            enum_divergences={},
            confirmed_enum_maps={},
        )
        result = _compute_dry_run(state)
        # Grinder_Calibration rows are migrated to Maintenance — not kept under their own key
        assert "Grinder_Calibration" not in result

    def test_grinder_calibration_migrated_to_maintenance(self) -> None:
        from app.routers.import_wizard import _compute_dry_run
        from app.services.importer import ImportState

        state = ImportState(
            sections={
                "Grinder_Calibration": [{"Grinder_ID": "GR001", "Date": "2024-01-01", "Notes": ""}]
            },
            column_mappings={},
            enum_divergences={},
            confirmed_enum_maps={},
        )
        result = _compute_dry_run(state)
        assert "Maintenance" in result
        assert len(result["Maintenance"]) == 1
        assert result["Maintenance"][0]["Hardware_ID"] == "GR001"

    def test_hardware_section_normalized(self) -> None:
        from app.routers.import_wizard import _compute_dry_run
        from app.services.importer import ImportState

        state = ImportState(
            sections={
                "Hardware": [
                    {
                        "Hardware_ID": "HW001",
                        "Category": "Grinder",
                        "Name": "Niche",
                        "Product_URL": "",
                        "Local_Image_Path": "",
                    }
                ]
            },
            column_mappings={"Hardware": {}},
            enum_divergences={},
            confirmed_enum_maps={},
        )
        result = _compute_dry_run(state)
        assert "Hardware" in result
        assert len(result["Hardware"]) == 1


class TestGetImportSessionHelper:
    """_get_import_session: covers missing-cookie and invalid-UUID branches."""

    async def test_returns_none_when_no_cookie(self) -> None:
        from unittest.mock import AsyncMock, MagicMock
        from app.routers.import_wizard import _get_import_session
        import uuid

        mock_db = AsyncMock()
        mock_request = MagicMock()
        mock_request.cookies = {}
        mock_membership = MagicMock()
        mock_membership.household_id = uuid.uuid4()
        mock_membership.user_id = uuid.uuid4()

        result = await _get_import_session(mock_db, mock_request, mock_membership)
        assert result is None
        mock_db.execute.assert_not_called()

    async def test_returns_none_for_invalid_uuid_cookie(self) -> None:
        from unittest.mock import AsyncMock, MagicMock
        from app.routers.import_wizard import _get_import_session

        mock_db = AsyncMock()
        mock_request = MagicMock()
        mock_request.cookies = {"import_session_id": "not-a-uuid"}
        mock_membership = MagicMock()

        result = await _get_import_session(mock_db, mock_request, mock_membership)
        assert result is None
        mock_db.execute.assert_not_called()

    async def test_queries_db_for_valid_cookie(self) -> None:
        from app.routers.import_wizard import _get_import_session
        import uuid

        session_id = uuid.uuid4()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        mock_request = MagicMock()
        mock_request.cookies = {"import_session_id": str(session_id)}
        mock_membership = MagicMock()
        mock_membership.household_id = uuid.uuid4()
        mock_membership.user_id = uuid.uuid4()

        result = await _get_import_session(mock_db, mock_request, mock_membership)
        assert result is None

        stmt = mock_db.execute.call_args.args[0]
        assert isinstance(stmt, sa.sql.selectable.Select)
        where_sql = str(stmt.whereclause).lower()
        assert "import_sessions.id" in where_sql
        assert "import_sessions.household_id" in where_sql
        assert "import_sessions.created_by" in where_sql
        assert "import_sessions.expires_at" in where_sql
        assert "now()" in where_sql

        compiled = stmt.compile()
        assert session_id in compiled.params.values()
        assert mock_membership.household_id in compiled.params.values()
        assert mock_membership.user_id in compiled.params.values()


class TestLoadStateHelper:
    """_load_state: covers None-return and successful ImportState construction."""

    async def test_returns_none_when_no_session(self) -> None:
        from unittest.mock import AsyncMock, MagicMock
        from app.routers.import_wizard import _load_state

        mock_db = AsyncMock()
        mock_request = MagicMock()
        mock_request.cookies = {}
        mock_membership = MagicMock()

        result = await _load_state(mock_db, mock_request, mock_membership)
        assert result is None

    async def test_returns_import_state_from_session(self) -> None:
        from unittest.mock import AsyncMock, MagicMock
        from app.routers.import_wizard import _load_state
        from app.services.importer import ImportState
        import types

        fake_session = types.SimpleNamespace(
            state={
                "sections": {},
                "column_mappings": {},
                "enum_divergences": {},
                "confirmed_enum_maps": {},
                "dry_run_preview": {},
            }
        )

        with patch(
            "app.routers.import_wizard._get_import_session",
            AsyncMock(return_value=fake_session),
        ):
            result = await _load_state(AsyncMock(), MagicMock(), MagicMock())

        assert isinstance(result, ImportState)


class TestSaveAndClearStateHelpers:
    """_save_state and _clear_state: cover DB-execute paths."""

    async def test_save_state_executes_update(self) -> None:
        from app.routers.import_wizard import _save_state
        from app.services.importer import ImportState
        import uuid

        import_session_id = uuid.uuid4()
        mock_db = AsyncMock()
        state = ImportState(
            sections={},
            column_mappings={},
            enum_divergences={},
            confirmed_enum_maps={},
        )
        await _save_state(mock_db, import_session_id, state)

        stmt = mock_db.execute.call_args.args[0]
        assert isinstance(stmt, sa.sql.dml.Update)
        assert stmt.table.name == "import_sessions"
        assert "import_sessions.id" in str(stmt.whereclause).lower()

        compiled = stmt.compile()
        assert import_session_id in compiled.params.values()
        assert compiled.params["state"] == {
            "sections": {},
            "column_mappings": {},
            "enum_divergences": {},
            "confirmed_enum_maps": {},
            "dry_run_preview": {},
        }
        mock_db.flush.assert_called_once()

    async def test_clear_state_executes_delete(self) -> None:
        from app.routers.import_wizard import _clear_state
        import uuid

        import_session_id = uuid.uuid4()
        mock_db = AsyncMock()
        await _clear_state(mock_db, import_session_id)

        stmt = mock_db.execute.call_args.args[0]
        assert isinstance(stmt, sa.sql.dml.Delete)
        assert stmt.table.name == "import_sessions"
        assert "import_sessions.id" in str(stmt.whereclause).lower()
        assert import_session_id in stmt.compile().params.values()
        mock_db.flush.assert_called_once()


class TestCreateImportSessionHelper:
    """_create_import_session: covers the DB add/flush/refresh path."""

    async def test_creates_and_returns_session(self) -> None:
        from app.routers.import_wizard import _create_import_session
        import uuid

        mock_db = AsyncMock()
        mock_db.add = MagicMock()
        mock_membership = MagicMock()
        mock_membership.household_id = uuid.uuid4()
        mock_membership.user_id = uuid.uuid4()

        # db.refresh updates the object in-place; simulate by assigning an id
        async def fake_refresh(obj: object) -> None:
            object.__setattr__(obj, "id", uuid.uuid4()) if not hasattr(obj, "id") else None

        mock_db.refresh = AsyncMock(side_effect=fake_refresh)

        await _create_import_session(mock_db, mock_membership)
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_db.refresh.assert_called_once()

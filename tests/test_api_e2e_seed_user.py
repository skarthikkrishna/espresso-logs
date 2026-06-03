"""Tests for POST /api/e2e/seed-user endpoint."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from httpx import ASGITransport, AsyncClient


def _make_test_app():
    from fastapi import FastAPI
    from app.routers import api_e2e
    from app.models.base import get_db

    test_app = FastAPI()
    test_app.include_router(api_e2e.router)
    return test_app, get_db


class TestSeedUser:
    """POST /api/e2e/seed-user — gating, idempotency, and payload correctness."""

    async def test_seed_user_returns_user_and_household_ids(self, monkeypatch) -> None:
        """Returns 200 with correct user_id and household_id when enabled."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/seed-user")

        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == str(api_e2e._E2E_USER_ID)
        assert body["household_id"] == str(api_e2e._E2E_HOUSEHOLD_ID)
        mock_db.commit.assert_awaited_once()

    async def test_seed_user_upserts_all_required_tables(self, monkeypatch) -> None:
        """Seed endpoint writes user, household, membership, and active_household_id."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                await client.post("/api/e2e/seed-user")

        executed = [str(call.args[0]) for call in mock_db.execute.await_args_list]
        assert any("INSERT INTO users" in s for s in executed)
        assert any("INSERT INTO households" in s for s in executed)
        assert any("INSERT INTO household_members" in s for s in executed)
        assert any("UPDATE users SET active_household_id" in s for s in executed)

    async def test_seed_user_uses_username_user(self, monkeypatch) -> None:
        """Seeded user has username 'user' (not the old synthetic e2e-test-user)."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                await client.post("/api/e2e/seed-user")

        user_insert_params = next(
            call.args[1]
            for call in mock_db.execute.await_args_list
            if "INSERT INTO users" in str(call.args[0])
        )
        assert user_insert_params["username"] == "user"
        assert "password_hash" in user_insert_params

    async def test_seed_user_is_idempotent(self, monkeypatch) -> None:
        """Calling seed-user twice both return 200 — ON CONFLICT upsert makes it safe."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                r1 = await client.post("/api/e2e/seed-user")
                r2 = await client.post("/api/e2e/seed-user")

        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["user_id"] == r2.json()["user_id"]
        assert r1.json()["household_id"] == r2.json()["household_id"]
        assert mock_db.commit.await_count == 2

    async def test_seed_user_returns_404_when_bypass_disabled(self, monkeypatch) -> None:
        """Returns 404 when E2E_AUTH_BYPASS is not set."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", False):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/seed-user")

        assert resp.status_code == 404
        mock_db.execute.assert_not_awaited()
        mock_db.commit.assert_not_awaited()

    async def test_seed_user_returns_404_in_production_env(self, monkeypatch) -> None:
        """Returns 404 when APP_ENV is not local or test, even with bypass flag set."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "production")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/seed-user")

        assert resp.status_code == 404
        mock_db.execute.assert_not_awaited()
        mock_db.commit.assert_not_awaited()

    async def test_seed_user_accessible_in_test_env(self, monkeypatch) -> None:
        """Returns 200 when APP_ENV=test (not just local)."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "test")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/seed-user")

        assert resp.status_code == 200

    async def test_seed_user_deletes_stale_username_row_before_insert(self, monkeypatch) -> None:
        """Seed-user issues a DELETE for any username='user' row with a different UUID
        before the INSERT, preventing ON CONFLICT(username) violations caused by a
        pre-existing developer-created account.
        """
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/seed-user")

        assert resp.status_code == 200
        executed_sql = [str(call.args[0]) for call in mock_db.execute.await_args_list]
        # A DELETE that scopes by username AND excludes the canonical E2E UUID must
        # appear as the very first SQL statement — before the INSERT.
        delete_idx = next((i for i, s in enumerate(executed_sql) if "DELETE FROM users" in s), None)
        insert_idx = next((i for i, s in enumerate(executed_sql) if "INSERT INTO users" in s), None)
        assert delete_idx is not None, "Expected DELETE FROM users statement not found"
        assert insert_idx is not None, "Expected INSERT INTO users statement not found"
        assert delete_idx < insert_idx, "DELETE must precede INSERT"

        # Verify the DELETE is parameterised with the right username and excludes the
        # canonical E2E user id — this is the predicate that prevents the 500.
        delete_params = mock_db.execute.await_args_list[delete_idx].args[1]
        assert delete_params["username"] == "user"
        assert str(delete_params["uid"]) == str(api_e2e._E2E_USER_ID)

    async def test_seed_user_username_conflict_does_not_raise_on_second_call(
        self, monkeypatch
    ) -> None:
        """Simulates the real failure shape: username='user' exists with a foreign UUID.

        On the first call the DELETE clears the stale row; the INSERT then succeeds.
        A second call must also return 200 (idempotency is preserved).
        """
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        mock_db = AsyncMock()
        test_app.dependency_overrides[get_db] = lambda: mock_db

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                r1 = await client.post("/api/e2e/seed-user")
                r2 = await client.post("/api/e2e/seed-user")

        assert r1.status_code == 200, f"First call failed: {r1.json()}"
        assert r2.status_code == 200, f"Second call failed: {r2.json()}"

    async def test_seed_user_returns_503_when_db_none(self, monkeypatch) -> None:
        """Returns 503 when DB session is None (db dependency yields None)."""
        from app.routers import api_e2e

        monkeypatch.setenv("APP_ENV", "local")
        test_app, get_db = _make_test_app()
        # Override get_db to return None — simulates an unavailable DB session.
        test_app.dependency_overrides[get_db] = lambda: None

        with patch.object(api_e2e, "_E2E_AUTH_BYPASS", True):
            async with AsyncClient(
                transport=ASGITransport(app=test_app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/e2e/seed-user")

        assert resp.status_code == 503
        assert resp.json()["detail"] == "Database unavailable"

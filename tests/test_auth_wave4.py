"""Wave 4 tests — US-4.1: auth lifecycle (register, login, refresh, logout, me, admin reset).

Tests exercise app/routers/api_auth.py + app/services/auth.py.
All autouse fixtures from conftest.py remain active; auth dep overrides are
cleared selectively via the ``no_auth_deps`` fixture where real JWT logic is needed.
"""

from __future__ import annotations

import asyncio
import datetime
import uuid
from collections.abc import Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import get_db
from app.rate_limit import limiter
from app.repos.sql.household import HouseholdMembershipWithName
from app.services.auth import create_access_token, hash_password


# ---------------------------------------------------------------------------
# Rate limiter reset — must run before every test so no cross-test pollution
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> Generator[None, None, None]:
    """Reset the in-memory slowapi limiter before each test to prevent cross-test pollution."""
    limiter._storage.reset()
    yield
    limiter._storage.reset()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _fake_user(
    *,
    user_id: uuid.UUID | None = None,
    username: str = "alice",
    password: str = "ValidPass!234",
    locked_until: datetime.datetime | None = None,
    login_attempts: int = 0,
) -> MagicMock:
    u = MagicMock()
    u.id = user_id or uuid.uuid4()
    u.username = username
    u.display_name = username.title()
    u.email = f"{username}@example.com"
    u.picture_url = None
    u.active_household_id = None
    u.password_hash = hash_password(password)
    u.locked_until = locked_until
    u.login_attempts = login_attempts
    return u


def _fake_member(user_id: uuid.UUID, household_id: uuid.UUID, role: str = "admin") -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.user_id = user_id
    m.household_id = household_id
    m.role = role
    m.joined_at = datetime.datetime.now(datetime.timezone.utc)
    return m


def _fake_refresh_token(
    user_id: uuid.UUID,
    *,
    revoked: bool = False,
    expires_at: datetime.datetime | None = None,
) -> MagicMock:
    rt = MagicMock()
    rt.id = uuid.uuid4()
    rt.user_id = user_id
    rt.token_hash = "fakehash"
    rt.revoked = revoked
    rt.expires_at = expires_at or (
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
    )
    return rt


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_db() -> AsyncMock:
    """Override get_db with an AsyncMock so all await db.* calls succeed."""
    db = AsyncMock()
    return db


@pytest.fixture(autouse=False)
def auth_client(mock_db: AsyncMock):  # type: ignore[no-untyped-def]
    """Yield (async_client_factory, mock_db) with auth dep overrides cleared.

    Auth dep overrides (current_user, current_household_membership, require_admin,
    resolve_guest_or_member) are popped so real JWT auth logic runs.
    get_db is overridden to yield mock_db.
    """
    from app.deps import (
        current_household_membership,
        current_user,
        require_admin,
        resolve_guest_or_member,
    )

    async def _fake_get_db() -> Any:
        yield mock_db

    overrides_to_clear = [
        current_user,
        current_household_membership,
        require_admin,
        resolve_guest_or_member,
    ]
    saved: dict[Any, Any] = {}
    for dep in overrides_to_clear:
        if dep in app.dependency_overrides:
            saved[dep] = app.dependency_overrides.pop(dep)
    app.dependency_overrides[get_db] = _fake_get_db

    yield mock_db

    app.dependency_overrides.pop(get_db, None)
    for dep, override in saved.items():
        app.dependency_overrides[dep] = override


@pytest.fixture(autouse=False)
def db_override(mock_db: AsyncMock):  # type: ignore[no-untyped-def]
    """Override get_db without clearing auth dep overrides (for me/admin endpoints)."""

    async def _fake_get_db() -> Any:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_get_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


async def _post(path: str, json: dict[str, Any], **kwargs: Any) -> Any:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.post(path, json=json, **kwargs)


async def _get(path: str, **kwargs: Any) -> Any:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.get(path, **kwargs)


# ---------------------------------------------------------------------------
# Register tests
# ---------------------------------------------------------------------------


async def test_register_returns_201_with_access_token_and_rt_cookie(
    auth_client: AsyncMock,
) -> None:
    mock_db = auth_client
    user = _fake_user()
    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo,
        patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=None)
        MockUserRepo.return_value.create = AsyncMock(return_value=user)
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        MockHouseholdRepo.return_value.seed_default_household = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/register",
                json={"username": "alice", "password": "ValidPass!234"},
            )

    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    # rt cookie must be set
    assert "rt=" in resp.headers.get("set-cookie", "")


async def test_register_duplicate_username_returns_409(auth_client: AsyncMock) -> None:
    existing = _fake_user()
    with patch("app.routers.api_auth.UserRepo") as MockUserRepo:
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=existing)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/register",
                json={"username": "alice", "password": "ValidPass!234"},
            )

    assert resp.status_code == 409


async def test_register_invalid_username_format_returns_422(auth_client: AsyncMock) -> None:
    bad_usernames = ["ab", "-alice", "alice!"]
    for username in bad_usernames:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/register",
                json={"username": username, "password": "ValidPass!234"},
            )
        assert resp.status_code == 422, f"Expected 422 for username={username!r}"


async def test_register_short_password_returns_422(auth_client: AsyncMock) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/register",
            json={"username": "alice", "password": "short"},
        )
    assert resp.status_code == 422


async def test_register_oversized_password_returns_422(auth_client: AsyncMock) -> None:
    oversized = "a" * 1024 + "x"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/auth/register",
            json={"username": "alice", "password": oversized},
        )
    assert resp.status_code == 422


async def test_register_stores_argon2id_hash(auth_client: AsyncMock) -> None:
    mock_db = auth_client
    captured: dict[str, str] = {}
    user = _fake_user()

    async def _mock_create(db: Any, **kwargs: Any) -> MagicMock:
        captured["password_hash"] = kwargs.get("password_hash", "")
        return user

    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo,
        patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=None)
        MockUserRepo.return_value.create = _mock_create
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        MockHouseholdRepo.return_value.seed_default_household = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/auth/register",
                json={"username": "alice", "password": "ValidPass!234"},
            )

    assert captured["password_hash"].startswith("$argon2id$"), (
        f"Expected argon2id PHC hash, got: {captured['password_hash'][:30]}"
    )


# ---------------------------------------------------------------------------
# Login tests
# ---------------------------------------------------------------------------


async def test_login_correct_credentials_returns_200_with_rt_cookie(
    auth_client: AsyncMock,
) -> None:
    mock_db = auth_client
    user = _fake_user()
    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo,
        patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=user)
        MockUserRepo.return_value.reset_login_state = AsyncMock()
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        MockHouseholdRepo.return_value.seed_default_household = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/login",
                json={"username": "alice", "password": "ValidPass!234"},
            )

    assert resp.status_code == 200
    assert "access_token" in resp.json()
    assert "rt=" in resp.headers.get("set-cookie", "")


async def test_login_wrong_password_returns_401(auth_client: AsyncMock) -> None:
    user = _fake_user()
    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=user)
        MockUserRepo.return_value.increment_login_attempts = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/login",
                json={"username": "alice", "password": "WrongPassword!"},
            )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


async def test_login_unknown_username_returns_401(auth_client: AsyncMock) -> None:
    with patch("app.routers.api_auth.UserRepo") as MockUserRepo:
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=None)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/login",
                json={"username": "nobody", "password": "ValidPass!234"},
            )

    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


async def test_login_increments_login_attempts_on_failure(auth_client: AsyncMock) -> None:
    user = _fake_user()
    increment_mock = AsyncMock()
    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=user)
        MockUserRepo.return_value.increment_login_attempts = increment_mock

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post(
                "/auth/login",
                json={"username": "alice", "password": "WrongPassword!"},
            )

    increment_mock.assert_called_once()


async def test_login_lockout_at_10_consecutive_failures(auth_client: AsyncMock) -> None:
    """After 10 failures, subsequent requests return 429 (account locked, AC-023).

    The mock uses 9 wrong-password responses + 1 locked-user response so the test
    stays within the 10/minute rate limit window (count reaches 10 but never exceeds it).
    """
    mock_db = auth_client
    normal_user = _fake_user()
    locked_user = _fake_user(
        user_id=normal_user.id,
        locked_until=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15),
    )
    # First 9 calls return the normal (unlocked) user; 10th returns locked user
    side_effects = [normal_user] * 9 + [locked_user]

    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(side_effect=side_effects)
        MockUserRepo.return_value.increment_login_attempts = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            for i in range(9):
                r = await client.post(
                    "/auth/login",
                    json={"username": "alice", "password": "WrongPassword!"},
                )
                assert r.status_code == 401, f"Expected 401 on attempt {i + 1}, got {r.status_code}"

            # 10th request: rate count == 10 (at limit, handler still runs) → locked
            resp = await client.post(
                "/auth/login",
                json={"username": "alice", "password": "WrongPassword!"},
            )

    assert resp.status_code == 429
    assert "locked" in resp.json()["detail"].lower()


async def test_login_success_resets_login_attempts(auth_client: AsyncMock) -> None:
    mock_db = auth_client
    user = _fake_user(login_attempts=3)
    reset_mock = AsyncMock()
    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo,
        patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=user)
        MockUserRepo.return_value.reset_login_state = reset_mock
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        MockHouseholdRepo.return_value.seed_default_household = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/login",
                json={"username": "alice", "password": "ValidPass!234"},
            )

    assert resp.status_code == 200
    reset_mock.assert_called_once()


async def test_login_rt_cookie_has_correct_attributes(auth_client: AsyncMock) -> None:
    mock_db = auth_client
    user = _fake_user()
    with (
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo,
        patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo,
    ):
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=user)
        MockUserRepo.return_value.reset_login_state = AsyncMock()
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        MockHouseholdRepo.return_value.seed_default_household = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/login",
                json={"username": "alice", "password": "ValidPass!234"},
            )

    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "").lower()
    assert "rt=" in set_cookie
    assert "httponly" in set_cookie
    assert "samesite=strict" in set_cookie
    assert "path=/auth" in set_cookie
    assert "max-age=2592000" in set_cookie


# ---------------------------------------------------------------------------
# Refresh tests
# ---------------------------------------------------------------------------


async def test_refresh_valid_cookie_returns_new_access_token_and_rotates_cookie(
    auth_client: AsyncMock,
) -> None:
    mock_db = auth_client
    user_id = uuid.uuid4()
    stored_rt = _fake_refresh_token(user_id)

    from app.services.auth import generate_refresh_token

    raw_rt, _ = generate_refresh_token()

    with patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo:
        MockRtRepo.return_value.rotate = AsyncMock(return_value=stored_rt)
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/refresh",
                cookies={"rt": raw_rt},
            )

    assert resp.status_code == 200
    assert "access_token" in resp.json()
    # rotated cookie should be set
    assert "rt=" in resp.headers.get("set-cookie", "")


async def test_refresh_revoked_token_returns_401(auth_client: AsyncMock) -> None:
    """Replaying a revoked token returns 401 and revokes all active sessions for the user."""
    mock_db = auth_client
    user_id = uuid.uuid4()
    revoked_rt = _fake_refresh_token(user_id, revoked=True)

    from app.services.auth import generate_refresh_token

    raw_rt, _ = generate_refresh_token()

    with patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo:
        MockRtRepo.return_value.rotate = AsyncMock(return_value=None)
        MockRtRepo.return_value.get_by_hash = AsyncMock(return_value=revoked_rt)
        MockRtRepo.return_value.revoke_all_for_user = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/refresh",
                cookies={"rt": raw_rt},
            )

    assert resp.status_code == 401
    MockRtRepo.return_value.revoke_all_for_user.assert_awaited_once_with(mock_db, user_id)
    assert mock_db.commit.await_count == 1
    MockRtRepo.return_value.create.assert_not_called()


async def test_refresh_token_replay_returns_401(auth_client: AsyncMock) -> None:
    """Unknown refresh tokens return 401 without revoking unrelated sessions."""
    mock_db = auth_client

    from app.services.auth import generate_refresh_token

    raw_rt, _ = generate_refresh_token()

    with patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo:
        MockRtRepo.return_value.rotate = AsyncMock(return_value=None)
        MockRtRepo.return_value.get_by_hash = AsyncMock(return_value=None)
        MockRtRepo.return_value.revoke_all_for_user = AsyncMock()
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/refresh",
                cookies={"rt": raw_rt},
            )

    assert resp.status_code == 401
    MockRtRepo.return_value.revoke_all_for_user.assert_not_called()


async def test_refresh_body_fallback_when_no_cookie(auth_client: AsyncMock) -> None:
    """AC-033: refresh token in request body is accepted when no cookie is present."""
    mock_db = auth_client
    user_id = uuid.uuid4()
    stored_rt = _fake_refresh_token(user_id)

    from app.services.auth import generate_refresh_token

    raw_rt, _ = generate_refresh_token()

    with patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo:
        MockRtRepo.return_value.rotate = AsyncMock(return_value=stored_rt)
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # No cookies — token in body instead
            resp = await client.post(
                "/auth/refresh",
                json={"refresh_token": raw_rt},
            )

    assert resp.status_code == 200
    assert "access_token" in resp.json()


async def test_concurrent_refresh_only_one_wins(auth_client: AsyncMock) -> None:
    """Two concurrent refreshes against the same token should produce exactly one success."""
    mock_db = auth_client
    user_id = uuid.uuid4()
    stored_rt = _fake_refresh_token(user_id)

    from app.services.auth import generate_refresh_token

    raw_rt, _ = generate_refresh_token()

    with patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo:
        MockRtRepo.return_value.rotate = AsyncMock(side_effect=[stored_rt, None])
        MockRtRepo.return_value.get_by_hash = AsyncMock(return_value=None)
        MockRtRepo.return_value.create = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            responses = await asyncio.gather(
                client.post("/auth/refresh", cookies={"rt": raw_rt}),
                client.post("/auth/refresh", cookies={"rt": raw_rt}),
            )

    status_codes = sorted(response.status_code for response in responses)
    assert status_codes == [200, 401]
    assert MockRtRepo.return_value.create.await_count == 1
    assert mock_db.commit.await_count == 1


# ---------------------------------------------------------------------------
# Logout + Me tests
# ---------------------------------------------------------------------------


async def test_logout_clears_rt_cookie_and_revokes_token(auth_client: AsyncMock) -> None:
    mock_db = auth_client
    user_id = uuid.uuid4()
    stored_rt = _fake_refresh_token(user_id)

    from app.services.auth import generate_refresh_token

    raw_rt, _ = generate_refresh_token()

    with patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo:
        MockRtRepo.return_value.get_by_hash = AsyncMock(return_value=stored_rt)
        MockRtRepo.return_value.revoke = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/logout",
                cookies={"rt": raw_rt},
            )

    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert "rt=" in set_cookie
    assert "Max-Age=0" in set_cookie


async def test_logout_without_jwt_still_clears_cookie_returns_200(
    auth_client: AsyncMock,
) -> None:
    # No rt cookie — logout should still return 200 and set clear cookie
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/auth/logout")

    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert "rt=" in set_cookie
    assert "Max-Age=0" in set_cookie


async def test_get_me_valid_jwt_returns_user_with_household_info(
    db_override: AsyncMock,
) -> None:
    """The /auth/me payload includes all memberships plus the default household fields."""
    household_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    second_household_id = uuid.UUID("00000000-0000-0000-0000-000000000003")
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    fake_membership = _fake_member(user_id, household_id)
    second_membership = _fake_member(user_id, second_household_id, role="admin")
    first_household = type("HouseholdStub", (), {"id": household_id, "name": "Home"})()
    second_household = type("HouseholdStub", (), {"id": second_household_id, "name": "Lab"})()

    with patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo:
        repo = MockHouseholdRepo.return_value
        repo.get_memberships_with_households_for_user = AsyncMock(
            return_value=[
                HouseholdMembershipWithName(
                    membership=fake_membership,
                    household_name=first_household.name,
                ),
                HouseholdMembershipWithName(
                    membership=second_membership,
                    household_name=second_household.name,
                ),
            ]
        )
        repo.get_by_id = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = create_access_token(user_id)
            resp = await client.get(
                "/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["household_id"] == str(household_id)
    assert body["role"] == "admin"
    assert len(body["memberships"]) == 2
    assert body["memberships"][0]["household_name"] == "Home"
    assert body["memberships"][1]["household_name"] == "Lab"
    repo.get_memberships_with_households_for_user.assert_awaited_once_with(db_override, user_id)
    repo.get_by_id.assert_not_awaited()


async def test_get_me_no_jwt_returns_401(mock_db: AsyncMock) -> None:
    """Without clearing auth dep overrides, we clear current_user specifically."""
    from app.deps import current_user

    async def _fake_db() -> Any:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db
    saved_cu = app.dependency_overrides.pop(current_user, None)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/auth/me")
    finally:
        app.dependency_overrides.pop(get_db, None)
        if saved_cu is not None:
            app.dependency_overrides[current_user] = saved_cu

    assert resp.status_code == 401


async def test_switch_household_returns_membership_info(db_override: AsyncMock) -> None:
    """/auth/switch-household returns the selected household metadata."""
    household_id = uuid.UUID("00000000-0000-0000-0000-000000000010")
    membership = _fake_member(uuid.UUID("00000000-0000-0000-0000-000000000001"), household_id)
    household = type("HouseholdStub", (), {"id": household_id, "name": "Lab"})()

    with patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo:
        MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=membership)
        MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/switch-household", json={"household_id": str(household_id)}
            )

    assert resp.status_code == 200
    assert resp.json() == {
        "household_id": str(household_id),
        "role": membership.role,
        "household_name": "Lab",
    }


async def test_switch_household_rejects_non_member(db_override: AsyncMock) -> None:
    """/auth/switch-household rejects households the caller does not belong to."""
    household_id = uuid.UUID("00000000-0000-0000-0000-000000000010")

    with patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo:
        MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=None)
        MockHouseholdRepo.return_value.get_by_id = AsyncMock(
            return_value=MagicMock(id=household_id)
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/switch-household", json={"household_id": str(household_id)}
            )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Admin reset-password tests (N-Q1)
# ---------------------------------------------------------------------------


async def test_admin_reset_password_returns_200(auth_client: AsyncMock) -> None:
    """Admin calls POST /auth/admin/reset-password for a same-household member → 200."""
    mock_db = auth_client
    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    household_id = uuid.UUID("00000000-0000-0000-0000-000000000010")
    admin_user = _fake_user(user_id=admin_id, username="admin")
    admin_member = _fake_member(admin_id, household_id, role="admin")
    target_user = _fake_user(username="bob")
    token = create_access_token(admin_id)

    with (
        patch("app.deps.UserRepo") as MockDepsUserRepo,
        patch("app.deps.HouseholdRepo") as MockDepsHouseholdRepo,
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHHRepo,
    ):
        MockDepsUserRepo.return_value.get_by_id = AsyncMock(return_value=admin_user)
        MockDepsHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(
            return_value=[admin_member]
        )
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=target_user)
        MockUserRepo.return_value.update_password_hash = AsyncMock()
        MockHHRepo.return_value.get_member = AsyncMock(
            return_value=_fake_member(target_user.id, household_id, role="member")
        )
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/admin/reset-password",
                json={"username": "bob", "new_password": "TempPass123!"},
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 200
    assert resp.json().get("ok") is True


async def test_non_admin_reset_password_returns_403(mock_db: AsyncMock) -> None:
    """Member (non-admin) calls reset-password → 403 (N-Q1)."""
    from fastapi import HTTPException
    from app.deps import require_admin

    async def _fake_db() -> Any:
        yield mock_db

    async def _non_admin() -> None:
        raise HTTPException(status_code=403, detail="Admin role required")

    app.dependency_overrides[get_db] = _fake_db
    app.dependency_overrides[require_admin] = _non_admin
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/admin/reset-password",
                json={"username": "bob", "new_password": "TempPass123!"},
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# N-Q2: no Google+username account merge (AC-062)
# ---------------------------------------------------------------------------


async def test_google_oauth_does_not_merge_with_existing_username_account(
    auth_client: AsyncMock,
) -> None:
    """OAuth callback must NOT merge google_sub with an existing username+password account.

    Alice has a username+password row. Google OAuth callback with Alice's email must
    create a SECOND distinct row (different google_sub), never update Alice's row.
    The callback looks up users by google_sub (not by email), so when no match is
    found, a new row is created — AC-062.
    """
    mock_db = auth_client

    # New google user row that will be created
    google_user = MagicMock()
    google_user.id = uuid.uuid4()
    google_user.username = None
    google_user.google_sub = "google-sub-alice"
    google_user.email = "alice@example.com"

    create_calls: list[dict[str, Any]] = []

    async def _mock_create(db: Any, **kwargs: Any) -> MagicMock:
        create_calls.append(kwargs)
        return google_user

    # Set up DB mock to return a proper OAuthState for the state lookup
    fake_oauth_state = MagicMock()
    fake_oauth_state.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=5
    )
    fake_oauth_state.pkce_verifier = "pkce-verifier-value"

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fake_oauth_state
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.delete = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()

    from app.models.base import get_db as _get_db

    async def _fake_db_dep() -> Any:
        yield mock_db

    app.dependency_overrides[_get_db] = _fake_db_dep

    mock_oauth_client = AsyncMock()
    mock_oauth_client.fetch_token = AsyncMock()
    mock_userinfo_response = MagicMock()
    mock_userinfo_response.json.return_value = {
        "sub": "google-sub-alice",
        "email": "alice@example.com",
        "name": "Alice",
        "picture": "",
    }
    mock_userinfo_response.raise_for_status = MagicMock()
    mock_oauth_client.get = AsyncMock(return_value=mock_userinfo_response)

    mock_client_class = MagicMock()
    mock_client_class.return_value.__aenter__ = AsyncMock(return_value=mock_oauth_client)
    mock_client_class.return_value.__aexit__ = AsyncMock(return_value=False)

    try:
        with (
            patch("app.auth.UserRepo") as MockUserRepo,
            patch("app.auth.HouseholdRepo") as MockHouseholdRepo,
            patch("app.auth.RefreshTokenRepo") as MockRtRepo,
            patch("app.auth.AsyncOAuth2Client", mock_client_class),
        ):
            # get_by_google_sub returns None → no existing google account for this sub
            MockUserRepo.return_value.get_by_google_sub = AsyncMock(return_value=None)
            MockUserRepo.return_value.create = _mock_create
            MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
            MockHouseholdRepo.return_value.seed_default_household = AsyncMock()
            MockRtRepo.return_value.create = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
                follow_redirects=False,
            ) as client:
                resp = await client.get("/auth/google/callback?state=somestate&code=somecode")
    finally:
        app.dependency_overrides.pop(_get_db, None)

    # Callback should redirect to /login?oauth_success=1, not error
    assert resp.status_code == 302
    assert "oauth_success=1" in resp.headers.get("location", ""), (
        f"Expected oauth_success redirect, got: {resp.headers.get('location')}"
    )

    # A new user was CREATED (not merged into alice's existing username+password row)
    assert len(create_calls) >= 1, "UserRepo.create must have been called for the new google user"
    created = create_calls[0]
    assert created.get("google_sub") == "google-sub-alice", (
        "New user must carry the google_sub — no merge with alice's account"
    )
    assert created.get("username") is None, (
        "OAuth user must have no username (not merged with alice's username+password account)"
    )


# ---------------------------------------------------------------------------
# N-Q6: ALLOWLIST_EMAILS does not block registration (AC-063)
# ---------------------------------------------------------------------------


async def test_allowlist_emails_does_not_block_registration(auth_client: AsyncMock) -> None:
    """Setting allowlist_emails must NOT block POST /auth/register (AC-063)."""
    from app.config import settings

    mock_db = auth_client
    user = _fake_user(username="newuser")

    original_allowlist = settings.allowlist_emails
    settings.allowlist_emails = "other@example.com"
    try:
        with (
            patch("app.routers.api_auth.UserRepo") as MockUserRepo,
            patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo,
            patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo,
        ):
            MockUserRepo.return_value.get_by_username = AsyncMock(return_value=None)
            MockUserRepo.return_value.create = AsyncMock(return_value=user)
            MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
            MockHouseholdRepo.return_value.seed_default_household = AsyncMock()
            MockRtRepo.return_value.create = AsyncMock()
            mock_db.commit = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/auth/register",
                    json={"username": "newuser", "password": "ValidPass!234"},
                )
    finally:
        settings.allowlist_emails = original_allowlist

    assert resp.status_code == 201, (
        f"ALLOWLIST_EMAILS must not block registration, got {resp.status_code}: {resp.text}"
    )


# ---------------------------------------------------------------------------
# N-Q3: Expired refresh token path (AC-034)
# ---------------------------------------------------------------------------


async def test_refresh_expired_token_rejected(auth_client: AsyncMock) -> None:
    """Expired refresh tokens rejected by the atomic rotation query return 401."""
    mock_db = auth_client

    from app.services.auth import generate_refresh_token

    raw_rt, _ = generate_refresh_token()

    expired_rt = _fake_refresh_token(
        uuid.uuid4(),
        expires_at=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1),
    )

    with patch("app.routers.api_auth.RefreshTokenRepo") as MockRtRepo:
        MockRtRepo.return_value.rotate = AsyncMock(return_value=None)
        MockRtRepo.return_value.get_by_hash = AsyncMock(return_value=expired_rt)
        MockRtRepo.return_value.revoke_all_for_user = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/auth/refresh", cookies={"rt": raw_rt})

    assert resp.status_code == 401
    assert "invalid refresh token" == resp.json().get("detail", "").lower()
    MockRtRepo.return_value.revoke_all_for_user.assert_not_called()
    assert mock_db.commit.await_count == 0


# ---------------------------------------------------------------------------
# N-Q4: Admin reset-password cross-household isolation
# ---------------------------------------------------------------------------


async def test_admin_reset_password_cross_household_blocked(auth_client: AsyncMock) -> None:
    """Admin in household A cannot reset password for user only in household B (404, no leak)."""
    mock_db = auth_client
    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    household_a_id = uuid.UUID("00000000-0000-0000-0000-000000000010")
    admin_user = _fake_user(user_id=admin_id, username="admin-a")
    admin_member = _fake_member(admin_id, household_a_id, role="admin")

    target_user = _fake_user(username="bob-in-b")
    token = create_access_token(admin_id)

    with (
        patch("app.deps.UserRepo") as MockDepsUserRepo,
        patch("app.deps.HouseholdRepo") as MockDepsHouseholdRepo,
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHHRepo,
    ):
        MockDepsUserRepo.return_value.get_by_id = AsyncMock(return_value=admin_user)
        MockDepsHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(
            return_value=[admin_member]
        )
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=target_user)
        MockHHRepo.return_value.get_member = AsyncMock(return_value=None)
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/admin/reset-password",
                json={"username": "bob-in-b", "new_password": "TempPass123!"},
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 404, (
        f"Expected 404 for cross-household reset, got {resp.status_code}: {resp.text}"
    )


async def test_admin_reset_password_same_household_succeeds(auth_client: AsyncMock) -> None:
    """Admin resets password for a member of the same household → 200."""
    mock_db = auth_client
    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    household_a_id = uuid.UUID("00000000-0000-0000-0000-000000000010")
    admin_user = _fake_user(user_id=admin_id, username="admin-a")
    admin_member = _fake_member(admin_id, household_a_id, role="admin")
    target_user = _fake_user(username="carol")
    token = create_access_token(admin_id)

    with (
        patch("app.deps.UserRepo") as MockDepsUserRepo,
        patch("app.deps.HouseholdRepo") as MockDepsHouseholdRepo,
        patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        patch("app.routers.api_auth.HouseholdRepo") as MockHHRepo,
    ):
        MockDepsUserRepo.return_value.get_by_id = AsyncMock(return_value=admin_user)
        MockDepsHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(
            return_value=[admin_member]
        )
        MockUserRepo.return_value.get_by_username = AsyncMock(return_value=target_user)
        MockUserRepo.return_value.update_password_hash = AsyncMock()
        MockHHRepo.return_value.get_member = AsyncMock(
            return_value=_fake_member(target_user.id, household_a_id, role="member")
        )
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/auth/admin/reset-password",
                json={"username": "carol", "new_password": "TempPass123!"},
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 200
    assert resp.json().get("ok") is True

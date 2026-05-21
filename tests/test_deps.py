"""US-4.3 — Dependency injection unit tests.

Tests for current_user, current_household_membership, require_admin,
resolve_guest_or_member, and the OAuth PKCE callback (N-Q3).
"""

from __future__ import annotations

import datetime
import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.deps import (
    current_household_membership,
    current_user,
    require_admin,
)
from app.main import app
from app.models.base import get_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_user(
    user_id: uuid.UUID | None = None,
    email: str = "user@example.com",
    is_admin: bool = False,
) -> MagicMock:
    u = MagicMock()
    u.id = user_id or uuid.uuid4()
    u.email = email
    u.is_admin = is_admin
    return u


def _make_membership(
    user_id: uuid.UUID | None = None,
    household_id: uuid.UUID | None = None,
    role: str = "member",
) -> MagicMock:
    m = MagicMock()
    m.user_id = user_id or uuid.uuid4()
    m.household_id = household_id or uuid.uuid4()
    m.role = role
    return m


# ---------------------------------------------------------------------------
# current_user — JWT validation (US-4.3)
# ---------------------------------------------------------------------------


async def test_current_user_valid_jwt_returns_user_orm_object() -> None:
    """Valid JWT → returns User ORM object from DB (US-4.3)."""
    import app.deps as deps_module

    user_id = uuid.uuid4()
    fake_user = _make_user(user_id)
    mock_db = AsyncMock()

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.decode_access_token", return_value=user_id),
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=fake_user)
        result = await current_user(token="valid.jwt.token", db=mock_db)

    assert result is fake_user
    MockUserRepo.return_value.get_by_id.assert_awaited_once_with(mock_db, user_id)


async def test_current_user_expired_jwt_raises_401() -> None:
    """Expired JWT → 401 HTTPException (US-4.3)."""
    import app.deps as deps_module
    from fastapi import HTTPException

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch(
            "app.deps.decode_access_token",
            side_effect=HTTPException(status_code=401, detail="Invalid or expired token"),
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await current_user(token="expired.jwt.token", db=AsyncMock())

    assert exc_info.value.status_code == 401


async def test_current_user_invalid_jwt_raises_401() -> None:
    """Invalid / malformed JWT → 401 HTTPException (US-4.3)."""
    import app.deps as deps_module
    from fastapi import HTTPException

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch(
            "app.deps.decode_access_token",
            side_effect=HTTPException(status_code=401, detail="Invalid or expired token"),
        ),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await current_user(token="garbage", db=AsyncMock())

    assert exc_info.value.status_code == 401


async def test_current_user_valid_jwt_unknown_user_raises_401() -> None:
    """Valid JWT but user not in DB → 401 HTTPException (US-4.3)."""
    import app.deps as deps_module
    from fastapi import HTTPException

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.decode_access_token", return_value=uuid.uuid4()),
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc_info:
            await current_user(token="valid.but.unknown", db=AsyncMock())

    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# current_household_membership — RLS session variable (US-4.3)
# ---------------------------------------------------------------------------


async def test_current_household_membership_sets_rls_variable() -> None:
    """Resolving membership executes SET LOCAL app.current_household_id (US-4.3)."""
    import app.deps as deps_module

    hh_id = uuid.uuid4()
    fake_user = _make_user()
    fake_membership = _make_membership(household_id=hh_id)
    mock_db = AsyncMock()

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.HouseholdRepo") as MockHHRepo,
    ):
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[fake_membership])
        result = await current_household_membership(user=fake_user, db=mock_db)

    assert result is fake_membership
    # Verify SET LOCAL was called with the correct household ID
    mock_db.execute.assert_awaited_once()
    call_args = mock_db.execute.call_args
    stmt_text = str(call_args[0][0])
    assert "app.current_household_id" in stmt_text
    params = call_args[0][1] if len(call_args[0]) > 1 else call_args[1].get("params", {})
    assert str(hh_id) in str(params)


async def test_current_household_membership_no_membership_raises_403() -> None:
    """User with no household → 403 HTTPException (US-4.3)."""
    import app.deps as deps_module
    from fastapi import HTTPException

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.HouseholdRepo") as MockHHRepo,
    ):
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        with pytest.raises(HTTPException) as exc_info:
            await current_household_membership(user=_make_user(), db=AsyncMock())

    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# require_admin (US-4.3)
# ---------------------------------------------------------------------------


async def test_require_admin_passes_for_admin_member() -> None:
    """Admin role → dep passes through and returns membership (US-4.3)."""
    admin_m = _make_membership(role="admin")
    result = await require_admin(membership=admin_m)
    assert result is admin_m


async def test_require_admin_raises_403_for_member_role() -> None:
    """Non-admin role → 403 HTTPException (US-4.3)."""
    from fastapi import HTTPException

    member_m = _make_membership(role="member")
    with pytest.raises(HTTPException) as exc_info:
        await require_admin(membership=member_m)

    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# N-Q3 — OAuth PKCE flow reads from oauth_states DB (not SessionMiddleware)
# ---------------------------------------------------------------------------


async def test_oauth_callback_reads_pkce_verifier_from_oauth_states_not_session() -> None:
    """Callback reads pkce_verifier from oauth_states DB table, not session (N-Q3)."""
    from app.models.household import OAuthState

    state_val = "test-state-value-xyz"
    pkce_verifier_val = "test-pkce-verifier-123"
    fake_oauth_state = MagicMock(spec=OAuthState)
    fake_oauth_state.pkce_verifier = pkce_verifier_val
    fake_oauth_state.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=10
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fake_oauth_state
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def _fake_db() -> AsyncGenerator:
        yield mock_db

    fake_token = {
        "userinfo": {
            "sub": "google-sub-abc",
            "email": "test@example.com",
            "name": "Test User",
            "picture": "",
        }
    }

    from app.services.auth import create_access_token  # noqa: F401 — unused but verifies importability

    with (
        patch("app.auth.oauth.google.authorize_access_token", AsyncMock(return_value=fake_token)),
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        fake_user = _make_user(email="test@example.com")
        MockUserRepo.return_value.get_by_google_sub = AsyncMock(return_value=fake_user)
        MockUserRepo.return_value.create = AsyncMock(return_value=fake_user)
        MockUserRepo.return_value.update_last_login = AsyncMock()

        with patch("app.auth.UserRepo") as AuthMockUserRepo:
            AuthMockUserRepo.return_value.get_by_google_sub = AsyncMock(return_value=fake_user)
            AuthMockUserRepo.return_value.create = AsyncMock(return_value=fake_user)
            AuthMockUserRepo.return_value.update_last_login = AsyncMock()

            with patch("app.auth.RefreshTokenRepo") as MockRTRepo:
                MockRTRepo.return_value.create = AsyncMock()

                app.dependency_overrides[get_db] = _fake_db
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    _ = await client.get(
                        f"/auth/google/callback?state={state_val}&code=authcode123",
                        follow_redirects=False,
                    )
                app.dependency_overrides.pop(get_db, None)

    # The callback should have called db.execute to look up the OAuthState
    execute_calls = [str(call[0][0]) for call in mock_db.execute.call_args_list if call[0]]
    assert any("oauth_state" in call.lower() for call in execute_calls), (
        f"Expected DB execute call for OAuthState lookup; calls were: {execute_calls}"
    )


async def test_oauth_callback_rejects_unknown_state() -> None:
    """Unknown state token → redirect to /login?error=oauth_failed (N-Q3)."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # state not found
    mock_db.execute = AsyncMock(return_value=mock_result)

    async def _fake_db() -> AsyncGenerator:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/auth/google/callback?state=unknown-state&code=code123",
            follow_redirects=False,
        )
    app.dependency_overrides.pop(get_db, None)

    assert resp.status_code == 302
    assert "oauth_failed" in resp.headers.get("location", "")

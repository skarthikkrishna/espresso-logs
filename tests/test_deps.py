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


async def test_current_user_e2e_bypass_no_longer_short_circuits_jwt() -> None:
    """E2E_AUTH_BYPASS no longer short-circuits JWT validation in current_user."""
    import app.deps as deps_module
    from fastapi import HTTPException

    mock_db = AsyncMock()

    with patch.object(deps_module, "_E2E_AUTH_BYPASS", True):
        with pytest.raises(HTTPException) as exc_info:
            await current_user(token=None, db=mock_db)

    assert exc_info.value.status_code == 401
    mock_db.execute.assert_not_awaited()


# ---------------------------------------------------------------------------
# current_household_membership — RLS session variable (US-4.3)
# ---------------------------------------------------------------------------


async def test_current_household_membership_sets_rls_variable() -> None:
    """Resolving membership executes SET LOCAL app.current_household_id (US-4.3).

    Spec-040: when active_household_id is None, the fallback path now also
    persists the chosen household via set_active_household before setting
    the RLS variable — so db.execute is called more than once.
    """
    import app.deps as deps_module

    hh_id = uuid.uuid4()
    fake_user = _make_user()
    fake_user.active_household_id = None
    fake_membership = _make_membership(household_id=hh_id)
    mock_db = AsyncMock()

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.HouseholdRepo") as MockHHRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[fake_membership])
        MockUserRepo.return_value.set_active_household = AsyncMock()
        result = await current_household_membership(user=fake_user, db=mock_db)

    assert result is fake_membership
    assert fake_user.active_household_id == hh_id
    MockUserRepo.return_value.set_active_household.assert_awaited_once_with(
        mock_db, fake_user.id, hh_id
    )
    rls_calls = [
        call
        for call in mock_db.execute.await_args_list
        if "app.current_household_id" in str(call.args[0])
    ]
    assert len(rls_calls) == 1
    assert str(hh_id) in str(rls_calls[0].args)


async def test_current_household_membership_e2e_bypass_uses_real_membership() -> None:
    """E2E_AUTH_BYPASS no longer short-circuits membership resolution.

    Spec-040: fallback path persists active household before RLS set_config,
    so db.execute is called more than once. Verify no synthetic INSERT INTO
    households and that RLS variable is set correctly.
    """
    import app.deps as deps_module

    hh_id = uuid.uuid4()
    fake_user = _make_user()
    fake_user.active_household_id = None
    fake_membership = _make_membership(household_id=hh_id)
    mock_db = AsyncMock()

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", True),
        patch("app.deps.HouseholdRepo") as MockHHRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[fake_membership])
        MockUserRepo.return_value.set_active_household = AsyncMock()
        result = await current_household_membership(user=fake_user, db=mock_db)

    assert result is fake_membership
    rls_calls = [
        call
        for call in mock_db.execute.await_args_list
        if "app.current_household_id" in str(call.args[0])
    ]
    assert len(rls_calls) == 1
    assert not any(
        "INSERT INTO households" in str(call.args[0]) for call in mock_db.execute.await_args_list
    )


async def test_current_household_membership_no_membership_raises_403() -> None:
    """User with no household memberships returns 403."""
    import app.deps as deps_module
    from fastapi import HTTPException

    fake_user = _make_user()
    fake_user.active_household_id = None

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.HouseholdRepo") as MockHHRepo,
    ):
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        with pytest.raises(HTTPException) as exc_info:
            await current_household_membership(user=fake_user, db=AsyncMock())

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "User has no household memberships"


async def test_current_household_membership_uses_active_household() -> None:
    """Persisted active_household_id selects the matching membership."""
    import app.deps as deps_module

    hh_id = uuid.uuid4()
    fake_user = _make_user()
    fake_user.active_household_id = hh_id
    fake_membership = _make_membership(user_id=fake_user.id, household_id=hh_id)
    mock_db = AsyncMock()

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.HouseholdRepo") as MockHHRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHHRepo.return_value.get_member = AsyncMock(return_value=fake_membership)
        MockHHRepo.return_value.get_by_id = AsyncMock(return_value=MagicMock(id=hh_id))
        MockUserRepo.return_value.clear_active_household = AsyncMock()
        result = await current_household_membership(user=fake_user, db=mock_db)

    assert result is fake_membership
    MockHHRepo.return_value.get_member.assert_awaited_once_with(mock_db, hh_id, fake_user.id)
    MockUserRepo.return_value.clear_active_household.assert_not_called()


async def test_current_household_membership_clears_invalid_active_household() -> None:
    """Invalid persisted active household is cleared then repaired to fallback.

    Spec-040: after clearing the stale active household, the fallback path
    persists the first valid membership as the new active household. So
    active_household_id ends up as the fallback, not None.
    """
    import app.deps as deps_module

    stale_household_id = uuid.uuid4()
    fallback_membership = _make_membership(household_id=uuid.uuid4())
    fake_user = _make_user()
    fake_user.active_household_id = stale_household_id
    mock_db = AsyncMock()

    with (
        patch.object(deps_module, "_E2E_AUTH_BYPASS", False),
        patch("app.deps.HouseholdRepo") as MockHHRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHHRepo.return_value.get_member = AsyncMock(return_value=None)
        MockHHRepo.return_value.get_by_id = AsyncMock(return_value=MagicMock(id=stale_household_id))
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(
            return_value=[fallback_membership]
        )
        MockUserRepo.return_value.clear_active_household = AsyncMock()
        MockUserRepo.return_value.set_active_household = AsyncMock()
        result = await current_household_membership(user=fake_user, db=mock_db)

    assert result is fallback_membership
    MockUserRepo.return_value.clear_active_household.assert_awaited_once_with(mock_db, fake_user.id)
    MockUserRepo.return_value.set_active_household.assert_awaited_once_with(
        mock_db, fake_user.id, fallback_membership.household_id
    )
    assert fake_user.active_household_id == fallback_membership.household_id


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

    mock_oauth_client = AsyncMock()
    mock_oauth_client.fetch_token = AsyncMock()
    mock_userinfo_response = MagicMock()
    mock_userinfo_response.json.return_value = {
        "sub": "google-sub-abc",
        "email": "test@example.com",
        "name": "Test User",
        "picture": "",
    }
    mock_userinfo_response.raise_for_status = MagicMock()
    mock_oauth_client.get = AsyncMock(return_value=mock_userinfo_response)

    mock_client_class = MagicMock()
    mock_client_class.return_value.__aenter__ = AsyncMock(return_value=mock_oauth_client)
    mock_client_class.return_value.__aexit__ = AsyncMock(return_value=False)

    from app.services.auth import create_access_token  # noqa: F401 — unused but verifies importability

    with (
        patch("app.auth.AsyncOAuth2Client", mock_client_class),
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
    mock_oauth_client.fetch_token.assert_awaited_once()
    fetch_call = mock_oauth_client.fetch_token.await_args
    assert fetch_call.args == ("https://oauth2.googleapis.com/token",)
    assert fetch_call.kwargs["code"] == "authcode123"
    assert fetch_call.kwargs["code_verifier"] == pkce_verifier_val


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

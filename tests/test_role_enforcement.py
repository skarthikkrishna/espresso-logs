"""Real JWT/role enforcement tests — no require_admin dep override allowed.

These tests exercise the full auth chain:
  create_access_token → real current_user → real current_household_membership →
  real require_admin (role check).

All route-absent tests are marked xfail(strict=True) pending Alex implementation.
Guest revoke test uses the real resolve_guest_or_member dep with patched repo.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.base import get_db
from app.rate_limit import limiter
from app.services.auth import create_access_token


# ---------------------------------------------------------------------------
# Rate limiter reset
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:  # type: ignore[return]
    limiter._storage.reset()
    yield
    limiter._storage.reset()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fake_user_obj(user_id: uuid.UUID, username: str = "testmember") -> MagicMock:
    u = MagicMock()
    u.id = user_id
    u.username = username
    u.display_name = username.title()
    u.email = f"{username}@example.com"
    u.picture_url = None
    return u


def _fake_member_obj(
    user_id: uuid.UUID,
    household_id: uuid.UUID,
    role: str = "member",
) -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.user_id = user_id
    m.household_id = household_id
    m.role = role
    m.joined_at = datetime.datetime.now(datetime.timezone.utc)
    return m


# ---------------------------------------------------------------------------
# Fixture: real JWT auth chain via patched repos (no require_admin override)
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_db() -> AsyncMock:
    db = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock())
    return db


@pytest.fixture()
def real_auth_client(mock_db: AsyncMock):  # type: ignore[no-untyped-def]
    """Client with real JWT/current_user/current_household_membership deps.

    Clears the autouse auth dep overrides so the real dep functions run.
    Overrides get_db to yield mock_db.
    Does NOT override require_admin — tests must drive role via patched repos.
    """
    from app.deps import (
        current_household_membership,
        current_user,
        require_admin,
        resolve_guest_or_member,
    )

    async def _fake_get_db() -> Any:
        yield mock_db

    deps_to_clear = [
        current_user,
        current_household_membership,
        require_admin,
        resolve_guest_or_member,
    ]
    saved: dict[Any, Any] = {}
    for dep in deps_to_clear:
        if dep in app.dependency_overrides:
            saved[dep] = app.dependency_overrides.pop(dep)

    app.dependency_overrides[get_db] = _fake_get_db

    yield mock_db

    app.dependency_overrides.pop(get_db, None)
    for dep, override in saved.items():
        app.dependency_overrides[dep] = override


# ---------------------------------------------------------------------------
# Group 4: Member cannot perform admin-only household mutations
# (routes absent → xfail strict)
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    strict=True,
    reason="Alex fix pending: PATCH /households/{id} rename route not yet implemented",
)
async def test_member_cannot_rename_household(real_auth_client: AsyncMock) -> None:
    """Member (role='member') cannot rename a household → 403.

    Uses real JWT → current_user → current_household_membership → require_admin chain.
    No require_admin override permitted.
    """
    _ = real_auth_client  # fixture activates dependency overrides
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    member = _fake_member_obj(user_id, household_id, role="member")
    user = _fake_user_obj(user_id)

    token = create_access_token(user_id)

    with (
        patch("app.deps.UserRepo") as MockUserRepo,
        patch("app.deps.HouseholdRepo") as MockHHRepo,
    ):
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=user)
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[member])

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.patch(
                f"/households/{household_id}",
                json={"name": "Renamed Household"},
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 403, (
        f"Member must not rename household, got {resp.status_code}: {resp.text}"
    )


@pytest.mark.xfail(
    strict=True,
    reason="Alex fix pending: DELETE /households/{id} route not yet implemented",
)
async def test_member_cannot_delete_household(real_auth_client: AsyncMock) -> None:
    """Member (role='member') cannot delete a household → 403."""
    _ = real_auth_client  # fixture activates dependency overrides
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    member = _fake_member_obj(user_id, household_id, role="member")
    user = _fake_user_obj(user_id)

    token = create_access_token(user_id)

    with (
        patch("app.deps.UserRepo") as MockUserRepo,
        patch("app.deps.HouseholdRepo") as MockHHRepo,
    ):
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=user)
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[member])

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(
                f"/households/{household_id}",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 403, (
        f"Member must not delete household, got {resp.status_code}: {resp.text}"
    )


@pytest.mark.xfail(
    strict=True,
    reason="Alex fix pending: DELETE /households/{id}/invitations/{invite_id} route not yet implemented",
)
async def test_member_cannot_revoke_invite(real_auth_client: AsyncMock) -> None:
    """Member (role='member') cannot revoke an invitation → 403."""
    _ = real_auth_client  # fixture activates dependency overrides
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    invite_id = uuid.uuid4()
    member = _fake_member_obj(user_id, household_id, role="member")
    user = _fake_user_obj(user_id)

    token = create_access_token(user_id)

    with (
        patch("app.deps.UserRepo") as MockUserRepo,
        patch("app.deps.HouseholdRepo") as MockHHRepo,
    ):
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=user)
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[member])

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(
                f"/households/{household_id}/invitations/{invite_id}",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 403, (
        f"Member must not revoke invite, got {resp.status_code}: {resp.text}"
    )


@pytest.mark.xfail(
    strict=True,
    reason="Alex fix pending: PATCH /households/{id} rename route not yet implemented",
)
async def test_admin_can_rename_household(real_auth_client: AsyncMock) -> None:
    """Admin can rename their household → 200 (happy path, route pending)."""
    _ = real_auth_client  # fixture activates dependency overrides
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    admin_member = _fake_member_obj(user_id, household_id, role="admin")
    user = _fake_user_obj(user_id)

    renamed_hh = MagicMock()
    renamed_hh.id = household_id
    renamed_hh.name = "New Name"
    renamed_hh.created_at = datetime.datetime.now(datetime.timezone.utc)

    token = create_access_token(user_id)

    with (
        patch("app.deps.UserRepo") as MockUserRepo,
        patch("app.deps.HouseholdRepo") as MockHHRepo,
        patch("app.routers.api_households.HouseholdRepo") as MockHHRepoRouter,
    ):
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=user)
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[admin_member])
        MockHHRepoRouter.return_value.rename_household = AsyncMock(return_value=renamed_hh)
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.patch(
                f"/households/{household_id}",
                json={"name": "New Name"},
                headers={"Authorization": f"Bearer {token}"},
            )

    assert resp.status_code == 200, (
        f"Admin should be able to rename household, got {resp.status_code}: {resp.text}"
    )


# ---------------------------------------------------------------------------
# Group 7: Guest token revoke flow — real resolve_guest_or_member dep
# ---------------------------------------------------------------------------


async def test_guest_token_revoked_access_rejected(mock_db: AsyncMock) -> None:
    """Revoked/replaced guest token returns 401 on GET /api/brew-log.

    Uses the real resolve_guest_or_member dep with patched HouseholdRepo
    returning None (simulating a revoked / replaced token that is no longer
    in the active guest_tokens table).
    No resolve_guest_or_member override is set.
    """
    from app.deps import (
        current_household_membership,
        current_user,
        require_admin,
        resolve_guest_or_member,
    )

    async def _fake_get_db() -> Any:
        yield mock_db

    # Clear ALL auth overrides so real resolve_guest_or_member runs
    deps_to_clear = [
        current_user,
        current_household_membership,
        require_admin,
        resolve_guest_or_member,
    ]
    saved: dict[Any, Any] = {}
    for dep in deps_to_clear:
        if dep in app.dependency_overrides:
            saved[dep] = app.dependency_overrides.pop(dep)

    app.dependency_overrides[get_db] = _fake_get_db

    old_token = "old-revoked-guest-token-xyz"

    try:
        with patch("app.deps.HouseholdRepo") as MockHHRepo:
            # Token was revoked: get_guest_token_by_hash returns None
            MockHHRepo.return_value.get_guest_token_by_hash = AsyncMock(return_value=None)

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(f"/api/brew-log?guest={old_token}")
    finally:
        app.dependency_overrides.pop(get_db, None)
        for dep, override in saved.items():
            app.dependency_overrides[dep] = override

    assert resp.status_code in (401, 403), (
        f"Expected 401/403 for revoked guest token, got {resp.status_code}: {resp.text}"
    )

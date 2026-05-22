"""Wave 4 tests — US-4.2: household API lifecycle tests.

Tests exercise app/routers/api_households.py endpoints.
Auth dep overrides from conftest.py autouse fixture remain active by default;
tests that need specific role state override the relevant deps inline.
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
from app.services.auth import hash_token


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


def _fake_user(username: str = "alice", user_id: uuid.UUID | None = None) -> MagicMock:
    u = MagicMock()
    u.id = user_id or uuid.uuid4()
    u.username = username
    u.display_name = username.title()
    u.email = f"{username}@example.com"
    u.picture_url = None
    return u


def _fake_member(
    user_id: uuid.UUID,
    household_id: uuid.UUID,
    role: str = "admin",
) -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.user_id = user_id
    m.household_id = household_id
    m.role = role
    m.joined_at = datetime.datetime.now(datetime.timezone.utc)
    return m


def _fake_household(
    household_id: uuid.UUID | None = None,
    name: str = "Home",
    is_guest_accessible: bool = False,
) -> MagicMock:
    h = MagicMock()
    h.id = household_id or uuid.uuid4()
    h.name = name
    h.created_at = datetime.datetime.now(datetime.timezone.utc)
    h.created_by = uuid.uuid4()
    h.is_guest_accessible = is_guest_accessible
    return h


def _fake_invitation(
    household_id: uuid.UUID,
    token_hash: str = "fakehash",
    expired: bool = False,
    accepted: bool = False,
    revoked: bool = False,
) -> MagicMock:
    inv = MagicMock()
    inv.id = uuid.uuid4()
    inv.household_id = household_id
    inv.invited_by_user_id = uuid.uuid4()
    inv.token_hash = token_hash
    if expired:
        inv.expires_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    else:
        inv.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
    inv.accepted_at = datetime.datetime.now(datetime.timezone.utc) if accepted else None
    inv.revoked_at = datetime.datetime.now(datetime.timezone.utc) if revoked else None
    return inv


@pytest.fixture()
def mock_db() -> AsyncMock:
    db = AsyncMock()
    return db


@pytest.fixture()
def db_override(mock_db: AsyncMock):  # type: ignore[no-untyped-def]
    async def _fake_db() -> Any:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# US-4.2 Tests
# ---------------------------------------------------------------------------


async def test_create_household_returns_201_with_admin_role(db_override: AsyncMock) -> None:
    """POST /households creates a household with the caller as admin (AC-070)."""
    mock_db = db_override
    hh = _fake_household(name="My Coffee Corner")
    hh.role = "admin"

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.create_household = AsyncMock(return_value=hh)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/households", json={"name": "My Coffee Corner"})

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "My Coffee Corner"
    assert body["role"] == "admin"


async def test_get_households_me_returns_membership_list(db_override: AsyncMock) -> None:
    """GET /households/me returns all households the caller belongs to (AC-071)."""
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.uuid4()
    membership = _fake_member(user_id, hh_id)
    household = _fake_household(household_id=hh_id, name="Home")

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[membership])
        MockHHRepo.return_value.get_by_id = AsyncMock(return_value=household)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/households/me")

    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 1
    assert body[0]["name"] == "Home"


async def test_get_household_detail_returns_members_and_guest_accessible_field(
    db_override: AsyncMock,
) -> None:
    """GET /households/{id} includes is_guest_accessible (W-003, AC-072)."""
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    membership = _fake_member(user_id, hh_id)
    household = _fake_household(household_id=hh_id, name="Home", is_guest_accessible=True)
    member_row = _fake_member(user_id, hh_id)
    user_obj = _fake_user("alice", user_id)

    # Override current_household_membership to return our specific membership
    from app.deps import current_household_membership

    app.dependency_overrides[current_household_membership] = lambda: membership

    with (
        patch("app.routers.api_households.HouseholdRepo") as MockHHRepo,
        patch("app.routers.api_households.UserRepo") as MockUserRepo,
    ):
        MockHHRepo.return_value.get_by_id = AsyncMock(return_value=household)
        MockHHRepo.return_value.get_members = AsyncMock(return_value=[member_row])
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=user_obj)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/households/{hh_id}")

    app.dependency_overrides.pop(current_household_membership, None)

    assert resp.status_code == 200
    body = resp.json()
    assert body["is_guest_accessible"] is True
    assert "members" in body


async def test_invite_by_admin_returns_201_with_token(db_override: AsyncMock) -> None:
    """POST /households/{id}/invite as admin returns 201 with token (AC-073)."""
    mock_db = db_override
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    admin_member = _fake_member(user_id, hh_id, role="admin")
    invitation = MagicMock()
    invitation.id = uuid.uuid4()
    invitation.expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=7
    )

    from app.deps import require_admin

    app.dependency_overrides[require_admin] = lambda: admin_member

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.create_invitation = AsyncMock(return_value=invitation)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(f"/households/{hh_id}/invite")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 201
    body = resp.json()
    assert "token" in body
    assert "invitation_id" in body


async def test_invite_by_member_returns_403(db_override: AsyncMock) -> None:
    """POST /households/{id}/invite as member → 403 (AC-073)."""
    from fastapi import HTTPException
    from app.deps import require_admin

    async def _non_admin() -> None:
        raise HTTPException(status_code=403, detail="Admin role required")

    app.dependency_overrides[require_admin] = _non_admin

    hh_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(f"/households/{hh_id}/invite")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 403


async def test_accept_invite_valid_token_creates_membership(db_override: AsyncMock) -> None:
    """POST /households/accept-invite with valid token creates membership (AC-074)."""
    mock_db = db_override
    hh_id = uuid.uuid4()
    raw_token = "validrawtoken12345"
    inv = _fake_invitation(hh_id, token_hash=hash_token(raw_token))
    hh = _fake_household(household_id=hh_id, name="Home")

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_invitation_by_token_hash = AsyncMock(return_value=inv)
        MockHHRepo.return_value.get_member = AsyncMock(return_value=None)
        MockHHRepo.return_value.add_member = AsyncMock()
        MockHHRepo.return_value.accept_invitation = AsyncMock()
        MockHHRepo.return_value.get_by_id = AsyncMock(return_value=hh)
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/households/accept-invite", json={"token": raw_token})

    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "member"
    assert str(body["household_id"]) == str(hh_id)


async def test_accept_invite_expired_token_returns_410(db_override: AsyncMock) -> None:
    """Expired invitation returns 410 (AC-074)."""
    hh_id = uuid.uuid4()
    raw_token = "expiredtoken12345"
    inv = _fake_invitation(hh_id, token_hash=hash_token(raw_token), expired=True)

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_invitation_by_token_hash = AsyncMock(return_value=inv)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/households/accept-invite", json={"token": raw_token})

    assert resp.status_code == 410


async def test_accept_invite_already_accepted_returns_410(db_override: AsyncMock) -> None:
    """Already-accepted invitation returns 410 (AC-074)."""
    hh_id = uuid.uuid4()
    raw_token = "acceptedtoken12345"
    inv = _fake_invitation(hh_id, token_hash=hash_token(raw_token), accepted=True)

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_invitation_by_token_hash = AsyncMock(return_value=inv)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/households/accept-invite", json={"token": raw_token})

    assert resp.status_code == 410


async def test_accept_invite_duplicate_membership_returns_409(db_override: AsyncMock) -> None:
    """Already-a-member attempt returns 409 (AC-074)."""
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.uuid4()
    raw_token = "dupetoken123456789"
    inv = _fake_invitation(hh_id, token_hash=hash_token(raw_token))
    existing_member = _fake_member(user_id, hh_id)

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_invitation_by_token_hash = AsyncMock(return_value=inv)
        MockHHRepo.return_value.get_member = AsyncMock(return_value=existing_member)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/households/accept-invite", json={"token": raw_token})

    assert resp.status_code == 409


async def test_accept_invite_not_found_returns_404(db_override: AsyncMock) -> None:
    """Unknown token returns 404 (AC-074)."""
    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_invitation_by_token_hash = AsyncMock(return_value=None)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/households/accept-invite", json={"token": "nosuchtoken12345"}
            )

    assert resp.status_code == 404


async def test_remove_member_admin_returns_204(db_override: AsyncMock) -> None:
    """DELETE /households/{id}/members/{uid} as admin → 204 (AC-075)."""
    mock_db = db_override
    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    target_id = uuid.uuid4()
    admin_member = _fake_member(admin_id, hh_id, role="admin")

    from app.deps import require_admin

    app.dependency_overrides[require_admin] = lambda: admin_member

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.remove_member = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(f"/households/{hh_id}/members/{target_id}")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 204


async def test_remove_last_admin_returns_409(db_override: AsyncMock) -> None:
    """DELETE last admin from household → 409 (AC-075)."""
    from fastapi import HTTPException

    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    target_id = uuid.uuid4()  # a DIFFERENT user (not self) who happens to be the sole admin
    admin_member = _fake_member(admin_id, hh_id, role="admin")

    from app.deps import require_admin

    app.dependency_overrides[require_admin] = lambda: admin_member

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.remove_member = AsyncMock(
            side_effect=HTTPException(status_code=409, detail="Cannot remove the sole admin")
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.delete(f"/households/{hh_id}/members/{target_id}")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 409


async def test_remove_self_returns_403(db_override: AsyncMock) -> None:
    """Admin cannot remove themselves (AC-075)."""
    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    admin_member = _fake_member(admin_id, hh_id, role="admin")

    from app.deps import require_admin

    app.dependency_overrides[require_admin] = lambda: admin_member

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # admin_id == user_id → "Cannot remove yourself"
        resp = await client.delete(f"/households/{hh_id}/members/{admin_id}")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 403


async def test_patch_member_role_demote_last_admin_returns_409(db_override: AsyncMock) -> None:
    """PATCH role to 'member' for the last admin → 409 (AC-076)."""
    from fastapi import HTTPException

    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    target_id = uuid.uuid4()
    admin_member = _fake_member(admin_id, hh_id, role="admin")

    from app.deps import require_admin

    app.dependency_overrides[require_admin] = lambda: admin_member

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.update_member_role = AsyncMock(
            side_effect=HTTPException(status_code=409, detail="Cannot remove sole admin role")
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.patch(
                f"/households/{hh_id}/members/{target_id}",
                json={"role": "member"},
            )

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 409


async def test_get_guest_token_revokes_previous_token(db_override: AsyncMock) -> None:
    """GET /households/{id}/guest-token revokes previous tokens and creates a new one (AC-077)."""
    mock_db = db_override
    admin_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    admin_member = _fake_member(admin_id, hh_id, role="admin")
    guest_token_obj = MagicMock()
    guest_token_obj.id = uuid.uuid4()

    from app.deps import require_admin

    app.dependency_overrides[require_admin] = lambda: admin_member
    revoke_mock = AsyncMock()

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.revoke_previous_guest_tokens = revoke_mock
        MockHHRepo.return_value.create_guest_token = AsyncMock(return_value=guest_token_obj)
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(f"/households/{hh_id}/guest-token")

    app.dependency_overrides.pop(require_admin, None)

    assert resp.status_code == 200
    body = resp.json()
    assert "guest_url" in body
    revoke_mock.assert_called_once()


# ---------------------------------------------------------------------------
# Guest token scope tests (AC-094, AC-095, AC-096)
# ---------------------------------------------------------------------------


async def test_get_brew_log_with_valid_guest_token_returns_200(
    db_override: AsyncMock,
) -> None:
    """Valid guest token grants access to GET /api/brew-log (AC-094)."""
    from app.deps import (
        get_brew_log_repo,
        get_catalog_repo,
        get_hardware_repo,
        get_inventory_repo,
        resolve_guest_or_member,
    )

    hh_id = uuid.UUID("00000000-0000-0000-0000-000000000002")
    guest_tk = MagicMock()
    guest_tk.household_id = hh_id

    brew_repo = AsyncMock()
    brew_repo.list_paginated = AsyncMock(return_value=([], 0))
    inv_repo = AsyncMock()
    inv_repo.list = AsyncMock(return_value=[])
    cat_repo = AsyncMock()
    cat_repo.list = AsyncMock(return_value=[])
    hw_repo = AsyncMock()
    hw_repo.list = AsyncMock(return_value=[])

    app.dependency_overrides[resolve_guest_or_member] = lambda: guest_tk
    app.dependency_overrides[get_brew_log_repo] = lambda: brew_repo
    app.dependency_overrides[get_inventory_repo] = lambda: inv_repo
    app.dependency_overrides[get_catalog_repo] = lambda: cat_repo
    app.dependency_overrides[get_hardware_repo] = lambda: hw_repo

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/brew-log?guest=validtoken123")

    for dep in (
        resolve_guest_or_member,
        get_brew_log_repo,
        get_inventory_repo,
        get_catalog_repo,
        get_hardware_repo,
    ):
        app.dependency_overrides.pop(dep, None)

    assert resp.status_code == 200


async def test_get_catalog_with_guest_token_returns_403(
    db_override: AsyncMock,
) -> None:
    """Guest token must NOT grant access to catalog (AC-095).

    The /api/catalog endpoint requires current_household_membership (JWT-based),
    not resolve_guest_or_member. Clearing both user/membership overrides proves
    that a guest (with no JWT) cannot access catalog.
    """
    from fastapi import HTTPException
    from app.deps import current_household_membership, current_user

    async def _unauthenticated() -> None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    saved_cu = app.dependency_overrides.pop(current_user, None)
    saved_cm = app.dependency_overrides.pop(current_household_membership, None)
    app.dependency_overrides[current_user] = _unauthenticated
    app.dependency_overrides[current_household_membership] = _unauthenticated

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/catalog?guest=validtoken123")

    if saved_cu:
        app.dependency_overrides[current_user] = saved_cu
    else:
        app.dependency_overrides.pop(current_user, None)
    if saved_cm:
        app.dependency_overrides[current_household_membership] = saved_cm
    else:
        app.dependency_overrides.pop(current_household_membership, None)

    # Catalog requires JWT — guest token alone is insufficient → 401
    assert resp.status_code in (401, 403)


async def test_get_brew_log_with_revoked_guest_token_returns_401(
    db_override: AsyncMock,
) -> None:
    """Revoked guest token returns 401 on /api/brew-log (AC-096)."""
    from fastapi import HTTPException
    from app.deps import resolve_guest_or_member

    async def _revoked_guest() -> None:
        raise HTTPException(status_code=401, detail="Invalid or expired guest token")

    app.dependency_overrides[resolve_guest_or_member] = _revoked_guest

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/brew-log?guest=revokedtoken123")

    app.dependency_overrides.pop(resolve_guest_or_member, None)

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# N-Q5: Revoked and declined invitation paths
# ---------------------------------------------------------------------------


async def test_accept_revoked_invitation_rejected(db_override: AsyncMock) -> None:
    """Accepting a revoked invitation returns 410 (revoked_at is set).

    After an admin revokes an invitation its revoked_at timestamp is non-null.
    A subsequent accept attempt must return 404 or 410 — never 200.
    """
    hh_id = uuid.uuid4()
    raw_token = "revokedtoken1234567"
    inv = _fake_invitation(hh_id, token_hash=hash_token(raw_token), revoked=True)

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_invitation_by_token_hash = AsyncMock(return_value=inv)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/households/accept-invite", json={"token": raw_token})

    assert resp.status_code in (404, 410), (
        f"Expected 404 or 410 for revoked invitation, got {resp.status_code}: {resp.text}"
    )


@pytest.mark.xfail(
    strict=True,
    reason="Alex fix pending: decline invitation endpoint not yet implemented — "
    "POST/DELETE /households/decline-invite or equivalent does not exist",
)
async def test_decline_invitation(db_override: AsyncMock) -> None:
    """Invitee declines an invitation; the invite must no longer be pending.

    Expects a 200 response from a decline endpoint and verifies that a
    subsequent accept of the same token returns 404 or 410.
    """
    mock_db = db_override
    hh_id = uuid.uuid4()
    raw_token = "declinetoken123456"
    inv = _fake_invitation(hh_id, token_hash=hash_token(raw_token))

    with patch("app.routers.api_households.HouseholdRepo") as MockHHRepo:
        MockHHRepo.return_value.get_invitation_by_token_hash = AsyncMock(return_value=inv)
        MockHHRepo.return_value.revoke_invitation = AsyncMock()
        mock_db.commit = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Decline endpoint — expected at POST /households/decline-invite
            resp = await client.post("/households/decline-invite", json={"token": raw_token})

    assert resp.status_code == 200, (
        f"Expected 200 from decline-invite endpoint, got {resp.status_code}: {resp.text}"
    )

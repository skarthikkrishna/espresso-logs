"""Spec-040 contract tests for household invite, guest, privacy, and release rules."""

from __future__ import annotations

import datetime
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.deps import current_user, require_admin
from app.main import app
from app.models.base import get_db
from app.routers.api_auth import RegisterRequest

UTC = datetime.timezone.utc
SAFE_INVITE_TOKEN = "spec040-invite-token-redacted"


@pytest.fixture()
def mock_db() -> AsyncMock:
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture()
def db_override(mock_db: AsyncMock):  # type: ignore[no-untyped-def]
    async def _fake_db() -> Any:
        yield mock_db

    app.dependency_overrides[get_db] = _fake_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


def _fake_user(
    *,
    user_id: uuid.UUID | None = None,
    username: str = "spec040_admin",
    active_household_id: uuid.UUID | None = None,
) -> MagicMock:
    user = MagicMock()
    user.id = user_id or uuid.uuid4()
    user.username = username
    user.display_name = "Spec Admin"
    user.email = None
    user.picture_url = None
    user.active_household_id = active_household_id
    return user


def _fake_member(
    *,
    user_id: uuid.UUID,
    household_id: uuid.UUID,
    role: str = "admin",
) -> MagicMock:
    member = MagicMock()
    member.id = uuid.uuid4()
    member.user_id = user_id
    member.household_id = household_id
    member.role = role
    member.joined_at = datetime.datetime(2026, 6, 9, tzinfo=UTC)
    return member


def _fake_household(
    *,
    household_id: uuid.UUID,
    name: str = "Spec Household",
) -> MagicMock:
    household = MagicMock()
    household.id = household_id
    household.name = name
    household.created_at = datetime.datetime(2026, 6, 9, tzinfo=UTC)
    return household


def _fake_invitation(
    *,
    invitation_id: uuid.UUID | None = None,
    household_id: uuid.UUID,
    invited_by_user_id: uuid.UUID | None = None,
    status: str = "pending",
    invited_email: str | None = None,
) -> MagicMock:
    invitation = MagicMock()
    invitation.id = invitation_id or uuid.uuid4()
    invitation.household_id = household_id
    invitation.invited_by_user_id = invited_by_user_id or uuid.uuid4()
    invitation.invited_email = invited_email
    invitation.invited_role = "member"
    invitation.status = status
    invitation.invited_at = datetime.datetime(2026, 6, 9, tzinfo=UTC)
    invitation.expires_at = invitation.invited_at + datetime.timedelta(hours=72)
    invitation.accepted_at = None
    invitation.revoked_at = None
    return invitation


async def test_spec040_households_me_membership_contract_includes_counts_and_active_state(
    db_override: AsyncMock,
) -> None:
    """Profile/switcher memberships expose counts, active state, and manage capability."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    user = _fake_user(user_id=user_id, active_household_id=household_id)
    membership = _fake_member(user_id=user_id, household_id=household_id, role="admin")
    household = _fake_household(household_id=household_id)

    app.dependency_overrides[current_user] = lambda: user
    try:
        with patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo:
            MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(
                return_value=[membership],
            )
            MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household)
            MockHouseholdRepo.return_value.count_members = AsyncMock(return_value=3)

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="http://test",
            ) as client:
                response = await client.get("/households/me")
    finally:
        app.dependency_overrides.pop(current_user, None)

    assert response.status_code == 200, response.text
    [membership_body] = response.json()
    assert membership_body["household_id"] == str(household_id)
    assert membership_body["household_name"] == "Spec Household"
    assert membership_body["member_count"] == 3
    assert membership_body["is_active"] is True
    assert membership_body["can_manage"] is True


async def test_spec040_create_link_only_invitation_returns_copyable_url_and_delivery_metadata(
    db_override: AsyncMock,
) -> None:
    """Link-only invites return copyable invite_url, not a raw token field."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    admin_member = _fake_member(user_id=user_id, household_id=household_id, role="admin")
    invitation = _fake_invitation(household_id=household_id, invited_by_user_id=user_id)

    app.dependency_overrides[require_admin] = lambda: admin_member
    try:
        with patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo:
            MockHouseholdRepo.return_value.create_invitation = AsyncMock(return_value=invitation)

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="https://local.test",
            ) as client:
                response = await client.post(
                    "/households/invitations",
                    json={"invited_role": "member"},
                )
    finally:
        app.dependency_overrides.pop(require_admin, None)

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["invited_email"] is None
    assert body["invited_role"] == "member"
    assert body["status"] == "pending"
    assert body["invite_url"].startswith("https://local.test/invite/accept?token=")
    assert "token" not in body
    assert body["delivery"] == {
        "email_configured": False,
        "email_attempted": False,
        "email_sent": False,
    }


async def test_spec040_public_invitation_preview_is_get_and_never_consumes_token(
    db_override: AsyncMock,
) -> None:
    """Preview is a public GET contract and must not mutate invitation state."""
    household_id = uuid.uuid4()
    inviter_id = uuid.uuid4()
    invitation = _fake_invitation(
        household_id=household_id,
        invited_by_user_id=inviter_id,
    )
    household = _fake_household(household_id=household_id)
    inviter = _fake_user(user_id=inviter_id, username="spec040_inviter")

    with (
        patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo,
        patch("app.routers.api_households.UserRepo") as MockUserRepo,
    ):
        MockHouseholdRepo.return_value.get_invitation_by_token_hash = AsyncMock(
            return_value=invitation,
        )
        MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household)
        MockHouseholdRepo.return_value.accept_invitation = AsyncMock()
        MockHouseholdRepo.return_value.decline_invitation = AsyncMock()
        MockUserRepo.return_value.get_by_id = AsyncMock(return_value=inviter)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(f"/households/invitations/{SAFE_INVITE_TOKEN}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body == {
        "household_name": "Spec Household",
        "inviter_display_name": "Spec Admin",
        "invited_role": "member",
        "expires_at": invitation.expires_at.isoformat().replace("+00:00", "Z"),
        "status": "pending",
    }
    MockHouseholdRepo.return_value.accept_invitation.assert_not_awaited()
    MockHouseholdRepo.return_value.decline_invitation.assert_not_awaited()


async def test_spec040_decline_invitation_is_non_consuming_dismissal(
    db_override: AsyncMock,
) -> None:
    """Decline must not mark a token terminal, revoke it, or prevent later acceptance."""
    household_id = uuid.uuid4()
    invitation = _fake_invitation(household_id=household_id)

    with patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo:
        MockHouseholdRepo.return_value.get_invitation_by_token_hash = AsyncMock(
            return_value=invitation,
        )
        MockHouseholdRepo.return_value.decline_invitation = AsyncMock()
        MockHouseholdRepo.return_value.revoke_invitation = AsyncMock()
        MockHouseholdRepo.return_value.accept_invitation = AsyncMock()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                f"/households/invitations/{SAFE_INVITE_TOKEN}/decline",
            )

    assert response.status_code in {200, 204}, response.text
    MockHouseholdRepo.return_value.decline_invitation.assert_not_awaited()
    MockHouseholdRepo.return_value.revoke_invitation.assert_not_awaited()
    MockHouseholdRepo.return_value.accept_invitation.assert_not_awaited()
    db_override.commit.assert_not_awaited()


async def test_spec040_resend_invitation_rotates_to_fresh_copyable_url(
    db_override: AsyncMock,
) -> None:
    """Resend returns a fresh copyable URL and never exposes a standalone token field."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    invitation_id = uuid.uuid4()
    admin_member = _fake_member(user_id=user_id, household_id=household_id, role="admin")
    invitation = _fake_invitation(
        invitation_id=invitation_id,
        household_id=household_id,
        invited_by_user_id=user_id,
    )

    app.dependency_overrides[require_admin] = lambda: admin_member
    try:
        with patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo:
            MockHouseholdRepo.return_value.get_invitation_by_id = AsyncMock(return_value=invitation)
            MockHouseholdRepo.return_value.resend_invitation = AsyncMock(return_value=invitation)

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="https://local.test",
            ) as client:
                response = await client.post(
                    f"/households/invitations/{invitation_id}/resend",
                )
    finally:
        app.dependency_overrides.pop(require_admin, None)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["invitation_id"] == str(invitation_id)
    assert body["invite_url"].startswith("https://local.test/invite/accept?token=")
    assert "token" not in body


async def test_spec040_guest_token_lifecycle_uses_post_delete_and_view_key_url(
    db_override: AsyncMock,
) -> None:
    """Guest access is POST/DELETE and returns /households/{id}/view?key= URLs."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    admin_member = _fake_member(user_id=user_id, household_id=household_id, role="admin")

    app.dependency_overrides[require_admin] = lambda: admin_member
    try:
        with patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo:
            MockHouseholdRepo.return_value.revoke_previous_guest_tokens = AsyncMock()
            MockHouseholdRepo.return_value.revoke_guest_tokens = AsyncMock()
            MockHouseholdRepo.return_value.create_guest_token = AsyncMock()
            MockHouseholdRepo.return_value.revoke_guest_token_for_household = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app),
                base_url="https://local.test",
            ) as client:
                create_response = await client.post(f"/households/{household_id}/guest-token")
                delete_response = await client.delete(f"/households/{household_id}/guest-token")
    finally:
        app.dependency_overrides.pop(require_admin, None)

    assert create_response.status_code in {200, 201}, create_response.text
    guest_url = create_response.json()["guest_url"]
    assert guest_url.startswith(f"https://local.test/households/{household_id}/view?key=")
    assert "?guest=" not in guest_url
    assert delete_response.status_code == 204, delete_response.text


async def test_spec040_delete_household_requires_exact_confirm_name_before_repo_mutation(
    db_override: AsyncMock,
) -> None:
    """Destructive delete cannot execute without exact-name confirmation."""
    user_id = uuid.uuid4()
    household_id = uuid.uuid4()
    admin_member = _fake_member(user_id=user_id, household_id=household_id, role="admin")

    app.dependency_overrides[require_admin] = lambda: admin_member
    try:
        with patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo:
            MockHouseholdRepo.return_value.soft_delete = AsyncMock()
            MockHouseholdRepo.return_value.hard_delete = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.request("DELETE", f"/households/{household_id}", json={})
    finally:
        app.dependency_overrides.pop(require_admin, None)

    assert response.status_code in {400, 409, 422}, response.text
    MockHouseholdRepo.return_value.soft_delete.assert_not_awaited()
    MockHouseholdRepo.return_value.hard_delete.assert_not_awaited()
    db_override.commit.assert_not_awaited()


@pytest.mark.parametrize(
    "username",
    [
        "with-hyphen",
        "a" * 31,
        "a" * 32,
    ],
)
def test_spec040_username_contract_rejects_hyphen_and_over_30_chars(username: str) -> None:
    """Spec-040/v2 usernames are 3-30 letters, numbers, and underscores only."""
    with pytest.raises(ValidationError):
        RegisterRequest(
            username=username,
            password="correct-horse-battery-staple",
            display_name="Spec User",
        )


def test_spec040_username_contract_accepts_30_char_alnum_underscore() -> None:
    """The max-length valid username is exactly 30 characters."""
    request = RegisterRequest(
        username="abc_" + ("1" * 26),
        password="correct-horse-battery-staple",
        display_name="Spec User",
    )

    assert request.username == "abc_" + ("1" * 26)

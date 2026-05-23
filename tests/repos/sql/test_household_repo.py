"""Unit tests for HouseholdRepo (US-2.2).

Requires DATABASE_URL env var pointing to a live Postgres instance.
Tests are auto-skipped when DATABASE_URL is not set (see tests/repos/sql/conftest.py).
"""

from __future__ import annotations

import datetime
import uuid

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.repos.sql.household import HouseholdRepo
from app.repos.sql.user import UserRepo


async def _make_user(db: AsyncSession, username: str) -> uuid.UUID:
    repo = UserRepo()
    user = await repo.create(
        db,
        username=username,
        password_hash="pw",
        google_sub=None,
        email=None,
        display_name=username,
        picture_url=None,
    )
    await db.commit()
    return user.id


@pytest.mark.anyio
async def test_create_household_creates_admin_member(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session, "hh_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="TestHH", created_by=user_id)
    await db_session.commit()

    member = await repo.get_member(db_session, household.id, user_id)
    assert member is not None
    assert member.role == "admin"


@pytest.mark.anyio
async def test_count_admins(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session, "cnt_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="CntHH", created_by=user_id)
    await db_session.commit()

    count = await repo.count_admins(db_session, household.id)
    assert count == 1


@pytest.mark.anyio
async def test_update_member_role_prevents_demoting_sole_admin(
    db_session: AsyncSession,
) -> None:
    from fastapi import HTTPException

    user_id = await _make_user(db_session, "sole_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="SoleAdminHH", created_by=user_id)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await repo.update_member_role(
            db_session, household_id=household.id, user_id=user_id, new_role="member"
        )
    assert exc_info.value.status_code == 409


@pytest.mark.anyio
async def test_remove_member_prevents_removing_sole_admin(
    db_session: AsyncSession,
) -> None:
    from fastapi import HTTPException

    user_id = await _make_user(db_session, "rm_sole_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="RmSoleHH", created_by=user_id)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await repo.remove_member(db_session, household_id=household.id, user_id=user_id)
    assert exc_info.value.status_code == 409


@pytest.mark.anyio
async def test_accept_invitation_sets_accepted_at(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session, "inv_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="InvHH", created_by=user_id)
    await db_session.commit()

    invitation = await repo.create_invitation(
        db_session,
        household_id=household.id,
        invited_by_user_id=user_id,
        invited_email=None,
        invited_role="member",
        token_hash="deadbeef01234567",
    )
    await db_session.commit()

    await repo.accept_invitation(db_session, invitation.id)
    await db_session.commit()

    fetched = await repo.get_invitation_by_token_hash(db_session, "deadbeef01234567")
    assert fetched is not None
    assert fetched.accepted_at is not None
    assert fetched.status == "accepted"


@pytest.mark.anyio
async def test_create_invitation_uses_72_hour_expiry_and_role(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session, "invite_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="InvRoleHH", created_by=user_id)
    await db_session.commit()

    before = datetime.datetime.now(datetime.timezone.utc)
    invitation = await repo.create_invitation(
        db_session,
        household_id=household.id,
        invited_by_user_id=user_id,
        invited_email="invitee@example.com",
        invited_role="admin",
        token_hash="admin-invite-token",
    )
    await db_session.commit()
    after = datetime.datetime.now(datetime.timezone.utc)

    assert invitation.invited_email == "invitee@example.com"
    assert invitation.invited_role == "admin"
    assert invitation.status == "pending"
    lower = before + datetime.timedelta(hours=72) - datetime.timedelta(seconds=5)
    upper = after + datetime.timedelta(hours=72) + datetime.timedelta(seconds=5)
    assert lower <= invitation.expires_at <= upper


@pytest.mark.anyio
async def test_create_invitation_rejects_duplicate_pending_email(
    db_session: AsyncSession,
) -> None:
    from fastapi import HTTPException

    user_id = await _make_user(db_session, "dup_invite_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="DupInviteHH", created_by=user_id)
    await db_session.commit()

    await repo.create_invitation(
        db_session,
        household_id=household.id,
        invited_by_user_id=user_id,
        invited_email="invitee@example.com",
        invited_role="member",
        token_hash="duplicate-pending-token-1",
    )
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await repo.create_invitation(
            db_session,
            household_id=household.id,
            invited_by_user_id=user_id,
            invited_email="INVITEE@example.com",
            invited_role="member",
            token_hash="duplicate-pending-token-2",
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "An invitation to this address is already pending."


@pytest.mark.anyio
async def test_create_invitation_rejects_existing_member_email(db_session: AsyncSession) -> None:
    from fastapi import HTTPException

    admin_id = await _make_user(db_session, "member_invite_admin")
    existing_member_id = await _make_user(db_session, "member_invite_target")
    repo = HouseholdRepo()
    household = await repo.create_household(
        db_session, name="ExistingMemberHH", created_by=admin_id
    )
    await repo.add_member(
        db_session,
        household_id=household.id,
        user_id=existing_member_id,
        role="member",
        invited_by=admin_id,
    )
    await db_session.commit()

    await db_session.execute(
        sa.text("UPDATE users SET email = :email WHERE id = :user_id"),
        {"email": "member@example.com", "user_id": existing_member_id},
    )
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await repo.create_invitation(
            db_session,
            household_id=household.id,
            invited_by_user_id=admin_id,
            invited_email="MEMBER@example.com",
            invited_role="member",
            token_hash="existing-member-token",
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "User is already a member of this household."


@pytest.mark.anyio
async def test_create_invitation_rejects_when_household_has_ten_members(
    db_session: AsyncSession,
) -> None:
    from fastapi import HTTPException

    admin_id = await _make_user(db_session, "member_cap_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="MemberCapHH", created_by=admin_id)

    for index in range(9):
        user_id = await _make_user(db_session, f"member_cap_{index}")
        await repo.add_member(
            db_session,
            household_id=household.id,
            user_id=user_id,
            role="member",
            invited_by=admin_id,
        )

    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await repo.create_invitation(
            db_session,
            household_id=household.id,
            invited_by_user_id=admin_id,
            invited_email="invitee@example.com",
            invited_role="member",
            token_hash="member-cap-token",
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Household has reached the maximum of 10 members."


@pytest.mark.anyio
async def test_create_invitation_enforces_per_admin_24_hour_rate_limit(
    db_session: AsyncSession,
) -> None:
    from fastapi import HTTPException

    admin_id = await _make_user(db_session, "rate_limit_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="RateLimitHH", created_by=admin_id)
    await db_session.commit()

    for index in range(10):
        await repo.create_invitation(
            db_session,
            household_id=household.id,
            invited_by_user_id=admin_id,
            invited_email=f"invitee{index}@example.com",
            invited_role="member",
            token_hash=f"rate-limit-token-{index}",
        )
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await repo.create_invitation(
            db_session,
            household_id=household.id,
            invited_by_user_id=admin_id,
            invited_email="invitee10@example.com",
            invited_role="member",
            token_hash="rate-limit-token-10",
        )

    assert exc_info.value.status_code == 429
    assert exc_info.value.detail == "Invitation rate limit exceeded for this household."


@pytest.mark.anyio
async def test_add_member_persists_invitation_timestamps(db_session: AsyncSession) -> None:
    admin_id = await _make_user(db_session, "timestamp_admin")
    member_id = await _make_user(db_session, "timestamp_member")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="TimestampHH", created_by=admin_id)
    invited_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=1)
    accepted_at = datetime.datetime.now(datetime.timezone.utc)

    await repo.add_member(
        db_session,
        household_id=household.id,
        user_id=member_id,
        role="member",
        invited_by=admin_id,
        invited_at=invited_at,
        accepted_at=accepted_at,
    )
    await db_session.commit()

    member = await repo.get_member(db_session, household.id, member_id)
    assert member is not None
    assert member.invited_at == invited_at
    assert member.accepted_at == accepted_at


@pytest.mark.anyio
async def test_revoke_previous_guest_tokens(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session, "gt_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="GTHHH", created_by=user_id)
    await db_session.commit()

    await repo.create_guest_token(
        db_session,
        household_id=household.id,
        created_by=user_id,
        token_hash="gt_hash_01",
    )
    await repo.create_guest_token(
        db_session,
        household_id=household.id,
        created_by=user_id,
        token_hash="gt_hash_02",
    )
    await db_session.commit()

    await repo.revoke_previous_guest_tokens(db_session, household.id)
    await db_session.commit()

    result1 = await repo.get_guest_token_by_hash(db_session, "gt_hash_01")
    result2 = await repo.get_guest_token_by_hash(db_session, "gt_hash_02")
    assert result1 is None
    assert result2 is None


@pytest.mark.anyio
async def test_decline_and_resend_invitation_update_status(db_session: AsyncSession) -> None:
    user_id = await _make_user(db_session, "decline_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="DeclineHH", created_by=user_id)
    await db_session.commit()

    invitation = await repo.create_invitation(
        db_session,
        household_id=household.id,
        invited_by_user_id=user_id,
        invited_email=None,
        invited_role="member",
        token_hash="decline-token-hash",
    )
    await db_session.commit()

    await repo.decline_invitation(db_session, invitation.id)
    await db_session.commit()
    declined = await repo.get_invitation_by_token_hash(db_session, "decline-token-hash")
    assert declined is not None
    assert declined.status == "declined"

    resent = await repo.resend_invitation(db_session, invitation.id)
    await db_session.commit()
    assert resent.status == "pending"

    await repo.revoke_invitation(db_session, invitation.id)
    await db_session.commit()
    revoked = await repo.get_invitation_by_token_hash(db_session, "decline-token-hash")
    assert revoked is not None
    assert revoked.status == "revoked"
    assert revoked.revoked_at is not None


@pytest.mark.anyio
async def test_resend_invitation_rejects_accepted_tokens(db_session: AsyncSession) -> None:
    from fastapi import HTTPException

    user_id = await _make_user(db_session, "accepted_admin")
    repo = HouseholdRepo()
    household = await repo.create_household(db_session, name="AcceptedHH", created_by=user_id)
    await db_session.commit()

    invitation = await repo.create_invitation(
        db_session,
        household_id=household.id,
        invited_by_user_id=user_id,
        invited_email=None,
        invited_role="member",
        token_hash="accepted-token-hash",
    )
    await db_session.commit()

    await repo.accept_invitation(db_session, invitation.id)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await repo.resend_invitation(db_session, invitation.id)

    assert exc_info.value.status_code == 409


@pytest.mark.anyio
async def test_seed_default_household_assigns_orphan_rows(
    db_session: AsyncSession,
) -> None:
    """seed_default_household returns a Household with admin membership."""
    user_id = await _make_user(db_session, "seed_user")
    repo = HouseholdRepo()

    household = await repo.seed_default_household(db_session, user_id)
    await db_session.commit()

    assert household.name == "Home"
    member = await repo.get_member(db_session, household.id, user_id)
    assert member is not None
    assert member.role == "admin"

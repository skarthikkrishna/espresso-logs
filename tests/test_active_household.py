"""Tests for server-side active household persistence."""

from __future__ import annotations

import datetime
import uuid
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.deps import current_household_membership
from app.main import app
from app.models.base import get_db
from app.models.household import HouseholdMember
from app.models.user import User
from app.routers.api_households import current_user, invite_accepting_user
from app.routers.api_auth import current_user as auth_current_user


UTC = datetime.timezone.utc


def _make_user(
    *,
    user_id: uuid.UUID | None = None,
    username: str = "alice",
    active_household_id: uuid.UUID | None = None,
) -> User:
    return User(
        id=user_id or uuid.uuid4(),
        username=username,
        display_name=username.title(),
        email=f"{username}@example.com",
        picture_url=None,
        active_household_id=active_household_id,
    )


def _make_membership(
    *,
    user_id: uuid.UUID,
    household_id: uuid.UUID,
    role: str = "member",
    joined_at: datetime.datetime | None = None,
) -> HouseholdMember:
    timestamp = joined_at or datetime.datetime.now(UTC)
    return HouseholdMember(
        id=uuid.uuid4(),
        user_id=user_id,
        household_id=household_id,
        role=role,
        invited_by=None,
        invited_at=timestamp,
        accepted_at=timestamp,
        joined_at=timestamp,
    )


class _MembershipWithName:
    def __init__(self, membership: HouseholdMember, household_name: str) -> None:
        self.membership = membership
        self.household_name = household_name


@pytest.fixture()
def db_override() -> AsyncMock:
    db = AsyncMock()

    async def _override() -> Any:
        yield db

    app.dependency_overrides[get_db] = _override
    yield db
    app.dependency_overrides.pop(get_db, None)


async def test_active_household_persists_after_switch(db_override: AsyncMock) -> None:
    household_a = uuid.uuid4()
    household_b = uuid.uuid4()
    user = _make_user(active_household_id=household_a)
    membership_b = _make_membership(user_id=user.id, household_id=household_b)

    app.dependency_overrides[auth_current_user] = lambda: user
    try:
        with (
            patch("app.routers.api_auth.HouseholdRepo") as AuthHouseholdRepo,
            patch("app.routers.api_auth.UserRepo") as AuthUserRepo,
            patch("app.deps.HouseholdRepo") as DepsHouseholdRepo,
            patch("app.deps.UserRepo") as DepsUserRepo,
        ):
            AuthHouseholdRepo.return_value.get_member = AsyncMock(return_value=membership_b)
            AuthHouseholdRepo.return_value.get_by_id = AsyncMock(
                return_value=type("Household", (), {"id": household_b, "name": "B"})()
            )
            AuthUserRepo.return_value.set_active_household = AsyncMock()
            DepsHouseholdRepo.return_value.get_member = AsyncMock(return_value=membership_b)
            DepsHouseholdRepo.return_value.get_by_id = AsyncMock(
                return_value=type("Household", (), {"id": household_b, "name": "B"})()
            )
            DepsUserRepo.return_value.clear_active_household = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/auth/switch-household",
                    json={"household_id": str(household_b)},
                )

            assert response.status_code == 200, response.text
            membership = await current_household_membership(user=user, db=db_override)

    finally:
        app.dependency_overrides.pop(auth_current_user, None)

    assert user.active_household_id == household_b
    assert membership.household_id == household_b
    AuthUserRepo.return_value.set_active_household.assert_awaited_once_with(
        db_override, user.id, household_b
    )


async def test_active_household_restored_after_new_session(db_override: AsyncMock) -> None:
    household_a = uuid.uuid4()
    household_b = uuid.uuid4()
    user_id = uuid.uuid4()
    persisted_state = {"active_household_id": household_a}
    membership_a = _make_membership(
        user_id=user_id,
        household_id=household_a,
        role="admin",
        joined_at=datetime.datetime(2024, 1, 1, tzinfo=UTC),
    )
    membership_b = _make_membership(
        user_id=user_id,
        household_id=household_b,
        role="member",
        joined_at=datetime.datetime(2024, 1, 2, tzinfo=UTC),
    )
    household_b_record = type("Household", (), {"id": household_b, "name": "Household B"})()

    def _current_user() -> User:
        return _make_user(
            user_id=user_id,
            active_household_id=persisted_state["active_household_id"],
        )

    app.dependency_overrides[auth_current_user] = _current_user
    try:
        with (
            patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo,
            patch("app.routers.api_auth.UserRepo") as MockUserRepo,
        ):
            MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=membership_b)
            MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household_b_record)
            MockHouseholdRepo.return_value.get_memberships_with_households_for_user = AsyncMock(
                return_value=[
                    _MembershipWithName(membership_a, "Household A"),
                    _MembershipWithName(membership_b, "Household B"),
                ]
            )

            async def _set_active_household(
                db: AsyncMock, user_id_arg: uuid.UUID, household_id_arg: uuid.UUID
            ) -> None:
                assert db is db_override
                assert user_id_arg == user_id
                persisted_state["active_household_id"] = household_id_arg

            MockUserRepo.return_value.set_active_household = AsyncMock(
                side_effect=_set_active_household
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                switch_response = await client.post(
                    "/auth/switch-household",
                    json={"household_id": str(household_b)},
                )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as fresh_client:
                response = await fresh_client.get("/auth/me")

    finally:
        app.dependency_overrides.pop(auth_current_user, None)

    assert switch_response.status_code == 200, switch_response.text
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["household_id"] == str(household_b)
    assert body["active_household_id"] == str(household_b)
    assert body["role"] == "member"


async def test_active_household_set_on_invite_accept(db_override: AsyncMock) -> None:
    household_id = uuid.uuid4()
    user = _make_user(active_household_id=None)
    invitation = type(
        "Invitation",
        (),
        {
            "id": uuid.uuid4(),
            "household_id": household_id,
            "invited_email": user.email,
            "invited_by_user_id": uuid.uuid4(),
            "invited_role": "member",
            "invited_at": datetime.datetime.now(UTC),
            "expires_at": datetime.datetime.now(UTC) + datetime.timedelta(days=1),
            "accepted_at": None,
            "status": "pending",
        },
    )()
    household = type("Household", (), {"id": household_id, "name": "B"})()
    raw_token = "invite-token"

    app.dependency_overrides[invite_accepting_user] = lambda: user
    try:
        with (
            patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo,
            patch("app.routers.api_households.UserRepo") as MockUserRepo,
        ):
            MockHouseholdRepo.return_value.get_invitation_by_token_hash = AsyncMock(
                return_value=invitation
            )
            MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=None)
            MockHouseholdRepo.return_value.count_for_user = AsyncMock(return_value=0)
            MockHouseholdRepo.return_value.add_member = AsyncMock()
            MockHouseholdRepo.return_value.accept_invitation = AsyncMock()
            MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household)
            MockUserRepo.return_value.set_active_household = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(f"/households/invitations/{raw_token}/accept")

    finally:
        app.dependency_overrides.pop(invite_accepting_user, None)

    assert response.status_code == 200, response.text
    MockUserRepo.return_value.set_active_household.assert_awaited_once_with(
        db_override, user.id, household_id
    )


async def test_active_household_set_on_household_create(db_override: AsyncMock) -> None:
    user = _make_user(active_household_id=None)
    household = type(
        "Household",
        (),
        {
            "id": uuid.uuid4(),
            "name": "Created",
            "created_at": datetime.datetime.now(UTC),
        },
    )()

    app.dependency_overrides[current_user] = lambda: user
    try:
        with (
            patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo,
            patch("app.routers.api_households.UserRepo") as MockUserRepo,
        ):
            MockHouseholdRepo.return_value.create_household = AsyncMock(return_value=household)
            MockUserRepo.return_value.set_active_household = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post("/households", json={"name": "Created"})

    finally:
        app.dependency_overrides.pop(current_user, None)

    assert response.status_code == 201, response.text
    MockUserRepo.return_value.set_active_household.assert_awaited_once_with(
        db_override, user.id, household.id
    )


async def test_active_household_not_overwritten_on_second_join(db_override: AsyncMock) -> None:
    household_a = uuid.uuid4()
    household_b = uuid.uuid4()
    user = _make_user(active_household_id=household_a)
    invitation = type(
        "Invitation",
        (),
        {
            "id": uuid.uuid4(),
            "household_id": household_b,
            "invited_email": user.email,
            "invited_by_user_id": uuid.uuid4(),
            "invited_role": "member",
            "invited_at": datetime.datetime.now(UTC),
            "expires_at": datetime.datetime.now(UTC) + datetime.timedelta(days=1),
            "accepted_at": None,
            "status": "pending",
        },
    )()
    household = type("Household", (), {"id": household_b, "name": "B"})()

    app.dependency_overrides[invite_accepting_user] = lambda: user
    try:
        with (
            patch("app.routers.api_households.HouseholdRepo") as MockHouseholdRepo,
            patch("app.routers.api_households.UserRepo") as MockUserRepo,
        ):
            MockHouseholdRepo.return_value.get_invitation_by_token_hash = AsyncMock(
                return_value=invitation
            )
            MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=None)
            MockHouseholdRepo.return_value.count_for_user = AsyncMock(return_value=1)
            MockHouseholdRepo.return_value.add_member = AsyncMock()
            MockHouseholdRepo.return_value.accept_invitation = AsyncMock()
            MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household)
            MockUserRepo.return_value.set_active_household = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post("/households/invitations/another-token/accept")

    finally:
        app.dependency_overrides.pop(invite_accepting_user, None)

    assert response.status_code == 200, response.text
    assert user.active_household_id == household_a
    MockUserRepo.return_value.set_active_household.assert_not_called()


async def test_switch_to_non_member_household_rejected(db_override: AsyncMock) -> None:
    user = _make_user()
    requested_household = uuid.uuid4()

    app.dependency_overrides[auth_current_user] = lambda: user
    try:
        with patch("app.routers.api_auth.HouseholdRepo") as MockHouseholdRepo:
            MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=None)
            MockHouseholdRepo.return_value.get_by_id = AsyncMock(
                return_value=type("Household", (), {"id": requested_household, "name": "B"})()
            )

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.post(
                    "/auth/switch-household",
                    json={"household_id": str(requested_household)},
                )

    finally:
        app.dependency_overrides.pop(auth_current_user, None)

    assert response.status_code == 403


async def test_active_household_fallback_when_null(db_override: AsyncMock) -> None:
    user = _make_user(active_household_id=None)
    household_a = uuid.uuid4()
    household_b = uuid.uuid4()
    membership_a = _make_membership(
        user_id=user.id,
        household_id=household_a,
        joined_at=datetime.datetime(2024, 1, 1, tzinfo=UTC),
    )
    membership_b = _make_membership(
        user_id=user.id,
        household_id=household_b,
        joined_at=datetime.datetime(2024, 1, 2, tzinfo=UTC),
    )

    with (
        patch("app.deps.HouseholdRepo") as MockHouseholdRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(
            return_value=[membership_a, membership_b]
        )
        MockUserRepo.return_value.clear_active_household = AsyncMock()
        membership = await current_household_membership(user=user, db=db_override)

    assert membership.household_id == household_a
    MockUserRepo.return_value.clear_active_household.assert_not_called()


async def test_active_household_cleared_when_removed_from_household(db_override: AsyncMock) -> None:
    active_household = uuid.uuid4()
    fallback_household = uuid.uuid4()
    user = _make_user(active_household_id=active_household)
    fallback_membership = _make_membership(user_id=user.id, household_id=fallback_household)

    with (
        patch("app.deps.HouseholdRepo") as MockHouseholdRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=None)
        MockHouseholdRepo.return_value.get_by_id = AsyncMock(
            return_value=type("Household", (), {"id": active_household})()
        )
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(
            return_value=[fallback_membership]
        )
        MockUserRepo.return_value.clear_active_household = AsyncMock()

        membership = await current_household_membership(user=user, db=db_override)

    assert membership.household_id == fallback_household
    assert user.active_household_id is None
    MockUserRepo.return_value.clear_active_household.assert_awaited_once_with(db_override, user.id)


async def test_soft_deleted_active_household_triggers_fallback(db_override: AsyncMock) -> None:
    deleted_household = uuid.uuid4()
    fallback_household = uuid.uuid4()
    user = _make_user(active_household_id=deleted_household)
    active_membership = _make_membership(user_id=user.id, household_id=deleted_household)
    fallback_membership = _make_membership(user_id=user.id, household_id=fallback_household)

    with (
        patch("app.deps.HouseholdRepo") as MockHouseholdRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=active_membership)
        MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=None)
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(
            return_value=[fallback_membership]
        )
        MockUserRepo.return_value.clear_active_household = AsyncMock()

        membership = await current_household_membership(user=user, db=db_override)

    assert membership.household_id == fallback_household
    assert user.active_household_id is None
    MockUserRepo.return_value.clear_active_household.assert_awaited_once_with(db_override, user.id)


async def test_soft_deleted_last_active_household_clears_active_household(
    db_override: AsyncMock,
) -> None:
    deleted_household = uuid.uuid4()
    user = _make_user(active_household_id=deleted_household)
    active_membership = _make_membership(user_id=user.id, household_id=deleted_household)

    with (
        patch("app.deps.HouseholdRepo") as MockHouseholdRepo,
        patch("app.deps.UserRepo") as MockUserRepo,
    ):
        MockHouseholdRepo.return_value.get_member = AsyncMock(return_value=active_membership)
        MockHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=None)
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        MockUserRepo.return_value.clear_active_household = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await current_household_membership(user=user, db=db_override)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "User has no household memberships"
    assert user.active_household_id is None
    MockUserRepo.return_value.clear_active_household.assert_awaited_once_with(db_override, user.id)


async def test_no_household_id_header_consulted(db_override: AsyncMock) -> None:
    household_a = uuid.uuid4()
    household_b = uuid.uuid4()
    user = _make_user(active_household_id=household_a)
    membership_a = _make_membership(user_id=user.id, household_id=household_a)
    household = type(
        "Household",
        (),
        {
            "id": household_a,
            "name": "A",
            "created_at": datetime.datetime.now(UTC),
            "created_by": uuid.uuid4(),
            "is_guest_accessible": False,
        },
    )()

    saved_override = app.dependency_overrides.pop(current_household_membership, None)
    app.dependency_overrides[current_user] = lambda: user
    try:
        with (
            patch("app.deps.HouseholdRepo") as DepsHouseholdRepo,
            patch("app.deps.UserRepo") as DepsUserRepo,
            patch("app.routers.api_households.HouseholdRepo") as RouteHouseholdRepo,
            patch("app.routers.api_households.UserRepo") as RouteUserRepo,
        ):
            DepsHouseholdRepo.return_value.get_member = AsyncMock(return_value=membership_a)
            DepsHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household)
            DepsUserRepo.return_value.clear_active_household = AsyncMock()
            RouteHouseholdRepo.return_value.get_by_id = AsyncMock(return_value=household)
            RouteHouseholdRepo.return_value.get_members = AsyncMock(return_value=[])
            RouteUserRepo.return_value.get_by_id = AsyncMock()

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get(
                    f"/households/{household_a}",
                    headers={"X-Household-Id": str(household_b)},
                )

    finally:
        app.dependency_overrides.pop(current_user, None)
        if saved_override is not None:
            app.dependency_overrides[current_household_membership] = saved_override

    assert response.status_code == 200, response.text
    assert response.json()["id"] == str(household_a)
    DepsHouseholdRepo.return_value.get_member.assert_awaited_once_with(
        db_override, household_a, user.id
    )


async def test_zero_memberships_returns_403(db_override: AsyncMock) -> None:
    user = _make_user(active_household_id=None)

    with patch("app.deps.HouseholdRepo") as MockHouseholdRepo:
        MockHouseholdRepo.return_value.get_memberships_for_user = AsyncMock(return_value=[])
        with pytest.raises(HTTPException) as exc_info:
            await current_household_membership(user=user, db=db_override)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "User has no household memberships"

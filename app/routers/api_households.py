"""Household management endpoints — create, list, invite, accept, manage members.

All endpoints require JWT authentication via the current_user or
current_household_membership dependency.  Admin-only operations use require_admin.
"""

from __future__ import annotations

import base64
import datetime
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import current_household_membership, current_user, require_admin
from app.models.base import get_db
from app.models.household import HouseholdMember
from app.models.user import User
from app.repos.sql.household import HouseholdRepo
from app.repos.sql.user import UserRepo
from app.services.auth import hash_token

router = APIRouter(tags=["households"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class HouseholdOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime.datetime
    role: str


class MembershipOut(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    joined_at: datetime.datetime


class MemberOut(BaseModel):
    user_id: uuid.UUID
    username: str | None
    display_name: str
    role: str
    joined_at: datetime.datetime


class HouseholdDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime.datetime
    is_guest_accessible: bool
    members: list[MemberOut]


class InviteOut(BaseModel):
    invitation_id: uuid.UUID
    token: str
    expires_at: datetime.datetime


class AcceptInviteOut(BaseModel):
    household_id: uuid.UUID
    household_name: str
    role: str


class UpdatedMemberOut(BaseModel):
    user_id: uuid.UUID
    role: str
    joined_at: datetime.datetime


class GuestTokenOut(BaseModel):
    guest_url: str


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class CreateHouseholdRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 64):
            raise ValueError("Household name must be 1–64 characters")
        return v


class AcceptInviteRequest(BaseModel):
    token: str


class UpdateRoleRequest(BaseModel):
    role: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=HouseholdOut, status_code=201)
async def create_household(
    body: CreateHouseholdRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdOut:
    """Create a new household; caller becomes the admin (AC-070)."""
    household = await HouseholdRepo().create_household(db, name=body.name, created_by=user.id)
    await db.commit()
    await db.refresh(household)
    return HouseholdOut(
        id=household.id, name=household.name, created_at=household.created_at, role="admin"
    )


@router.get("/me", response_model=list[MembershipOut])
async def list_my_households(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MembershipOut]:
    """List all households the caller is a member of (AC-071)."""
    memberships = await HouseholdRepo().get_memberships_for_user(db, user.id)
    result: list[MembershipOut] = []
    for m in memberships:
        hh = await HouseholdRepo().get_by_id(db, m.household_id)
        if hh is not None:
            result.append(MembershipOut(id=hh.id, name=hh.name, role=m.role, joined_at=m.joined_at))
    return result


@router.get("/{household_id}", response_model=HouseholdDetailOut)
async def get_household(
    household_id: uuid.UUID,
    membership: HouseholdMember = Depends(current_household_membership),
    db: AsyncSession = Depends(get_db),
) -> HouseholdDetailOut:
    """Return household details including all members (AC-072)."""
    hh = await HouseholdRepo().get_by_id(db, household_id)
    if hh is None:
        raise HTTPException(status_code=404, detail="Household not found")
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not a member of this household")
    raw_members = await HouseholdRepo().get_members(db, household_id)
    members: list[MemberOut] = []
    for m in raw_members:
        u = await UserRepo().get_by_id(db, m.user_id)
        members.append(
            MemberOut(
                user_id=m.user_id,
                username=u.username if u else None,
                display_name=u.display_name if u else str(m.user_id),
                role=m.role,
                joined_at=m.joined_at,
            )
        )
    return HouseholdDetailOut(
        id=hh.id,
        name=hh.name,
        created_at=hh.created_at,
        is_guest_accessible=hh.is_guest_accessible,
        members=members,
    )


@router.post("/{household_id}/invite", response_model=InviteOut, status_code=201)
async def create_invite(
    household_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> InviteOut:
    """Generate a one-time invitation token for a household (AC-073)."""
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    raw_token = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
    invitation = await HouseholdRepo().create_invitation(
        db,
        household_id=household_id,
        invited_by_user_id=membership.user_id,
        token_hash=hash_token(raw_token),
    )
    await db.commit()
    await db.refresh(invitation)
    return InviteOut(
        invitation_id=invitation.id,
        token=raw_token,
        expires_at=invitation.expires_at,
    )


@router.post("/accept-invite", response_model=AcceptInviteOut)
async def accept_invite(
    body: AcceptInviteRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> AcceptInviteOut:
    """Accept a household invitation (AC-074)."""
    invitation = await HouseholdRepo().get_invitation_by_token_hash(db, hash_token(body.token))
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")

    now = datetime.datetime.now(datetime.timezone.utc)
    if invitation.expires_at < now:
        raise HTTPException(status_code=410, detail="Invitation expired")
    if invitation.accepted_at is not None:
        raise HTTPException(status_code=410, detail="Invitation already accepted")
    if invitation.revoked_at is not None:
        raise HTTPException(status_code=410, detail="Invitation revoked")

    existing = await HouseholdRepo().get_member(db, invitation.household_id, user.id)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Already a member of this household")

    await HouseholdRepo().add_member(
        db,
        household_id=invitation.household_id,
        user_id=user.id,
        role="member",
        invited_by=invitation.invited_by_user_id,
    )
    await HouseholdRepo().accept_invitation(db, invitation.id)
    await db.commit()

    hh = await HouseholdRepo().get_by_id(db, invitation.household_id)
    household_name = hh.name if hh else str(invitation.household_id)
    return AcceptInviteOut(
        household_id=invitation.household_id,
        household_name=household_name,
        role="member",
    )


@router.delete("/{household_id}/members/{user_id}", status_code=204)
async def remove_member(
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove a member from the household (AC-075)."""
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    if membership.user_id == user_id:
        raise HTTPException(status_code=403, detail="Cannot remove yourself")
    await HouseholdRepo().remove_member(db, household_id=household_id, user_id=user_id)
    await db.commit()


@router.patch("/{household_id}/members/{user_id}", response_model=UpdatedMemberOut)
async def update_member_role(
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    body: UpdateRoleRequest,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UpdatedMemberOut:
    """Update a member's role (AC-076)."""
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=422, detail="role must be 'admin' or 'member'")
    updated = await HouseholdRepo().update_member_role(
        db, household_id=household_id, user_id=user_id, new_role=body.role
    )
    await db.commit()
    return UpdatedMemberOut(user_id=updated.user_id, role=updated.role, joined_at=updated.joined_at)


@router.get("/{household_id}/guest-token", response_model=GuestTokenOut)
async def get_guest_token(
    request: Request,
    household_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> GuestTokenOut:
    """Revoke previous guest tokens and generate a new one (AC-077)."""
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    await HouseholdRepo().revoke_previous_guest_tokens(db, household_id)
    raw_token = str(uuid.uuid4())
    await HouseholdRepo().create_guest_token(
        db,
        household_id=household_id,
        created_by=membership.user_id,
        token_hash=hash_token(raw_token),
    )
    await db.commit()
    base_url = str(request.base_url).rstrip("/")
    return GuestTokenOut(guest_url=f"{base_url}?guest={raw_token}")

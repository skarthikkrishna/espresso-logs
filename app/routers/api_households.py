"""Household management endpoints."""

from __future__ import annotations

import datetime
import inspect
import secrets
import uuid
from typing import Literal

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.link_tokens import decrypt_display_token, encrypt_display_token
from app.deps import current_household_membership, current_user, require_admin
from app.models.base import get_db
from app.models.household import HouseholdMember, PendingInvitation
from app.models.user import User
from app.repos.sql.household import HouseholdMembershipWithName, HouseholdRepo
from app.repos.sql.user import UserRepo
from app.services.auth import decode_access_token, hash_token

router = APIRouter(tags=["households"])
_optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
_MEMBER_LIMIT = 10


async def _await_if_needed(value: object) -> object:
    if inspect.isawaitable(value):
        return await value
    return value


async def invite_accepting_user(
    token: str | None = Depends(_optional_oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Return the authenticated invitee when a Bearer token is present."""
    if token is None:
        return None
    user_id = decode_access_token(token)
    user = await UserRepo().get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


class HouseholdOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime.datetime
    role: str


class MembershipOut(BaseModel):
    household_id: uuid.UUID
    household_name: str
    role: str
    joined_at: datetime.datetime
    member_count: int
    is_active: bool
    can_manage: bool
    id: uuid.UUID
    name: str


class MemberOut(BaseModel):
    user_id: uuid.UUID
    username: str | None
    display_name: str
    email: str | None = None
    picture_url: str | None = None
    role: str
    joined_at: datetime.datetime
    is_self: bool


class MemberLimitOut(BaseModel):
    current: int
    max: int
    can_invite: bool


class PendingInvitationOut(BaseModel):
    invitation_id: uuid.UUID
    label: str
    invited_email: str | None
    invited_role: Literal["admin", "member"]
    status: str
    invited_at: datetime.datetime
    expires_at: datetime.datetime
    invite_url: str | None = None
    can_copy: bool
    can_revoke: bool
    can_resend: bool


class GuestAccessOut(BaseModel):
    is_active: bool
    guest_url: str | None = None
    created_at: datetime.datetime | None = None
    revoked_at: datetime.datetime | None = None
    can_copy: bool = False


class PermissionsOut(BaseModel):
    can_rename: bool
    can_delete: bool
    can_manage_members: bool
    can_manage_invites: bool
    can_manage_guest_access: bool


class HouseholdDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime.datetime
    role: str
    member_count: int
    members: list[MemberOut]
    is_guest_accessible: bool | None = None
    member_limit: MemberLimitOut | None = None
    pending_invitations: list[PendingInvitationOut] | None = None
    guest_access: GuestAccessOut | None = None
    permissions: PermissionsOut | None = None


class DeliveryOut(BaseModel):
    email_configured: bool = False
    email_attempted: bool = False
    email_sent: bool = False


class InviteOut(BaseModel):
    invitation_id: uuid.UUID
    invite_url: str
    expires_at: datetime.datetime
    invited_email: str | None
    invited_role: Literal["admin", "member"]
    status: Literal["pending", "accepted", "revoked"]
    delivery: DeliveryOut


class InvitationPreviewOut(BaseModel):
    household_name: str
    inviter_display_name: str
    invited_role: Literal["admin", "member"]
    expires_at: datetime.datetime
    status: Literal["pending"]


class AcceptInviteOut(BaseModel):
    household_id: uuid.UUID
    household_name: str
    role: str
    active_household_id: uuid.UUID


class UpdatedMemberOut(BaseModel):
    user_id: uuid.UUID
    role: str
    joined_at: datetime.datetime


class GuestTokenOut(BaseModel):
    guest_url: str
    created_at: datetime.datetime
    is_active: bool


class CreateHouseholdRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 64):
            raise ValueError("Household name must be 1–64 characters")
        return v


class CreateInvitationRequest(BaseModel):
    invited_email: str | None = None
    invited_role: Literal["admin", "member"] = "member"

    @field_validator("invited_email")
    @classmethod
    def _normalise_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        return value or None


class RenameHouseholdRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        value = value.strip()
        if not (1 <= len(value) <= 64):
            raise ValueError("Household name must be 1–64 characters")
        return value


class DeleteHouseholdRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm_name: str


class UpdateRoleRequest(BaseModel):
    role: Literal["admin", "member"]


def _raw_link_token() -> str:
    return secrets.token_urlsafe(32)


def _app_base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _invite_url(request: Request, raw_token: str) -> str:
    return f"{_app_base_url(request)}/invite/accept?token={raw_token}"


def _guest_url(request: Request, household_id: uuid.UUID, raw_token: str) -> str:
    return f"{_app_base_url(request)}/households/{household_id}/view?key={raw_token}"


def _status_is_accept_available(invitation: PendingInvitation) -> bool:
    return invitation.status in {"pending", "declined"}


def _raise_for_unavailable_invitation(invitation: PendingInvitation) -> None:
    if invitation.status == "accepted":
        raise HTTPException(status_code=409, detail="Invitation has already been accepted")
    if invitation.status == "revoked":
        raise HTTPException(status_code=410, detail="Invitation is no longer pending")


def _ensure_invitation_not_expired(invitation: PendingInvitation) -> None:
    if invitation.expires_at < datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=410, detail="Invitation expired")


def _display_invite_url(request: Request, invitation: PendingInvitation) -> str | None:
    raw = decrypt_display_token(invitation.display_token_ciphertext)
    return _invite_url(request, raw) if raw else None


def _display_guest_url(
    request: Request, household_id: uuid.UUID, ciphertext: str | None
) -> str | None:
    raw = decrypt_display_token(ciphertext)
    return _guest_url(request, household_id, raw) if raw else None


async def _membership_outputs(
    db: AsyncSession,
    user: User,
) -> list[MembershipOut]:
    repo = HouseholdRepo()
    memberships_result = repo.get_memberships_with_households_for_user(db, user.id)
    if inspect.isawaitable(memberships_result):
        memberships: list[HouseholdMembershipWithName] = await memberships_result
    else:
        raw_memberships = await repo.get_memberships_for_user(db, user.id)
        memberships = []
        for membership in raw_memberships:
            household = await repo.get_by_id(db, membership.household_id)
            if household is None:
                continue
            count_result = repo.count_members(db, membership.household_id)
            member_count = await count_result if inspect.isawaitable(count_result) else 0
            memberships.append(
                HouseholdMembershipWithName(
                    membership=membership,
                    household_name=household.name,
                    member_count=int(member_count or 0),
                )
            )
    if not memberships and user.active_household_id is not None:
        await UserRepo().clear_active_household(db, user.id)
        user.active_household_id = None
    active_household_id = user.active_household_id
    if memberships and all(m.membership.household_id != active_household_id for m in memberships):
        active_household_id = memberships[0].membership.household_id
        await UserRepo().set_active_household(db, user.id, active_household_id)
        user.active_household_id = active_household_id

    result: list[MembershipOut] = []
    for membership_with_name in memberships:
        membership = membership_with_name.membership
        is_active = membership.household_id == active_household_id
        result.append(
            MembershipOut(
                household_id=membership.household_id,
                household_name=membership_with_name.household_name,
                role=membership.role,
                joined_at=membership.joined_at,
                member_count=getattr(membership_with_name, "member_count", 0),
                is_active=is_active,
                can_manage=membership.role == "admin",
                id=membership.household_id,
                name=membership_with_name.household_name,
            )
        )
    return result


@router.post("", response_model=HouseholdOut, status_code=201)
async def create_household(
    body: CreateHouseholdRequest,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdOut:
    household = await HouseholdRepo().create_household(db, name=body.name, created_by=user.id)
    await UserRepo().set_active_household(db, user.id, household.id)
    user.active_household_id = household.id
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
    return await _membership_outputs(db, user)


@router.post("/invitations", response_model=InviteOut, status_code=201)
async def create_invite(
    request: Request,
    body: CreateInvitationRequest,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> InviteOut:
    raw_token = _raw_link_token()
    invitation = await HouseholdRepo().create_invitation(
        db,
        household_id=membership.household_id,
        invited_by_user_id=membership.user_id,
        invited_email=body.invited_email,
        invited_role=body.invited_role,
        token_hash=hash_token(raw_token),
        display_token_ciphertext=encrypt_display_token(raw_token),
    )
    await db.commit()
    await db.refresh(invitation)
    return InviteOut(
        invitation_id=invitation.id,
        invite_url=_invite_url(request, raw_token),
        expires_at=invitation.expires_at,
        invited_email=invitation.invited_email,
        invited_role=invitation.invited_role,
        status="pending",
        delivery=DeliveryOut(),
    )


@router.get("/invitations/{token}", response_model=InvitationPreviewOut)
async def preview_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> InvitationPreviewOut:
    repo = HouseholdRepo()
    invitation = await repo.get_invitation_by_token_hash(db, hash_token(token))
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    _ensure_invitation_not_expired(invitation)
    if not _status_is_accept_available(invitation):
        _raise_for_unavailable_invitation(invitation)
    household = await repo.get_by_id(db, invitation.household_id)
    if household is None:
        raise HTTPException(status_code=410, detail="Household is no longer available")
    inviter = await UserRepo().get_by_id(db, invitation.invited_by_user_id)
    return InvitationPreviewOut(
        household_name=household.name,
        inviter_display_name=inviter.display_name if inviter else "Household admin",
        invited_role=invitation.invited_role,
        expires_at=invitation.expires_at,
        status="pending",
    )


@router.post("/invitations/{token}/accept", response_model=AcceptInviteOut)
async def accept_invite(
    token: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> AcceptInviteOut:
    repo = HouseholdRepo()
    invitation = await repo.get_invitation_by_token_hash(db, hash_token(token))
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    _ensure_invitation_not_expired(invitation)
    if not _status_is_accept_available(invitation):
        _raise_for_unavailable_invitation(invitation)

    household = await repo.get_by_id(db, invitation.household_id)
    if household is None:
        raise HTTPException(status_code=410, detail="Household is no longer available")

    if await repo.get_member(db, invitation.household_id, user.id) is not None:
        raise HTTPException(status_code=409, detail="Already a member of this household")
    if await repo.count_members(db, invitation.household_id) >= _MEMBER_LIMIT:
        raise HTTPException(
            status_code=409, detail="Household has reached the maximum of 10 members."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    await repo.add_member(
        db,
        household_id=invitation.household_id,
        user_id=user.id,
        role=invitation.invited_role,
        invited_by=invitation.invited_by_user_id,
        invited_at=invitation.invited_at,
        accepted_at=now,
    )
    await repo.accept_invitation(db, invitation.id)
    await db.execute(
        sa.update(User)
        .where(User.id == user.id)
        .values(active_household_id=invitation.household_id)
    )
    user.active_household_id = invitation.household_id
    await db.commit()

    return AcceptInviteOut(
        household_id=invitation.household_id,
        household_name=household.name,
        role=invitation.invited_role,
        active_household_id=invitation.household_id,
    )


@router.post("/invitations/{token}/decline", status_code=204)
async def decline_invitation(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    invitation = await HouseholdRepo().get_invitation_by_token_hash(db, hash_token(token))
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    _ensure_invitation_not_expired(invitation)
    if not _status_is_accept_available(invitation):
        _raise_for_unavailable_invitation(invitation)
    return Response(status_code=204)


@router.delete("/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    repo = HouseholdRepo()
    invitation = await repo.get_invitation_by_id(db, invitation_id)
    if invitation is None or invitation.household_id != membership.household_id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    await repo.revoke_invitation(db, invitation_id)
    await db.commit()
    return Response(status_code=204)


@router.post("/invitations/{invitation_id}/resend", response_model=InviteOut)
async def resend_invitation(
    request: Request,
    invitation_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> InviteOut:
    repo = HouseholdRepo()
    invitation = await repo.get_invitation_by_id(db, invitation_id)
    if invitation is None or invitation.household_id != membership.household_id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    raw_token = _raw_link_token()
    invitation = await repo.resend_invitation(
        db,
        invitation_id,
        token_hash=hash_token(raw_token),
        display_token_ciphertext=encrypt_display_token(raw_token),
    )
    await db.commit()
    return InviteOut(
        invitation_id=invitation.id,
        invite_url=_invite_url(request, raw_token),
        expires_at=invitation.expires_at,
        invited_email=invitation.invited_email,
        invited_role=invitation.invited_role,
        status="pending",
        delivery=DeliveryOut(),
    )


@router.delete("/members/{user_id}", status_code=204)
async def remove_member(
    user_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if membership.user_id == user_id:
        raise HTTPException(
            status_code=403, detail="You cannot remove yourself from the household."
        )
    repo = HouseholdRepo()
    await repo.remove_member(db, household_id=membership.household_id, user_id=user_id)
    await _await_if_needed(repo.repair_active_households_for_users(db, [user_id]))
    await db.commit()
    return Response(status_code=204)


@router.patch("/members/{user_id}", response_model=UpdatedMemberOut)
async def update_member_role(
    user_id: uuid.UUID,
    body: UpdateRoleRequest,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UpdatedMemberOut:
    if membership.user_id == user_id and body.role != "admin":
        raise HTTPException(status_code=409, detail="Every household needs at least one admin.")
    updated = await HouseholdRepo().update_member_role(
        db, household_id=membership.household_id, user_id=user_id, new_role=body.role
    )
    await db.commit()
    return UpdatedMemberOut(user_id=updated.user_id, role=updated.role, joined_at=updated.joined_at)


@router.post("/{household_id}/guest-token", response_model=GuestTokenOut, status_code=201)
async def generate_guest_token(
    request: Request,
    household_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> GuestTokenOut:
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    repo = HouseholdRepo()
    await repo.revoke_previous_guest_tokens(db, household_id)
    raw_token = _raw_link_token()
    guest_token = await repo.create_guest_token(
        db,
        household_id=household_id,
        created_by=membership.user_id,
        token_hash=hash_token(raw_token),
        display_token_ciphertext=encrypt_display_token(raw_token),
    )
    await db.commit()
    return GuestTokenOut(
        guest_url=_guest_url(request, household_id, raw_token),
        created_at=guest_token.created_at,
        is_active=True,
    )


@router.delete("/{household_id}/guest-token", status_code=204)
async def revoke_guest_token(
    household_id: uuid.UUID,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    await HouseholdRepo().revoke_guest_tokens(db, household_id)
    await db.commit()
    return Response(status_code=204)


@router.get("/{household_id}", response_model=HouseholdDetailOut, response_model_exclude_none=True)
async def get_household(
    request: Request,
    household_id: uuid.UUID,
    membership: HouseholdMember = Depends(current_household_membership),
    db: AsyncSession = Depends(get_db),
) -> HouseholdDetailOut:
    repo = HouseholdRepo()
    household = await repo.get_by_id(db, household_id)
    if household is None:
        raise HTTPException(status_code=404, detail="Household not found")
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not a member of this household")

    raw_members = await repo.get_members(db, household_id)
    count_result = repo.count_members(db, household_id)
    member_count = (
        int(await count_result) if inspect.isawaitable(count_result) else len(raw_members)
    )
    members: list[MemberOut] = []
    for member in raw_members:
        user = await UserRepo().get_by_id(db, member.user_id)
        members.append(
            MemberOut(
                user_id=member.user_id,
                username=user.username if user else None,
                display_name=user.display_name if user else "Household member",
                email=user.email if user else None,
                picture_url=user.picture_url if user else None,
                role=member.role,
                joined_at=member.joined_at,
                is_self=member.user_id == membership.user_id,
            )
        )

    detail = HouseholdDetailOut(
        id=household.id,
        name=household.name,
        created_at=household.created_at,
        role=membership.role,
        member_count=member_count,
        members=members,
    )
    if membership.role != "admin":
        return detail

    active_guest_result = repo.get_active_guest_token(db, household_id)
    active_guest = await active_guest_result if inspect.isawaitable(active_guest_result) else None
    guest_url = (
        _display_guest_url(request, household_id, active_guest.display_token_ciphertext)
        if active_guest
        else None
    )
    now = datetime.datetime.now(datetime.timezone.utc)
    pending_invitations: list[PendingInvitationOut] = []
    invitations_result = repo.get_invitations_for_household(db, household_id)
    invitations = await invitations_result if inspect.isawaitable(invitations_result) else []
    for invitation in invitations:
        if invitation.status in {"accepted", "revoked"}:
            continue
        display_status = "expired" if invitation.expires_at <= now else "pending"
        invite_url = (
            _display_invite_url(request, invitation) if display_status == "pending" else None
        )
        label = invitation.invited_email or "Link-only invitation"
        pending_invitations.append(
            PendingInvitationOut(
                invitation_id=invitation.id,
                label=label,
                invited_email=invitation.invited_email,
                invited_role=invitation.invited_role,
                status=display_status,
                invited_at=invitation.invited_at,
                expires_at=invitation.expires_at,
                invite_url=invite_url,
                can_copy=invite_url is not None,
                can_revoke=display_status == "pending",
                can_resend=True,
            )
        )

    return detail.model_copy(
        update={
            "is_guest_accessible": active_guest is not None,
            "member_limit": MemberLimitOut(
                current=member_count,
                max=_MEMBER_LIMIT,
                can_invite=member_count < _MEMBER_LIMIT,
            ),
            "pending_invitations": pending_invitations,
            "guest_access": GuestAccessOut(
                is_active=active_guest is not None,
                guest_url=guest_url,
                created_at=active_guest.created_at if active_guest else None,
                revoked_at=active_guest.revoked_at if active_guest else None,
                can_copy=guest_url is not None,
            ),
            "permissions": PermissionsOut(
                can_rename=True,
                can_delete=True,
                can_manage_members=True,
                can_manage_invites=True,
                can_manage_guest_access=True,
            ),
        }
    )


@router.patch("/{household_id}", response_model=HouseholdOut)
async def rename_household(
    household_id: uuid.UUID,
    body: RenameHouseholdRequest,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> HouseholdOut:
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    household = await HouseholdRepo().rename(db, household_id, body.name)
    await db.commit()
    return HouseholdOut(
        id=household.id,
        name=household.name,
        created_at=household.created_at,
        role=membership.role,
    )


@router.delete("/{household_id}", status_code=204)
async def delete_household(
    household_id: uuid.UUID,
    body: DeleteHouseholdRequest,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    if membership.household_id != household_id:
        raise HTTPException(status_code=403, detail="Not an admin of this household")
    repo = HouseholdRepo()
    household = await repo.get_by_id(db, household_id)
    if household is None:
        raise HTTPException(status_code=404, detail="Household not found")
    if body.confirm_name != household.name:
        raise HTTPException(status_code=409, detail="Household name confirmation does not match")
    await repo.hard_delete(db, household_id)
    await db.commit()
    return Response(status_code=204)

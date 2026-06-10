"""HouseholdRepo — async SQLAlchemy data access for household management (M5)."""

from __future__ import annotations

import datetime
import uuid
from dataclasses import dataclass
from typing import Any

import sqlalchemy as sa
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brew_log import BrewLog
from app.models.catalog import CatalogBean
from app.models.hardware import Hardware
from app.models.household import (
    GuestToken,
    Household,
    HouseholdMember,
    HouseholdRole,
    PendingInvitation,
)
from app.models.inventory import InventoryBag
from app.models.maintenance import MaintenanceLog
from app.models.user import User

_ALLOWED_TENANT_TABLES: dict[str, type[Any]] = {
    BrewLog.__tablename__: BrewLog,
    CatalogBean.__tablename__: CatalogBean,
    InventoryBag.__tablename__: InventoryBag,
    Hardware.__tablename__: Hardware,
    MaintenanceLog.__tablename__: MaintenanceLog,
}


@dataclass(frozen=True, slots=True)
class HouseholdMembershipWithName:
    """Membership plus household name for user-scoped household listings."""

    membership: HouseholdMember
    household_name: str
    member_count: int = 0


class HouseholdRepo:
    """Data access for households, memberships, invitations, and guest tokens."""

    # ── Household ────────────────────────────────────────────────────────────

    async def create_household(
        self, db: AsyncSession, *, name: str, created_by: uuid.UUID
    ) -> Household:
        """Atomically create a household and add the creator as admin (AC-070)."""
        household = Household(name=name, created_by=created_by)
        db.add(household)
        await db.flush()
        await db.refresh(household)

        member = HouseholdMember(
            household_id=household.id,
            user_id=created_by,
            role="admin",
            invited_by=None,
        )
        db.add(member)
        await db.flush()
        return household

    async def get_by_id(self, db: AsyncSession, household_id: uuid.UUID) -> Household | None:
        result = await db.execute(
            sa.select(Household).where(
                Household.id == household_id,
                Household.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def rename(self, db: AsyncSession, household_id: uuid.UUID, name: str) -> Household:
        """Rename a non-deleted household and return the updated row."""
        result = await db.execute(
            sa.update(Household)
            .where(
                Household.id == household_id,
                Household.deleted_at.is_(None),
            )
            .values(name=name)
            .returning(Household)
        )
        household = result.scalar_one_or_none()
        if household is None:
            raise HTTPException(status_code=404, detail="Household not found")
        await db.flush()
        return household

    # ── Members ───────────────────────────────────────────────────────────────

    async def get_member(
        self, db: AsyncSession, household_id: uuid.UUID, user_id: uuid.UUID
    ) -> HouseholdMember | None:
        result = await db.execute(
            sa.select(HouseholdMember).where(
                HouseholdMember.household_id == household_id,
                HouseholdMember.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_user_and_household(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        household_id: uuid.UUID,
    ) -> HouseholdMember | None:
        result = await db.execute(
            sa.select(HouseholdMember)
            .join(Household, Household.id == HouseholdMember.household_id)
            .where(
                HouseholdMember.user_id == user_id,
                HouseholdMember.household_id == household_id,
                Household.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_memberships_for_user(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> list[HouseholdMember]:
        result = await db.execute(
            sa.select(HouseholdMember)
            .join(Household, Household.id == HouseholdMember.household_id)
            .where(
                HouseholdMember.user_id == user_id,
                Household.deleted_at.is_(None),
            )
            .order_by(sa.func.lower(Household.name).asc(), Household.id.asc())
        )
        return list(result.scalars().all())

    async def get_all_for_user(self, db: AsyncSession, user_id: uuid.UUID) -> list[HouseholdMember]:
        return await self.get_memberships_for_user(db, user_id)

    async def count_for_user(self, db: AsyncSession, user_id: uuid.UUID) -> int:
        result = await db.execute(
            sa.select(sa.func.count())
            .select_from(HouseholdMember)
            .join(Household, Household.id == HouseholdMember.household_id)
            .where(
                HouseholdMember.user_id == user_id,
                Household.deleted_at.is_(None),
            )
        )
        return int(result.scalar_one())

    async def get_memberships_with_households_for_user(
        self, db: AsyncSession, user_id: uuid.UUID
    ) -> list[HouseholdMembershipWithName]:
        result = await db.execute(
            sa.select(HouseholdMember, Household.name)
            .join(Household, Household.id == HouseholdMember.household_id)
            .where(
                HouseholdMember.user_id == user_id,
                Household.deleted_at.is_(None),
            )
            .order_by(sa.func.lower(Household.name).asc(), Household.id.asc())
        )
        membership_rows = result.all()
        if not membership_rows:
            return []

        household_ids = [membership.household_id for membership, _ in membership_rows]
        counts_result = await db.execute(
            sa.select(HouseholdMember.household_id, sa.func.count())
            .where(HouseholdMember.household_id.in_(household_ids))
            .group_by(HouseholdMember.household_id)
        )
        member_counts = {
            household_id: int(member_count) for household_id, member_count in counts_result.all()
        }
        return [
            HouseholdMembershipWithName(
                membership=membership,
                household_name=household_name,
                member_count=member_counts.get(membership.household_id, 0),
            )
            for membership, household_name in membership_rows
        ]

    async def add_member(
        self,
        db: AsyncSession,
        *,
        household_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str,
        invited_by: uuid.UUID,
        invited_at: datetime.datetime | None = None,
        accepted_at: datetime.datetime | None = None,
    ) -> HouseholdMember:
        member = HouseholdMember(
            household_id=household_id,
            user_id=user_id,
            role=role,
            invited_by=invited_by,
            invited_at=invited_at,
            accepted_at=accepted_at,
        )
        db.add(member)
        await db.flush()
        await db.refresh(member)
        return member

    async def remove_member(
        self, db: AsyncSession, *, household_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        """Remove a household member; raises 409 if target is the last admin (AC-075)."""
        member = await self.get_member(db, household_id, user_id)
        if member is None:
            return
        if member.role == "admin":
            admin_count = await self.count_admins(db, household_id)
            if admin_count <= 1:
                raise HTTPException(status_code=409, detail="Cannot remove the sole admin")
        await db.execute(
            sa.delete(HouseholdMember).where(
                HouseholdMember.household_id == household_id,
                HouseholdMember.user_id == user_id,
            )
        )
        await db.flush()

    async def update_member_role(
        self,
        db: AsyncSession,
        *,
        household_id: uuid.UUID,
        user_id: uuid.UUID,
        new_role: str,
    ) -> HouseholdMember:
        """Update membership role; raises 409 when demoting the last admin (AC-076)."""
        member = await self.get_member(db, household_id, user_id)
        if member is None:
            raise HTTPException(status_code=404, detail="Member not found")
        if member.role == "admin" and new_role != "admin":
            admin_count = await self.count_admins(db, household_id)
            if admin_count <= 1:
                raise HTTPException(status_code=409, detail="Cannot remove sole admin role")
        await db.execute(
            sa.update(HouseholdMember)
            .where(
                HouseholdMember.household_id == household_id,
                HouseholdMember.user_id == user_id,
            )
            .values(role=new_role)
        )
        await db.flush()
        updated = await self.get_member(db, household_id, user_id)
        assert updated is not None  # noqa: S101
        return updated

    async def count_admins(self, db: AsyncSession, household_id: uuid.UUID) -> int:
        result = await db.execute(
            sa.select(sa.func.count()).where(
                HouseholdMember.household_id == household_id,
                HouseholdMember.role == "admin",
            )
        )
        return int(result.scalar_one())

    async def get_members(self, db: AsyncSession, household_id: uuid.UUID) -> list[HouseholdMember]:
        result = await db.execute(
            sa.select(HouseholdMember).where(HouseholdMember.household_id == household_id)
        )
        return list(result.scalars().all())

    async def count_members(self, db: AsyncSession, household_id: uuid.UUID) -> int:
        """Return the number of active household members."""
        result = await db.execute(
            sa.select(sa.func.count()).where(HouseholdMember.household_id == household_id)
        )
        return int(result.scalar_one())

    async def repair_active_households_for_users(
        self, db: AsyncSession, user_ids: list[uuid.UUID]
    ) -> None:
        """Repair users' active household to alphabetic fallback or NULL."""
        for user_id in user_ids:
            fallback = await db.execute(
                sa.select(HouseholdMember.household_id)
                .join(Household, Household.id == HouseholdMember.household_id)
                .where(
                    HouseholdMember.user_id == user_id,
                    Household.deleted_at.is_(None),
                )
                .order_by(sa.func.lower(Household.name).asc(), Household.id.asc())
                .limit(1)
            )
            await db.execute(
                sa.update(User)
                .where(User.id == user_id)
                .values(active_household_id=fallback.scalar_one_or_none())
            )
        await db.flush()

    async def soft_delete(self, db: AsyncSession, household_id: uuid.UUID) -> None:
        """Soft-delete a household when it has at most one active member."""
        if await self.count_members(db, household_id) >= 2:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete a household with active members. Remove all members first.",
            )
        result = await db.execute(
            sa.update(Household)
            .where(
                Household.id == household_id,
                Household.deleted_at.is_(None),
            )
            .values(deleted_at=sa.text("NOW()"))
            .returning(Household.id)
        )
        if result.fetchone() is None:
            raise HTTPException(status_code=404, detail="Household not found")
        await db.flush()

    async def hard_delete(self, db: AsyncSession, household_id: uuid.UUID) -> list[uuid.UUID]:
        """Hard-delete a household and return affected user IDs for active fallback repair."""
        affected_users = [member.user_id for member in await self.get_members(db, household_id)]
        result = await db.execute(
            sa.delete(Household)
            .where(Household.id == household_id, Household.deleted_at.is_(None))
            .returning(Household.id)
        )
        if result.fetchone() is None:
            raise HTTPException(status_code=404, detail="Household not found")
        await db.flush()
        if affected_users:
            await self.repair_active_households_for_users(db, affected_users)
        return affected_users

    # ── Invitations ───────────────────────────────────────────────────────────

    async def create_invitation(
        self,
        db: AsyncSession,
        *,
        household_id: uuid.UUID,
        invited_by_user_id: uuid.UUID,
        token_hash: str,
        invited_email: str | None,
        invited_role: HouseholdRole,
        display_token_ciphertext: str | None = None,
    ) -> PendingInvitation:
        """Create a pending invitation expiring 72 hours from now."""
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        member_count = await self.count_members(db, household_id)
        if member_count >= 10:
            raise HTTPException(
                status_code=409,
                detail="Household has reached the maximum of 10 members.",
            )

        invite_window_start = now - datetime.timedelta(hours=24)
        recent_invitation_count = await db.execute(
            sa.select(sa.func.count()).where(
                PendingInvitation.household_id == household_id,
                PendingInvitation.invited_by_user_id == invited_by_user_id,
                PendingInvitation.invited_at >= invite_window_start,
                PendingInvitation.status.in_(("pending", "accepted")),
            )
        )
        if int(recent_invitation_count.scalar_one()) >= 10:
            raise HTTPException(
                status_code=429,
                detail="Invitation rate limit exceeded for this household.",
            )

        normalized_invited_email = invited_email.strip().lower() if invited_email else None
        if normalized_invited_email is not None:
            duplicate_invitation = await db.execute(
                sa.select(PendingInvitation.id).where(
                    PendingInvitation.household_id == household_id,
                    sa.func.lower(PendingInvitation.invited_email) == normalized_invited_email,
                    PendingInvitation.status == "pending",
                    PendingInvitation.expires_at > now,
                )
            )
            if duplicate_invitation.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=409,
                    detail="An invitation to this address is already pending.",
                )

            existing_member = await db.execute(
                sa.select(HouseholdMember.id)
                .join(User, User.id == HouseholdMember.user_id)
                .where(
                    HouseholdMember.household_id == household_id,
                    sa.func.lower(User.email) == normalized_invited_email,
                )
            )
            if existing_member.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=409,
                    detail="User is already a member of this household.",
                )

        expires = now + datetime.timedelta(hours=72)
        invitation = PendingInvitation(
            household_id=household_id,
            invited_by_user_id=invited_by_user_id,
            invited_email=normalized_invited_email,
            invited_role=invited_role,
            status="pending",
            token_hash=token_hash,
            display_token_ciphertext=display_token_ciphertext,
            expires_at=expires,
        )
        db.add(invitation)
        await db.flush()
        await db.refresh(invitation)
        return invitation

    async def get_invitation_by_token_hash(
        self, db: AsyncSession, token_hash: str
    ) -> PendingInvitation | None:
        """Return the invitation or None if not found (caller checks expiry/revoke)."""
        result = await db.execute(
            sa.select(PendingInvitation).where(PendingInvitation.token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def get_invitation_by_id(
        self, db: AsyncSession, invitation_id: uuid.UUID
    ) -> PendingInvitation | None:
        result = await db.execute(
            sa.select(PendingInvitation).where(PendingInvitation.id == invitation_id)
        )
        return result.scalar_one_or_none()

    async def accept_invitation(self, db: AsyncSession, invitation_id: uuid.UUID) -> None:
        """Mark a pending invitation accepted using an atomic update."""
        result = await db.execute(
            sa.update(PendingInvitation)
            .where(
                PendingInvitation.id == invitation_id,
                PendingInvitation.status.in_(("pending", "declined")),
            )
            .values(status="accepted", accepted_at=sa.text("NOW()"))
            .returning(PendingInvitation.id)
        )
        row = result.fetchone()
        if row is None:
            raise HTTPException(status_code=410, detail="Invitation is no longer pending")
        await db.flush()

    async def decline_invitation(self, db: AsyncSession, invitation_id: uuid.UUID) -> None:
        """No-op retained for compatibility; v2 decline does not consume invitations."""
        invitation = await self.get_invitation_by_id(db, invitation_id)
        if invitation is None:
            raise HTTPException(status_code=404, detail="Invitation not found")

    async def revoke_invitation(self, db: AsyncSession, invitation_id: uuid.UUID) -> None:
        """Mark an invitation revoked."""
        invitation = await self.get_invitation_by_id(db, invitation_id)
        if invitation is not None and invitation.status == "accepted":
            raise HTTPException(status_code=409, detail="Accepted invitations cannot be revoked")
        result = await db.execute(
            sa.update(PendingInvitation)
            .where(PendingInvitation.id == invitation_id)
            .values(status="revoked", revoked_at=sa.text("NOW()"))
            .returning(PendingInvitation.id)
        )
        if result.fetchone() is None:
            raise HTTPException(status_code=404, detail="Invitation not found")
        await db.flush()

    async def resend_invitation(
        self,
        db: AsyncSession,
        invitation_id: uuid.UUID,
        *,
        token_hash: str,
        display_token_ciphertext: str | None,
    ) -> PendingInvitation:
        """Rotate a non-accepted invitation token and reset its 72-hour expiry."""
        invitation = await self.get_invitation_by_id(db, invitation_id)
        if invitation is None:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status == "accepted":
            raise HTTPException(status_code=409, detail="Accepted invitations cannot be resent")

        expires = datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(hours=72)
        result = await db.execute(
            sa.update(PendingInvitation)
            .where(PendingInvitation.id == invitation_id)
            .values(
                expires_at=expires,
                status="pending",
                token_hash=token_hash,
                display_token_ciphertext=display_token_ciphertext,
                accepted_at=None,
                revoked_at=None,
            )
            .returning(PendingInvitation)
        )
        resent_invitation = result.scalar_one()
        await db.flush()
        return resent_invitation

    async def get_invitations_for_household(
        self, db: AsyncSession, household_id: uuid.UUID
    ) -> list[PendingInvitation]:
        result = await db.execute(
            sa.select(PendingInvitation)
            .where(
                PendingInvitation.household_id == household_id,
                PendingInvitation.status.in_(("pending", "revoked")),
            )
            .order_by(PendingInvitation.invited_at.desc())
        )
        return list(result.scalars().all())

    # ── Guest tokens ──────────────────────────────────────────────────────────

    async def create_guest_token(
        self,
        db: AsyncSession,
        *,
        household_id: uuid.UUID,
        created_by: uuid.UUID,
        token_hash: str,
        display_token_ciphertext: str | None = None,
    ) -> GuestToken:
        token = GuestToken(
            household_id=household_id,
            created_by_user_id=created_by,
            token_hash=token_hash,
            display_token_ciphertext=display_token_ciphertext,
        )
        db.add(token)
        await db.execute(
            sa.update(Household)
            .where(Household.id == household_id)
            .values(is_guest_accessible=True)
        )
        await db.flush()
        await db.refresh(token)
        return token

    async def get_guest_token_by_hash(self, db: AsyncSession, token_hash: str) -> GuestToken | None:
        """Return None if not found, revoked, or expired."""
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        result = await db.execute(
            sa.select(GuestToken).where(
                GuestToken.token_hash == token_hash,
                GuestToken.revoked_at.is_(None),
                sa.or_(GuestToken.expires_at.is_(None), GuestToken.expires_at > now),
            )
        )
        return result.scalar_one_or_none()

    async def get_guest_token_by_hash_include_expired(
        self, db: AsyncSession, token_hash: str
    ) -> GuestToken | None:
        """Return None if not found or revoked; expired tokens are included."""
        result = await db.execute(
            sa.select(GuestToken).where(
                GuestToken.token_hash == token_hash,
                GuestToken.revoked_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_active_guest_token(
        self, db: AsyncSession, household_id: uuid.UUID
    ) -> GuestToken | None:
        now = datetime.datetime.now(tz=datetime.timezone.utc)
        result = await db.execute(
            sa.select(GuestToken)
            .where(
                GuestToken.household_id == household_id,
                GuestToken.revoked_at.is_(None),
                sa.or_(GuestToken.expires_at.is_(None), GuestToken.expires_at > now),
            )
            .order_by(GuestToken.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def revoke_previous_guest_tokens(self, db: AsyncSession, household_id: uuid.UUID) -> None:
        """Revoke all active guest tokens for a household (AC-077)."""
        await db.execute(
            sa.update(GuestToken)
            .where(
                GuestToken.household_id == household_id,
                GuestToken.revoked_at.is_(None),
            )
            .values(revoked_at=sa.text("NOW()"))
        )
        await db.flush()

    async def revoke_guest_tokens(self, db: AsyncSession, household_id: uuid.UUID) -> None:
        await self.revoke_previous_guest_tokens(db, household_id)
        await db.execute(
            sa.update(Household)
            .where(Household.id == household_id)
            .values(is_guest_accessible=False)
        )
        await db.flush()

    # ── Seeding ───────────────────────────────────────────────────────────────

    async def seed_default_household(self, db: AsyncSession, user_id: uuid.UUID) -> Household:
        """Create 'Home' household, add user as admin, and assign all orphan rows (AC-090).

        Orphan rows are rows in the 5 tenant tables where household_id IS NULL.
        All operations happen within the caller's transaction.
        """
        household = await self.create_household(db, name="Home", created_by=user_id)

        # Assign orphan rows across all 5 tenant tables
        tenant_tables = [
            "brew_log",
            "catalog",
            "inventory_bags",
            "hardware",
            "maintenance_log",
        ]
        for table_name in tenant_tables:
            tenant_model = _ALLOWED_TENANT_TABLES.get(table_name)
            if tenant_model is None:
                raise ValueError(f"Unknown tenant table: {table_name}")
            await db.execute(
                sa.update(tenant_model)
                .where(tenant_model.household_id.is_(None))
                .values(household_id=household.id)
            )

        await db.flush()
        return household

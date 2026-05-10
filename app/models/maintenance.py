"""SQLAlchemy ORM model for the `maintenance_log` table."""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MaintenanceLog(Base):
    """A maintenance action performed on a piece of hardware."""

    __tablename__ = "maintenance_log"

    id: Mapped[sa.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    household_id: Mapped[sa.UUID] = mapped_column(
        sa.UUID(as_uuid=True), nullable=False  # FK added in migration 0002
    )
    hardware_id: Mapped[sa.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("hardware.id"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(sa.Text, nullable=False)
    performed_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

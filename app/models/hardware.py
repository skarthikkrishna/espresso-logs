"""SQLAlchemy ORM model for the `hardware` table."""

from __future__ import annotations

import datetime
import uuid
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Hardware(Base):
    """A piece of coffee hardware owned by the household."""

    __tablename__ = "hardware"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    # nullable=True for M2-M4: household_id is populated in M5.
    household_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("households.id", ondelete="CASCADE"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    category: Mapped[str] = mapped_column(sa.Text, nullable=False)
    purchase_date: Mapped[datetime.date | None] = mapped_column(sa.Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    sheets_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True, unique=True)
    product_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    local_image_path: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

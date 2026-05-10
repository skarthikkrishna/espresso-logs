"""SQLAlchemy ORM model for the `brew_log` table."""

from __future__ import annotations

import uuid
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BrewLog(Base):
    """A brew session record."""

    __tablename__ = "brew_log"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    catalog_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("catalog.id"),
        nullable=True,
    )
    brew_method: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    dose_g: Mapped[float | None] = mapped_column(sa.Numeric(5, 1, asdecimal=False), nullable=True)
    yield_g: Mapped[float | None] = mapped_column(sa.Numeric(5, 1, asdecimal=False), nullable=True)
    time_sec: Mapped[int | None] = mapped_column(sa.Integer, nullable=True)
    rating: Mapped[int | None] = mapped_column(sa.SmallInteger, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    brewed_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

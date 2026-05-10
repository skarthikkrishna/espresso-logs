"""SQLAlchemy ORM model for the `catalog` table.

household_id is declared as a plain UUID column (no FK constraint).
The FK constraint is added in Alembic migration 0002 (see plan.md R-2).
"""
from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CatalogBean(Base):
    """A coffee bean entry in the household catalog."""

    __tablename__ = "catalog"

    id: Mapped[sa.UUID] = mapped_column(
        sa.UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
    )
    household_id: Mapped[sa.UUID] = mapped_column(
        sa.UUID(as_uuid=True), nullable=False  # FK added in migration 0002
    )
    roaster: Mapped[str] = mapped_column(sa.Text, nullable=False)
    bean_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    origin: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    process: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    roast_level: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

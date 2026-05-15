"""SQLAlchemy ORM model for the `catalog` table.

household_id carries a FK constraint to households(id) with ondelete="CASCADE",
matching the constraint added in Alembic migration 0002 (see plan.md R-2).
"""

from __future__ import annotations

import uuid
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CatalogBean(Base):
    """A coffee bean entry in the household catalog."""

    __tablename__ = "catalog"

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
    roaster: Mapped[str] = mapped_column(sa.Text, nullable=False)
    bean_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    origin: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    process: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    roast_level: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    sheets_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True, unique=True)
    product_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    local_image_path: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

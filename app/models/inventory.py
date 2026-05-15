"""SQLAlchemy ORM model for the `inventory_bags` table."""

from __future__ import annotations

import uuid
import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InventoryBag(Base):
    """A bag of coffee beans in the household inventory."""

    __tablename__ = "inventory_bags"

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
    catalog_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.UUID(as_uuid=True),
        sa.ForeignKey("catalog.id"),
        nullable=True,
    )
    roast_date: Mapped[sa.Date | None] = mapped_column(sa.Date, nullable=True)
    weight_g: Mapped[float | None] = mapped_column(sa.Numeric(7, 1, asdecimal=False), nullable=True)
    purchase_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    sheets_id: Mapped[str | None] = mapped_column(sa.Text, nullable=True, unique=True)
    beans: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    display_name: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    roast_level: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    status: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    storage_method: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

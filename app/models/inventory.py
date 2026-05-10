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
    roast_date: Mapped[sa.Date | None] = mapped_column(sa.Date, nullable=True)
    weight_g: Mapped[float | None] = mapped_column(sa.Numeric(7, 1), nullable=True)
    purchase_url: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[sa.DateTime] = mapped_column(
        sa.TIMESTAMP(timezone=True),
        nullable=False,
        server_default=sa.text("now()"),
    )

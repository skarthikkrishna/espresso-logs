"""Add nullable hardware maker/brand.

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hardware", sa.Column("maker", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE hardware
        SET maker = CASE
            WHEN name ILIKE '%la marzocco%' OR name ILIKE '%linea micra%' THEN 'La Marzocco'
            WHEN name ILIKE '%weber%' OR name ILIKE '%eg-1%' THEN 'Weber Workshops'
            WHEN name ILIKE '%ims%' OR name ILIKE '%big bang%' OR name ILIKE '%b702%' THEN 'IMS'
            WHEN name ILIKE '%fellow%' OR name ILIKE '%atmos%' THEN 'Fellow'
            WHEN name ILIKE '%breville%' THEN 'Breville'
            WHEN name ILIKE '%niche%' THEN 'Niche'
            WHEN name ILIKE '%rocket%' THEN 'Rocket Espresso'
            WHEN name ILIKE '%decent%' THEN 'Decent Espresso'
            WHEN name ILIKE '%comandante%' THEN 'Comandante'
            ELSE maker
        END
        WHERE maker IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("hardware", "maker")

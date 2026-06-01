"""NFR-D8: Startup guard for fresh self-hosted deployments with no users."""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

SETUP_REQUIRED: bool = False


async def check_and_set_setup_required(db: AsyncSession) -> None:
    """Set the startup guard flag based on whether any users exist."""
    global SETUP_REQUIRED

    result = await db.execute(text("SELECT COUNT(*) FROM users"))
    count = int(result.scalar_one())
    if count == 0:
        SETUP_REQUIRED = True
        logger.warning(
            "NFR-D8: No users found — setup guard ACTIVE. "
            "First authenticated user will be guided to create a household."
        )
    else:
        SETUP_REQUIRED = False


def clear_setup_required() -> None:
    """Disable the startup guard after the first local registration succeeds."""
    global SETUP_REQUIRED

    SETUP_REQUIRED = False

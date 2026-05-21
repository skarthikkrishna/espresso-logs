"""Pagination tests for SqlBrewLogRepo."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.repos.sql.brew_log import SqlBrewLogRepo


async def _seed_rows(db_session: AsyncSession, total: int) -> SqlBrewLogRepo:
    repo = SqlBrewLogRepo(db=db_session)
    for idx in range(total):
        day = idx + 1
        await repo.add(
            {
                "Shot_ID": f"SH-202605{day:02d}-01",
                "Date": f"2026-05-{day:02d}T12:00:00+00:00",
                "User_Notes": f"Shot {day}",
            }
        )
    return repo


async def test_list_paginated_page1(db_session: AsyncSession) -> None:
    """Page 1 returns the newest slice and the full total count."""
    repo = await _seed_rows(db_session, 5)

    rows, total_count = await repo.list_paginated(page=1, per_page=3)

    assert len(rows) == 3
    assert total_count == 5
    assert [row["Shot_ID"] for row in rows] == [
        "SH-20260505-01",
        "SH-20260504-01",
        "SH-20260503-01",
    ]


async def test_list_paginated_page2(db_session: AsyncSession) -> None:
    """Page 2 returns the remaining rows after the first page slice."""
    repo = await _seed_rows(db_session, 5)

    rows, total_count = await repo.list_paginated(page=2, per_page=3)

    assert len(rows) == 2
    assert total_count == 5
    assert [row["Shot_ID"] for row in rows] == ["SH-20260502-01", "SH-20260501-01"]


async def test_list_paginated_offset_formula(db_session: AsyncSession) -> None:
    """Page-based offsets must produce non-overlapping slices."""
    repo = await _seed_rows(db_session, 10)

    page1_rows, total_count = await repo.list_paginated(page=1, per_page=5)
    page2_rows, page2_total = await repo.list_paginated(page=2, per_page=5)

    assert total_count == 10
    assert page2_total == 10
    assert len(page1_rows) == 5
    assert len(page2_rows) == 5
    assert {row["Shot_ID"] for row in page1_rows}.isdisjoint({row["Shot_ID"] for row in page2_rows})
    assert [row["Shot_ID"] for row in page1_rows] == [
        "SH-20260510-01",
        "SH-20260509-01",
        "SH-20260508-01",
        "SH-20260507-01",
        "SH-20260506-01",
    ]
    assert [row["Shot_ID"] for row in page2_rows] == [
        "SH-20260505-01",
        "SH-20260504-01",
        "SH-20260503-01",
        "SH-20260502-01",
        "SH-20260501-01",
    ]

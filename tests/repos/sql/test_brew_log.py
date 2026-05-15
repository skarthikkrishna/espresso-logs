"""Unit tests for SqlBrewLogRepo."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brew_log import BrewLog
from app.repos.sql.brew_log import SqlBrewLogRepo


async def test_add_creates_row(db_session: AsyncSession) -> None:
    """add() inserts a row with correct field mapping."""
    repo = SqlBrewLogRepo(db=db_session)
    row = {
        "Dose_In_g": "18.5",
        "Yield_Out_g": "36.0",
        "Time_Sec": "28",
        "User_Notes": "Tasty",
    }
    await repo.add(row)

    result = await db_session.execute(select(BrewLog).where(BrewLog.notes == "Tasty"))
    entry = result.scalar_one()
    assert entry.dose_g == 18.5
    assert entry.yield_g == 36.0
    assert entry.time_sec == 28
    assert entry.notes == "Tasty"
    assert entry.household_id is None
    assert entry.catalog_id is None


async def test_add_handles_empty_numerics(db_session: AsyncSession) -> None:
    """add() handles empty/invalid numeric fields gracefully."""
    repo = SqlBrewLogRepo(db=db_session)
    row = {"Dose_In_g": "", "Yield_Out_g": "N/A"}
    await repo.add(row)

    result = await db_session.execute(
        select(BrewLog).where(BrewLog.dose_g.is_(None), BrewLog.yield_g.is_(None))
    )
    entry = result.scalars().first()
    assert entry is not None
    assert entry.dose_g is None
    assert entry.yield_g is None


async def test_add_many_inserts_all_rows(db_session: AsyncSession) -> None:
    """add_many() inserts all rows."""
    repo = SqlBrewLogRepo(db=db_session)
    rows = [
        {"User_Notes": "Shot A", "Dose_In_g": "18.0"},
        {"User_Notes": "Shot B", "Dose_In_g": "19.0"},
    ]
    await repo.add_many(rows)

    result = await db_session.execute(
        select(BrewLog).where(BrewLog.notes.in_(["Shot A", "Shot B"]))
    )
    entries = result.scalars().all()
    assert len(entries) == 2


async def test_list_returns_empty(db_session: AsyncSession) -> None:
    """list() returns empty list on empty DB."""
    repo = SqlBrewLogRepo(db=db_session)
    assert await repo.list() == []


async def test_get_returns_none(db_session: AsyncSession) -> None:
    """get() returns None when shot does not exist."""
    repo = SqlBrewLogRepo(db=db_session)
    assert await repo.get("SHOT001") is None


# ---------------------------------------------------------------------------
# Issue #64 — write-then-read integration (Postgres read path)
# ---------------------------------------------------------------------------


async def test_add_then_list_returns_row(db_session: AsyncSession) -> None:
    """write-then-read: row written via add() appears in list()."""
    repo = SqlBrewLogRepo(db=db_session)
    await repo.add({"Shot_ID": "SH-20260515-01", "Dose_In_g": "18.0", "Yield_Out_g": "36.0"})
    results = await repo.list()
    assert len(results) == 1
    assert results[0]["Shot_ID"] == "SH-20260515-01"
    assert results[0]["Dose_In_g"] == "18.0"
    assert results[0]["Yield_Out_g"] == "36.0"


async def test_add_then_get_returns_row(db_session: AsyncSession) -> None:
    """write-then-read: row written via add() is retrievable via get()."""
    repo = SqlBrewLogRepo(db=db_session)
    await repo.add({"Shot_ID": "SH-20260515-02", "User_Notes": "strong"})
    result = await repo.get("SH-20260515-02")
    assert result is not None
    assert result["Shot_ID"] == "SH-20260515-02"
    assert result["User_Notes"] == "strong"


# ---------------------------------------------------------------------------
# Issue #69 — happy-path: list() and get() with data
# ---------------------------------------------------------------------------


async def test_list_returns_inserted_row(db_session: AsyncSession) -> None:
    """list() returns a dict with correct field mapping for an inserted row."""
    repo = SqlBrewLogRepo(db=db_session)
    await repo.add(
        {
            "Shot_ID": "SH-20260515-03",
            "Dose_In_g": "19.5",
            "Yield_Out_g": "39.0",
            "Time_Sec": "30",
            "User_Notes": "balanced",
        }
    )
    results = await repo.list()
    assert len(results) == 1
    row = results[0]
    assert row["Shot_ID"] == "SH-20260515-03"
    assert row["Dose_In_g"] == "19.5"
    assert row["Yield_Out_g"] == "39.0"
    assert row["Time_Sec"] == "30"
    assert row["User_Notes"] == "balanced"


async def test_get_returns_inserted_row(db_session: AsyncSession) -> None:
    """get() returns a dict with correct field mapping for an inserted row."""
    repo = SqlBrewLogRepo(db=db_session)
    await repo.add(
        {
            "Shot_ID": "SH-20260515-04",
            "Dose_In_g": "17.0",
            "Yield_Out_g": "34.0",
            "User_Notes": "slightly sour",
        }
    )
    result = await repo.get("SH-20260515-04")
    assert result is not None
    assert result["Shot_ID"] == "SH-20260515-04"
    assert result["Dose_In_g"] == "17.0"
    assert result["Yield_Out_g"] == "34.0"
    assert result["User_Notes"] == "slightly sour"

"""Unit tests for SqlBrewLogRepo."""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brew_log import BrewLog
from app.repos.sql.brew_log import SqlBrewLogRepo
from app.repos.sql.household import HouseholdRepo
from app.repos.sql.user import UserRepo


async def _make_household(db_session: AsyncSession, username: str) -> uuid.UUID:
    user = await UserRepo().create(
        db_session,
        username=username,
        password_hash="pw",
        google_sub=None,
        email=None,
        display_name=username,
        picture_url=None,
    )
    household = await HouseholdRepo().create_household(
        db_session,
        name=f"{username}-household",
        created_by=user.id,
    )
    return household.id


async def test_add_creates_row(db_session: AsyncSession, test_household_id) -> None:
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
    assert entry.household_id == test_household_id
    assert entry.catalog_id is None


async def test_add_without_commit_preserves_household_context(
    db_session: AsyncSession,
    test_household_id: uuid.UUID,
) -> None:
    """Create-path add(commit=False) keeps SET LOCAL context for response-critical reads."""
    repo = SqlBrewLogRepo(db=db_session)

    await repo.add({"Shot_ID": "SH-RLS-NOCOMMIT-001", "User_Notes": "context"}, commit=False)

    current = await db_session.execute(
        sa.text("SELECT current_setting('app.current_household_id', true)")
    )
    assert current.scalar_one() == str(test_household_id)
    assert await repo.get("SH-RLS-NOCOMMIT-001") is not None


async def test_add_uses_current_household_setting_when_household_omitted(
    db_session: AsyncSession,
) -> None:
    """add() fills household_id from the active RLS tenant setting."""
    household_id = await _make_household(db_session, "brew_log_rls")
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(household_id)},
    )

    repo = SqlBrewLogRepo(db=db_session)
    await repo.add({"Shot_ID": "SH-RLS-001", "User_Notes": "tenant scoped"})

    result = await db_session.execute(select(BrewLog).where(BrewLog.sheets_id == "SH-RLS-001"))
    entry = result.scalar_one()
    assert entry.household_id == household_id


async def test_empty_household_context_fails_closed_without_uuid_cast_error(
    db_session: AsyncSession,
) -> None:
    """Empty app.current_household_id hides tenant rows instead of raising UUID cast errors."""
    household_id = await _make_household(db_session, "brew_log_empty_context")
    await db_session.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(household_id)},
    )
    repo = SqlBrewLogRepo(db=db_session)
    await repo.add({"Shot_ID": "SH-RLS-EMPTY-001", "User_Notes": "hidden on empty context"})

    await db_session.execute(sa.text("SELECT set_config('app.current_household_id', '', true)"))

    assert await repo.list() == []
    assert await repo.get("SH-RLS-EMPTY-001") is None


async def test_household_rls_isolates_brew_log_reads(db_session: AsyncSession) -> None:
    """Two households can write/read only their own brew-log rows under RLS."""
    household_one = await _make_household(db_session, "brew_log_iso_one")
    household_two = await _make_household(db_session, "brew_log_iso_two")
    repo = SqlBrewLogRepo(db=db_session)

    await repo.set_household_context(household_one)
    await repo.add({"Shot_ID": "SH-RLS-ISO-001", "User_Notes": "household one"})
    await repo.set_household_context(household_two)
    await repo.add({"Shot_ID": "SH-RLS-ISO-002", "User_Notes": "household two"})

    await repo.set_household_context(household_one)
    rows_one = await repo.list()
    assert {row["Shot_ID"] for row in rows_one} == {"SH-RLS-ISO-001"}
    assert await repo.get("SH-RLS-ISO-002") is None

    await repo.set_household_context(household_two)
    rows_two = await repo.list()
    assert {row["Shot_ID"] for row in rows_two} == {"SH-RLS-ISO-002"}
    assert await repo.get("SH-RLS-ISO-001") is None


async def test_idempotency_key_is_unique_per_household(db_session: AsyncSession) -> None:
    """The durable idempotency key is scoped by household, not shot content."""
    household_one = await _make_household(db_session, "brew_log_idem_one")
    household_two = await _make_household(db_session, "brew_log_idem_two")
    repo = SqlBrewLogRepo(db=db_session)

    await repo.set_household_context(household_one)
    await repo.add(
        {
            "Shot_ID": "SH-IDEM-001",
            "User_Notes": "first household",
            "Idempotency_Key": "shared-key",
            "Idempotency_Request_Hash": "hash-one",
        }
    )
    await repo.set_household_context(household_two)
    await repo.add(
        {
            "Shot_ID": "SH-IDEM-002",
            "User_Notes": "second household",
            "Idempotency_Key": "shared-key",
            "Idempotency_Request_Hash": "hash-two",
        }
    )

    await repo.set_household_context(household_one)
    existing_one = await repo.get_by_idempotency_key("shared-key")
    assert existing_one is not None
    assert existing_one["Shot_ID"] == "SH-IDEM-001"
    assert existing_one["Idempotency_Request_Hash"] == "hash-one"

    await repo.set_household_context(household_two)
    existing_two = await repo.get_by_idempotency_key("shared-key")
    assert existing_two is not None
    assert existing_two["Shot_ID"] == "SH-IDEM-002"
    assert existing_two["Idempotency_Request_Hash"] == "hash-two"


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

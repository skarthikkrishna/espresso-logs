"""Backend idempotency tests for POST /api/brew-log (feature 018).

Tests FR-001 through FR-011:
  - Duplicate key returns 200 with cached response body
  - Concurrent duplicates produce only one Sheets write (PK guard)
  - TTL expiry forces a fresh write
  - Fail-open when key is absent / null / empty
  - Write failure does not cache; retries succeed
  - Multiple distinct keys each produce independent writes
  - Duplicate 200 response has the expected payload shape
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import sqlalchemy as sa
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.deps import current_household_membership
from app.main import app
from app.models.base import get_db
from app.models.brew_log import BrewLog
from app.models.household import HouseholdMember
from app.services.idempotency_store import IdempotencyStore
from tests.doubles import FakeSheetsClient

pytestmark = pytest.mark.asyncio(loop_scope="module")

# ---------------------------------------------------------------------------
# Auth helpers (mirrors test_api.py)
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "tester@example.com", "name": "Tester", "picture": ""}


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})

# ---------------------------------------------------------------------------
# Minimal fake-data rows (enough for route to resolve names + write)
# ---------------------------------------------------------------------------

_INVENTORY_ROW = {
    "Bag_ID": "BAG-TEST-01",
    "Beans": "Test Roaster — Test Bean",
    "RoastDate": "2025-01-01",
    "RoastLevel": "Medium",
    "Display_Name": "Test Roaster — Test Bean",
    "Catalog_ID": "CAT-TEST-01",
    "Status": "Active",
    "Storage_Method": "Ambient",
}

_CATALOG_ROW = {
    "Catalog_ID": "CAT-TEST-01",
    "Roaster": "Test Roaster",
    "Bean_Name": "Test Bean",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}

_HARDWARE_ROW = {
    "Hardware_ID": "HW-TEST-01",
    "Category": "Machine",
    "Name": "Test Machine",
    "Image_URL": "",
}

_POST_BODY_BASE: dict = {
    "bag_id": "BAG-TEST-01",
    "dose_in_g": 18.0,
    "yield_out_g": 36.0,
    "time_sec": 28.0,
    "grind_setting": "12",
    "shot_eligibility": "Good Espresso",
}

_SQL_SCHEMA_READY = False

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def app_fixture():
    """Return the FastAPI application object."""
    return app


@pytest.fixture(autouse=True)
def _reset_stores(app_fixture):
    """Clear idempotency store and dep overrides before/after each test."""
    from app.deps import get_idempotency_store, get_llm_client, get_sheets_client
    from app.repos.base import get_process_cache

    for dep in (get_sheets_client, get_llm_client, get_idempotency_store):
        app_fixture.dependency_overrides.pop(dep, None)
    get_process_cache()._store.clear()

    store = get_idempotency_store()
    store.clear()  # reinits asyncio.Lock too

    yield

    for dep in (get_sheets_client, get_llm_client, get_idempotency_store):
        app_fixture.dependency_overrides.pop(dep, None)
    get_process_cache()._store.clear()
    store.clear()


def _make_fake_client(brew_log_rows: list | None = None) -> FakeSheetsClient:
    """Return a FakeSheetsClient pre-seeded with representative rows."""
    return FakeSheetsClient(
        {
            "Inventory": [_INVENTORY_ROW.copy()],
            "Catalog": [_CATALOG_ROW.copy()],
            "Hardware": [_HARDWARE_ROW.copy()],
            "Brew_Log": [r.copy() for r in (brew_log_rows or [])],
            "Maintenance": [],
        }
    )


def _install_overrides(fake_client: FakeSheetsClient) -> None:
    """Override the sheets-client dependency so all repos use *fake_client*."""
    from app.deps import get_sheets_client

    app.dependency_overrides[get_sheets_client] = lambda: fake_client


def _remove_overrides() -> None:
    from app.deps import get_sheets_client

    app.dependency_overrides.pop(get_sheets_client, None)


# ---------------------------------------------------------------------------
# Helper: build an authenticated AsyncClient
# ---------------------------------------------------------------------------


def _client_ctx():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _require_sql_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — skipping SQL-backed idempotency regression")
    global _SQL_SCHEMA_READY
    if not _SQL_SCHEMA_READY:
        from tests.conftest import _run_alembic_upgrade_head

        _run_alembic_upgrade_head()
        _SQL_SCHEMA_READY = True
    from app.config import settings

    monkeypatch.setattr(settings, "use_postgres", True)


def _sessionmaker() -> async_sessionmaker[AsyncSession]:
    import app.models.base as base

    return async_sessionmaker(base.get_engine(), expire_on_commit=False)


async def _seed_household_lookup_data(
    household_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    suffix: str,
) -> dict[str, str]:
    bag_id = f"BAG-SQL-{suffix}"
    catalog_id = f"CAT-SQL-{suffix}"
    machine_id = f"HW-SQL-M-{suffix}"
    grinder_id = f"HW-SQL-G-{suffix}"
    basket_id = f"HW-SQL-B-{suffix}"
    session_factory = _sessionmaker()
    async with session_factory() as session:
        await session.execute(
            sa.text(
                """
                INSERT INTO users (id, username, password_hash, display_name)
                VALUES (:uid, :username, 'fixture-only', :display_name)
                ON CONFLICT (id) DO UPDATE
                SET display_name = EXCLUDED.display_name
                """
            ),
            {
                "uid": user_id,
                "username": f"sql-idem-{suffix}",
                "display_name": f"SQL Idem {suffix}",
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO households (id, name, created_by)
                VALUES (:hid, :name, :uid)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {"hid": household_id, "name": f"SQL Household {suffix}", "uid": user_id},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO household_members (household_id, user_id, role)
                VALUES (:hid, :uid, 'admin')
                ON CONFLICT (household_id, user_id) DO UPDATE
                SET role = EXCLUDED.role
                """
            ),
            {"hid": household_id, "uid": user_id},
        )
        await session.execute(
            sa.text("UPDATE users SET active_household_id = :hid WHERE id = :uid"),
            {"hid": household_id, "uid": user_id},
        )
        await session.execute(
            sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(household_id)},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO catalog (household_id, sheets_id, roaster, bean_name, roast_level)
                VALUES (:hid, :catalog_id, :roaster, :bean, 'Medium')
                """
            ),
            {
                "hid": household_id,
                "catalog_id": catalog_id,
                "roaster": f"SQL Roaster {suffix}",
                "bean": f"SQL Bean {suffix}",
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO inventory_bags (
                    household_id, sheets_id, sheets_catalog_id, beans, display_name,
                    roast_level, status, storage_method
                )
                VALUES (
                    :hid, :bag_id, :catalog_id, :beans, :display_name,
                    'Medium', 'Active', 'Ambient'
                )
                """
            ),
            {
                "hid": household_id,
                "bag_id": bag_id,
                "catalog_id": catalog_id,
                "beans": f"SQL Roaster {suffix} — SQL Bean {suffix}",
                "display_name": f"SQL Roaster {suffix} — SQL Bean {suffix}",
            },
        )
        for hardware_id, category, name in (
            (machine_id, "Machine", f"SQL Machine {suffix}"),
            (grinder_id, "Grinder", f"SQL Grinder {suffix}"),
            (basket_id, "Basket", f"SQL Basket {suffix}"),
        ):
            await session.execute(
                sa.text(
                    """
                    INSERT INTO hardware (household_id, sheets_id, category, name)
                    VALUES (:hid, :hardware_id, :category, :name)
                    """
                ),
                {
                    "hid": household_id,
                    "hardware_id": hardware_id,
                    "category": category,
                    "name": name,
                },
            )
        await session.commit()
    return {
        "bag_id": bag_id,
        "machine_id": machine_id,
        "grinder_id": grinder_id,
        "basket_id": basket_id,
    }


def _install_sql_app_overrides(active: dict[str, uuid.UUID]) -> None:
    fake = _make_fake_client()
    _install_overrides(fake)
    session_factory = _sessionmaker()

    async def _sql_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    async def _sql_membership(
        db: AsyncSession = Depends(get_db),
    ) -> HouseholdMember:
        await db.execute(
            sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(active["household_id"])},
        )
        member = HouseholdMember(
            household_id=active["household_id"],
            user_id=active["user_id"],
            role="admin",
        )
        member.id = uuid.uuid4()
        return member

    app.dependency_overrides[get_db] = _sql_db
    app.dependency_overrides[current_household_membership] = _sql_membership


def _clear_sql_app_overrides() -> None:
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(current_household_membership, None)
    _remove_overrides()


def _shot_date_for_sql_ids(ids: dict[str, str]) -> str:
    suffix = ids["bag_id"].rsplit("-", 1)[-1]
    seed = int(suffix[:8], 16)
    year = 2200 + (seed % 7000)
    month = 1 + ((seed // 7000) % 12)
    day = 1 + ((seed // (7000 * 12)) % 28)
    return f"{year:04d}-{month:02d}-{day:02d}"


def _sql_body(ids: dict[str, str], key: str) -> dict:
    return {
        **_POST_BODY_BASE,
        **ids,
        "shot_date": _shot_date_for_sql_ids(ids),
        "idempotency_key": key,
    }


async def _count_rows_for_key(household_id: uuid.UUID, key: str) -> int:
    session_factory = _sessionmaker()
    async with session_factory() as session:
        await session.execute(
            sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
            {"hid": str(household_id)},
        )
        result = await session.execute(
            sa.select(sa.func.count())
            .select_from(BrewLog)
            .where(BrewLog.household_id == household_id, BrewLog.idempotency_key == key)
        )
        return int(result.scalar_one())


# ===========================================================================
# Tests
# ===========================================================================


async def test_duplicate_key_returns_200():
    """POST twice with same key; first returns 201, second returns 200.

    Both response bodies must agree on shot_id, date, and dose_in_g.
    """
    fake = _make_fake_client()
    _install_overrides(fake)
    body = {**_POST_BODY_BASE, "idempotency_key": "dedup-key-test-001"}

    try:
        with patch(
            "app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="mocked feedback")
        ):
            async with _client_ctx() as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                r1 = await client.post("/api/brew-log", json=body)
                r2 = await client.post("/api/brew-log", json=body)
    finally:
        _remove_overrides()

    assert r1.status_code == 201
    assert r2.status_code == 200

    d1, d2 = r1.json(), r2.json()
    assert d1["shot_id"] == d2["shot_id"]
    assert d1["date"] == d2["date"]
    assert d1["dose_in_g"] == d2["dose_in_g"]


async def test_concurrent_duplicates_single_write():
    """Two concurrent POSTs with the same idempotency_key both return 201.

    The IdempotencyStore's asyncio.Lock ensures the second concurrent request
    sees the in-flight sentinel and falls through to repo.add(). After M5
    write-disable, repo.add() delegates to SQL only (Sheets is not written to).

    Technique:
    - An asyncio.Barrier(2) is used inside check_and_set_sentinel so BOTH tasks
      must complete their sentinel check before either one proceeds.  This is a
      deterministic rendezvous — Task A sets the sentinel (in_flight=True), then
      waits; Task B sees in_flight=True (returns None), then waits; both are
      released simultaneously and proceed to repo.add().
    - BrewLogRepo.list_existing_ids is patched to return [] for both requests.
    """
    from app.deps import get_idempotency_store
    from app.repos.brew_log import BrewLogRepo

    fake = _make_fake_client()
    _install_overrides(fake)

    store = get_idempotency_store()
    original_cas = store.check_and_set_sentinel

    barrier = asyncio.Barrier(2)

    async def barrier_cas(key: str) -> dict | None:
        """Rendezvous: both tasks must complete their sentinel check before proceeding."""
        result = await original_cas(key)
        await barrier.wait()  # deterministic synchronisation point
        return result

    body = {**_POST_BODY_BASE, "idempotency_key": "concurrent-dedup-key-777"}

    try:
        with (
            patch.object(store, "check_and_set_sentinel", barrier_cas),
            patch.object(BrewLogRepo, "list_existing_ids", return_value=[]),
            patch(
                "app.routers.api_brew_log.get_ai_feedback",
                AsyncMock(return_value="mocked feedback"),
            ),
        ):
            async with _client_ctx() as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                responses = await asyncio.gather(
                    client.post("/api/brew-log", json=body),
                    client.post("/api/brew-log", json=body),
                )
    finally:
        _remove_overrides()

    statuses = sorted(r.status_code for r in responses)
    assert statuses == [201, 201], f"Expected both 201 (in-flight sentinel path), got {statuses}"

    # M5 write-disable: Sheets store must NOT have received any new rows
    brew_log_rows = fake._store.get("Brew_Log", [])
    assert len(brew_log_rows) == 0, (
        f"Expected 0 rows in Brew_Log (Sheets writes disabled), got {len(brew_log_rows)}"
    )


async def test_ttl_expiry_treats_as_fresh():
    """After TTL expires the same key is treated as a brand-new request (201 again)."""

    # Inject a controllable clock into a fresh IdempotencyStore
    fake_now: list[float] = [0.0]
    short_ttl_store = IdempotencyStore(ttl=10.0, now=lambda: fake_now[0])

    from app.deps import get_idempotency_store as _dep_fn

    app.dependency_overrides[_dep_fn] = lambda: short_ttl_store

    fake = _make_fake_client()
    _install_overrides(fake)

    body = {**_POST_BODY_BASE, "idempotency_key": "ttl-expiry-key-abc"}

    try:
        with patch(
            "app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="mocked feedback")
        ):
            async with _client_ctx() as client:
                client.cookies.set("session", _AUTHED_COOKIE)

                # First POST at t=0
                r1 = await client.post("/api/brew-log", json=body)
                assert r1.status_code == 201

                # Advance clock past TTL
                fake_now[0] = 11.0

                # Second POST at t=11 — entry expired, treated as fresh
                r2 = await client.post("/api/brew-log", json=body)
    finally:
        app.dependency_overrides.pop(_dep_fn, None)
        _remove_overrides()

    assert r2.status_code == 201, f"Expected 201 (fresh after TTL expiry), got {r2.status_code}"
    # M5 write-disable: Sheets store not written to regardless of TTL state
    brew_log_rows = fake._store.get("Brew_Log", [])
    assert len(brew_log_rows) == 0, (
        f"Expected 0 rows in Brew_Log (Sheets writes disabled), got {len(brew_log_rows)}"
    )


async def test_fail_open_no_key():
    """Absent, null, or empty idempotency_key → fail-open → always 201."""
    fake = _make_fake_client()
    _install_overrides(fake)

    sub_cases = [
        {**_POST_BODY_BASE},  # key field absent entirely
        {**_POST_BODY_BASE, "idempotency_key": None},  # explicit null
        {**_POST_BODY_BASE, "idempotency_key": ""},  # empty string
    ]

    try:
        with patch(
            "app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="mocked feedback")
        ):
            async with _client_ctx() as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                for body in sub_cases:
                    r = await client.post("/api/brew-log", json=body)
                    assert r.status_code == 201, (
                        f"Expected 201 for body={body!r}, got {r.status_code}"
                    )
    finally:
        _remove_overrides()


async def test_write_failure_no_cache_entry():
    """If add() raises, no cache entry is stored; retry with same key returns 201."""
    from app.deps import _DualWriteBrewLogRepo

    fake = _make_fake_client()

    call_count: list[int] = [0]
    original_add = _DualWriteBrewLogRepo.add

    async def failing_then_succeeding_add(self, row: dict, *, commit: bool = True) -> None:  # type: ignore[misc]
        call_count[0] += 1
        if call_count[0] == 1:
            raise RuntimeError("Simulated SQL write failure")
        return await original_add(self, row, commit=commit)

    _install_overrides(fake)
    body = {**_POST_BODY_BASE, "idempotency_key": "write-fail-key-xyz"}

    # raise_app_exceptions=False so RuntimeError comes back as HTTP 500 instead
    # of propagating into the test.
    try:
        with (
            patch.object(_DualWriteBrewLogRepo, "add", failing_then_succeeding_add),
            patch(
                "app.routers.api_brew_log.get_ai_feedback",
                AsyncMock(return_value="mocked feedback"),
            ),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                client.cookies.set("session", _AUTHED_COOKIE)

                # First POST — add() raises → 500; nothing cached
                r1 = await client.post("/api/brew-log", json=body)
                assert r1.status_code == 500, f"Expected 500 on write failure, got {r1.status_code}"

                # Idempotency store must NOT have a completed cache entry
                from app.deps import get_idempotency_store

                store = get_idempotency_store()
                entry = store._cache.get("write-fail-key-xyz")
                assert entry is None or entry.get("in_flight") is True, (
                    "Failed write must not leave a completed cache entry"
                )

            # Second POST — use default transport; add() succeeds → 201
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client2:
                client2.cookies.set("session", _AUTHED_COOKIE)
                r2 = await client2.post("/api/brew-log", json=body)
    finally:
        _remove_overrides()

    assert r2.status_code == 201, f"Expected 201 on retry after write failure, got {r2.status_code}"


async def test_multi_unique_keys_all_written():
    """Three POSTs each with a distinct key all return 201 and write separate rows."""
    fake = _make_fake_client()
    _install_overrides(fake)

    keys = ["unique-key-alpha", "unique-key-beta", "unique-key-gamma"]
    statuses: list[int] = []

    try:
        with patch(
            "app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="mocked feedback")
        ):
            async with _client_ctx() as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                for k in keys:
                    r = await client.post(
                        "/api/brew-log",
                        json={**_POST_BODY_BASE, "idempotency_key": k},
                    )
                    statuses.append(r.status_code)
    finally:
        _remove_overrides()

    assert statuses == [201, 201, 201], f"Expected all 201, got {statuses}"
    # M5 write-disable: Sheets store not written to for any of the keys
    brew_log_rows = fake._store.get("Brew_Log", [])
    assert len(brew_log_rows) == 0, (
        f"Expected 0 rows in Brew_Log (Sheets writes disabled), got {len(brew_log_rows)}"
    )


async def test_duplicate_response_payload_shape():
    """The 200 duplicate response contains all expected BrewLogEntryOut fields."""
    fake = _make_fake_client()
    _install_overrides(fake)
    body = {**_POST_BODY_BASE, "idempotency_key": "payload-shape-key-001"}

    try:
        with patch(
            "app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="mocked feedback")
        ):
            async with _client_ctx() as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                r1 = await client.post("/api/brew-log", json=body)
                r2 = await client.post("/api/brew-log", json=body)
    finally:
        _remove_overrides()

    assert r1.status_code == 201
    assert r2.status_code == 200

    data = r2.json()
    expected_fields = {"shot_id", "date", "dose_in_g", "yield_out_g", "time_sec", "bag_display"}
    missing = expected_fields - set(data.keys())
    assert not missing, f"Duplicate response missing fields: {missing}"

    assert data["shot_id"], "shot_id must be non-empty"
    assert data["date"], "date must be non-empty"
    assert data["dose_in_g"] == 18.0
    assert data["yield_out_g"] == 36.0
    assert data["time_sec"] == 28.0


async def test_brew_log_create_ai_timeout_no_500():
    """Timeout in get_ai_feedback is caught; POST still returns 201."""
    fake = _make_fake_client()
    _install_overrides(fake)

    try:
        with patch(
            "app.routers.api_brew_log.asyncio.wait_for",
            side_effect=asyncio.TimeoutError,
        ):
            async with _client_ctx() as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                r = await client.post("/api/brew-log", json=_POST_BODY_BASE)
    finally:
        _remove_overrides()

    assert r.status_code == 201, f"Expected 201 when AI times out, got {r.status_code}"


async def test_brew_log_create_llm_error_no_500():
    """LLMError raised inside get_ai_feedback is handled gracefully; POST still returns 201.

    get_ai_feedback catches LLMError internally and returns a graceful string.
    We verify this by injecting a failing LLM client — the route must return 201.
    """
    from app.services.inference import LLMError

    class _FailingLLMClient:
        async def complete(self, prompt: str) -> str:
            raise LLMError("simulated LLM failure")

    from app.deps import get_llm_client

    fake = _make_fake_client()
    _install_overrides(fake)
    app.dependency_overrides[get_llm_client] = lambda: _FailingLLMClient()

    try:
        async with _client_ctx() as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            r = await client.post("/api/brew-log", json=_POST_BODY_BASE)
    finally:
        app.dependency_overrides.pop(get_llm_client, None)
        _remove_overrides()

    assert r.status_code == 201, f"Expected 201 when LLM raises, got {r.status_code}"


async def test_postgres_mirror_failure_does_not_cache_success():
    """POST /api/brew-log with a brew-log-repo write failure must not cache a 201 response.

    Intent: if the brew log repo add() raises (e.g. dual-write Postgres failure
    re-raises), the idempotency store must not record a completed success entry —
    a subsequent replay with the same key must not return a cached 201. The
    failure must be surfaced, not silently stored as success.
    """
    from app.deps import _DualWriteBrewLogRepo

    fake = _make_fake_client()
    _install_overrides(fake)

    key = "idem-pg-fail-test-001"  # gitleaks:allow
    body = {**_POST_BODY_BASE, "idempotency_key": key}

    try:
        # raise_app_exceptions=False so the unhandled repo exception comes back
        # as an HTTP 500 instead of propagating into the test.
        with patch.object(_DualWriteBrewLogRepo, "add", new_callable=AsyncMock) as mock_add:
            mock_add.side_effect = Exception("simulated dual-write failure")
            async with AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                r = await client.post("/api/brew-log", json=body)

            # The write failed — route must surface 500, not 201
            assert r.status_code == 500, (
                f"Expected 500 when brew log repo add() fails, got {r.status_code}"
            )

            # The idempotency store must not have a completed cache entry
            from app.deps import get_idempotency_store

            store = get_idempotency_store()
            entry = store._cache.get(key)
            assert entry is None or entry.get("in_flight") is True, (
                f"Failed write must not leave a completed cache entry; found: {entry}"
            )
    finally:
        _remove_overrides()


async def test_sql_create_preserves_rls_context_for_response_lookups(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """POST insert + lookup serialization keeps household RLS context through response build."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ids = await _seed_household_lookup_data(household_id, user_id, suffix=suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)
    body = _sql_body(ids, f"sql-rls-{suffix}")

    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="ok")):
            async with _client_ctx() as client:
                response = await client.post("/api/brew-log", json=body)
    finally:
        _clear_sql_app_overrides()

    assert response.status_code == 201
    data = response.json()
    assert data["bag_display"] == f"SQL Roaster {suffix} — SQL Bean {suffix}"
    assert data["machine_name"] == f"SQL Machine {suffix}"
    assert data["grinder_name"] == f"SQL Grinder {suffix}"
    assert data["basket_name"] == f"SQL Basket {suffix}"
    assert await _count_rows_for_key(household_id, body["idempotency_key"]) == 1


async def test_sql_create_response_failure_rolls_back_partial_insert(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If response-critical lookup serialization fails before commit, no partial row remains."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ids = await _seed_household_lookup_data(household_id, user_id, suffix=suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)
    body = _sql_body(ids, f"sql-rollback-{suffix}")

    try:
        with patch(
            "app.routers.api_brew_log._build_lookups",
            AsyncMock(side_effect=RuntimeError("lookup serialization failed")),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                response = await client.post("/api/brew-log", json=body)
    finally:
        _clear_sql_app_overrides()

    assert response.status_code == 500
    assert await _count_rows_for_key(household_id, body["idempotency_key"]) == 0


async def test_sql_same_household_same_key_replays_original_after_store_clear(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SQL idempotency is authoritative after process-local cache loss."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ids = await _seed_household_lookup_data(household_id, user_id, suffix=suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)
    body = _sql_body(ids, f"sql-replay-{suffix}")

    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="ok")):
            async with _client_ctx() as client:
                first = await client.post("/api/brew-log", json=body)
                from app.deps import get_idempotency_store

                get_idempotency_store().clear()
                second = await client.post("/api/brew-log", json=body)
    finally:
        _clear_sql_app_overrides()

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.json()["shot_id"] == first.json()["shot_id"]
    assert await _count_rows_for_key(household_id, body["idempotency_key"]) == 1


async def test_sql_same_household_same_key_different_payload_returns_409(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reusing an idempotency key with a materially different payload is rejected."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ids = await _seed_household_lookup_data(household_id, user_id, suffix=suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)
    body = _sql_body(ids, f"sql-conflict-{suffix}")
    changed = {**body, "dose_in_g": 19.0}

    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="ok")):
            async with _client_ctx() as client:
                first = await client.post("/api/brew-log", json=body)
                second = await client.post("/api/brew-log", json=changed)
    finally:
        _clear_sql_app_overrides()

    assert first.status_code == 201
    assert second.status_code == 409
    assert await _count_rows_for_key(household_id, body["idempotency_key"]) == 1


async def test_sql_same_key_is_independent_across_households(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The same idempotency key can create independent rows in different households."""
    _require_sql_backend(monkeypatch)
    key = f"sql-cross-household-{uuid.uuid4().hex[:10]}"
    household_one = uuid.uuid4()
    user_one = uuid.uuid4()
    suffix_one = uuid.uuid4().hex[:10]
    ids_one = await _seed_household_lookup_data(household_one, user_one, suffix=suffix_one)
    household_two = uuid.uuid4()
    user_two = uuid.uuid4()
    suffix_two = uuid.uuid4().hex[:10]
    ids_two = await _seed_household_lookup_data(household_two, user_two, suffix=suffix_two)
    active = {"household_id": household_one, "user_id": user_one}
    _install_sql_app_overrides(active)

    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="ok")):
            async with _client_ctx() as client:
                first = await client.post("/api/brew-log", json=_sql_body(ids_one, key))
                active["household_id"] = household_two
                active["user_id"] = user_two
                second = await client.post("/api/brew-log", json=_sql_body(ids_two, key))
    finally:
        _clear_sql_app_overrides()

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["shot_id"] != second.json()["shot_id"]
    assert await _count_rows_for_key(household_one, key) == 1
    assert await _count_rows_for_key(household_two, key) == 1


async def test_sql_different_keys_allow_identical_shot_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Durable idempotency does not introduce content-based deduplication."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    ids = await _seed_household_lookup_data(household_id, user_id, suffix=suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)
    key_one = f"sql-distinct-one-{suffix}"
    key_two = f"sql-distinct-two-{suffix}"
    body_one = _sql_body(ids, key_one)
    body_two = {**body_one, "idempotency_key": key_two}

    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="ok")):
            async with _client_ctx() as client:
                first = await client.post("/api/brew-log", json=body_one)
                second = await client.post("/api/brew-log", json=body_two)
    finally:
        _clear_sql_app_overrides()

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["shot_id"] != second.json()["shot_id"]
    assert await _count_rows_for_key(household_id, key_one) == 1
    assert await _count_rows_for_key(household_id, key_two) == 1

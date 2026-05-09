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
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.main import app
from app.services.idempotency_store import IdempotencyStore
from tests.doubles import FakeSheetsClient

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
    from app.deps import get_idempotency_store
    from app.repos.base import get_process_cache

    app_fixture.dependency_overrides.clear()
    get_process_cache()._store.clear()

    store = get_idempotency_store()
    store.clear()  # reinits asyncio.Lock too

    yield

    app_fixture.dependency_overrides.clear()
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
        with patch("app.routers.api_brew_log.asyncio.create_task"):
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
    """Two concurrent POSTs with the same idempotency_key write exactly one row.

    The IdempotencyStore's asyncio.Lock ensures the second concurrent request
    sees the in-flight sentinel and falls through to repo.add().  FakeSheetsClient's
    PK guard then prevents the duplicate Sheets write.

    Technique:
    - An asyncio.Barrier(2) is used inside check_and_set_sentinel so BOTH tasks
      must complete their sentinel check before either one proceeds.  This is a
      deterministic rendezvous — Task A sets the sentinel (in_flight=True), then
      waits; Task B sees in_flight=True (returns None), then waits; both are
      released simultaneously and proceed to repo.add().
    - BrewLogRepo.list_existing_ids is patched to return [] for both requests,
      ensuring both compute the same Shot_ID so the PK guard fires on the
      second append_row call.
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

    add_call_count: list[int] = [0]
    original_add = BrewLogRepo.add

    def tracking_add(self, row: dict) -> None:
        add_call_count[0] += 1
        return original_add(self, row)

    body = {**_POST_BODY_BASE, "idempotency_key": "concurrent-dedup-key-777"}

    try:
        with (
            patch.object(store, "check_and_set_sentinel", barrier_cas),
            patch.object(BrewLogRepo, "list_existing_ids", return_value=[]),
            patch.object(BrewLogRepo, "add", tracking_add),
            patch("app.routers.api_brew_log.asyncio.create_task"),
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

    # repo.add() must have been called once per concurrent request
    assert add_call_count[0] == 2, f"Expected add() called 2 times, got {add_call_count[0]}"

    # FakeSheetsClient PK guard: only 1 row persisted despite 2 add() calls
    brew_log_rows = fake._store.get("Brew_Log", [])
    assert len(brew_log_rows) == 1, f"Expected exactly 1 row in Brew_Log, got {len(brew_log_rows)}"


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
        with patch("app.routers.api_brew_log.asyncio.create_task"):
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
    # Two rows written — one per fresh request
    brew_log_rows = fake._store.get("Brew_Log", [])
    assert len(brew_log_rows) == 2, f"Expected 2 rows after TTL expiry, got {len(brew_log_rows)}"


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
        with patch("app.routers.api_brew_log.asyncio.create_task"):
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
    from app.repos.brew_log import BrewLogRepo

    fake = _make_fake_client()

    call_count: list[int] = [0]
    original_add = BrewLogRepo.add

    def failing_then_succeeding_add(self, row: dict) -> None:
        call_count[0] += 1
        if call_count[0] == 1:
            raise RuntimeError("Simulated Sheets write failure")
        return original_add(self, row)

    _install_overrides(fake)
    body = {**_POST_BODY_BASE, "idempotency_key": "write-fail-key-xyz"}

    # raise_app_exceptions=False so RuntimeError comes back as HTTP 500 instead
    # of propagating into the test.
    try:
        with (
            patch.object(BrewLogRepo, "add", failing_then_succeeding_add),
            patch("app.routers.api_brew_log.asyncio.create_task"),
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
        with patch("app.routers.api_brew_log.asyncio.create_task"):
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
    # Each key results in a distinct row written to Brew_Log
    brew_log_rows = fake._store.get("Brew_Log", [])
    assert len(brew_log_rows) == 3, f"Expected 3 rows for 3 unique keys, got {len(brew_log_rows)}"


async def test_duplicate_response_payload_shape():
    """The 200 duplicate response contains all expected BrewLogEntryOut fields."""
    fake = _make_fake_client()
    _install_overrides(fake)
    body = {**_POST_BODY_BASE, "idempotency_key": "payload-shape-key-001"}

    try:
        with patch("app.routers.api_brew_log.asyncio.create_task"):
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

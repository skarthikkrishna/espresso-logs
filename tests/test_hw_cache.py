"""Cache-behaviour tests for HardwareRepo."""

from __future__ import annotations

import base64
import json

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.repos.base import TTLCache
from app.repos.hardware import HardwareRepo
from tests.doubles import FakeSheetsClient

# ---------------------------------------------------------------------------
# Full 5-column rows — FakeSheetsClient.update_row derives headers from the
# first existing row's .keys(); using only 3 columns causes Product_URL and
# Local_Image_Path to be silently dropped on all subsequent upsert() calls.
# ---------------------------------------------------------------------------

HARDWARE_ROWS = [
    {
        'Hardware_ID': 'M01',
        'Category': 'Machine',
        'Name': 'Rocket Mozzafiato',
        'Product_URL': '',
        'Local_Image_Path': '',
    },
    {
        'Hardware_ID': 'G01',
        'Category': 'Grinder',
        'Name': 'Niche Zero',
        'Product_URL': '',
        'Local_Image_Path': '',
    },
]


@pytest.fixture
def fake_client():
    client = FakeSheetsClient()
    client.seed('Hardware', HARDWARE_ROWS)
    return client


@pytest.fixture
def cache():
    return TTLCache(ttl=60.0)


@pytest.fixture
def repo(fake_client, cache):
    return HardwareRepo(client=fake_client, cache=cache)


def test_list_populates_cache(repo, fake_client):
    rows = repo.list()
    assert len(rows) == 2
    assert fake_client.call_count('get_all_records') == 1
    repo.list()
    assert fake_client.call_count('get_all_records') == 1


def test_list_category_filter_uses_cache(repo, fake_client):
    repo.list()
    machines = repo.list(category='Machine')
    assert len(machines) == 1
    assert machines[0]['Hardware_ID'] == 'M01'
    assert fake_client.call_count('get_all_records') == 1


def test_get_uses_cache(repo, fake_client):
    repo.list()
    item = repo.get('G01')
    assert item is not None
    assert item['Name'] == 'Niche Zero'
    assert fake_client.call_count('get_all_records') == 1


def test_get_unknown_id_returns_none(repo):
    assert repo.get('X99') is None


def test_upsert_invalidates_cache(repo, fake_client):
    repo.list()
    repo.upsert({
        'Hardware_ID': 'M01',
        'Category': 'Machine',
        'Name': 'Updated',
        'Product_URL': '',
        'Local_Image_Path': '',
    })
    repo.list()
    # list() → call 1; upsert() internal _fetch_all → call 2; list() cache miss → call 3
    assert fake_client.call_count('get_all_records') == 3


def test_add_many_invalidates_cache(repo, fake_client):
    repo.list()
    repo.add_many([{'Hardware_ID': 'B01', 'Category': 'Basket', 'Name': 'IMS 20g'}])
    repo.list()
    assert fake_client.call_count('get_all_records') == 2


def test_delete_rows_invalidates_cache(repo, fake_client):
    repo.list()
    repo.delete_rows(2, 2)
    repo.list()
    assert fake_client.call_count('get_all_records') == 2


def test_next_id_uses_cached_data(repo, fake_client):
    repo.list()
    next_id = repo.next_id('Machine')
    assert next_id == 'M02'
    assert fake_client.call_count('get_all_records') == 1


# ---------------------------------------------------------------------------
# T013 — New column regression tests
# ---------------------------------------------------------------------------

def test_upsert_writes_product_url_and_local_image_path():
    """upsert() correctly persists Product_URL and Local_Image_Path when COLUMNS includes them."""
    client = FakeSheetsClient(initial={
        "Hardware": [
            {
                "Hardware_ID": "M01",
                "Category": "Machine",
                "Name": "Rocket",
                "Product_URL": "",
                "Local_Image_Path": "",
            }
        ]
    })
    repo = HardwareRepo(client=client, cache=TTLCache(ttl=60.0))

    new_product_url = "https://breville.com/barista-express"
    new_image_path = "https://storage.googleapis.com/bucket/hardware-images/M01-abc.jpg"

    repo.upsert({
        "Hardware_ID": "M01",
        "Category": "Machine",
        "Name": "Rocket",
        "Product_URL": new_product_url,
        "Local_Image_Path": new_image_path,
    })

    result = repo.get("M01")
    assert result is not None
    assert result["Product_URL"] == new_product_url
    assert result["Local_Image_Path"] == new_image_path


def test_columns_tuple_includes_new_fields():
    """Regression guard: COLUMNS must include Product_URL and Local_Image_Path."""
    assert "Product_URL" in HardwareRepo.COLUMNS
    assert "Local_Image_Path" in HardwareRepo.COLUMNS


# Integration test — requires auth helpers
_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}


def _make_session_cookie(data: dict) -> str:
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return TimestampSigner(_TEST_SECRET).sign(payload).decode("utf-8")


_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})


async def test_hw_to_out_with_empty_local_image_path():
    """GET /api/hardware row with Local_Image_Path='' → image_path is null in JSON response."""
    from app.deps import get_sheets_client
    from app.main import app
    from app.repos.base import get_process_cache

    seed = [
        {
            "Hardware_ID": "M01",
            "Category": "Machine",
            "Name": "Rocket Mozzafiato",
            "Product_URL": "",
            "Local_Image_Path": "",
        }
    ]
    fake = FakeSheetsClient(initial={"Hardware": seed})
    app.dependency_overrides[get_sheets_client] = lambda: fake
    get_process_cache()._store.clear()

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get(
                "/api/hardware",
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)
        get_process_cache()._store.clear()

    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    # image_path must be present as null — NOT absent from the response
    assert "image_path" in items[0]
    assert items[0]["image_path"] is None

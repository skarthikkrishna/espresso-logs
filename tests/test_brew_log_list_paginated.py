from __future__ import annotations

import base64
import json
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.deps import get_sheets_client
from app.main import app
from app.repos.base import get_process_cache
from tests.doubles import FakeSheetsClient

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "tester@example.com", "name": "Tester", "picture": ""}

_BASE_CATALOG = {
    "Catalog_ID": "CAT-001",
    "Roaster": "Boundary Roaster",
    "Bean_Name": "Boundary Bean",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}

_BASE_BAG = {
    "Bag_ID": "BAG-001",
    "Beans": "Boundary Roaster — Boundary Bean",
    "RoastDate": "2026-05-01",
    "RoastLevel": "Medium",
    "Display_Name": "Boundary Roaster — Boundary Bean",
    "Catalog_ID": "CAT-001",
    "Status": "Active",
    "Storage_Method": "Ambient",
}


def _make_session_cookie(data: dict, secret: str = _TEST_SECRET) -> str:
    signer = TimestampSigner(secret)
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return signer.sign(payload).decode("utf-8")


_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})


def _brew_row(shot_id: str, brewed_at: str) -> dict[str, object]:
    return {
        "Shot_ID": shot_id,
        "Date": brewed_at,
        "Bag_ID": "BAG-001",
        "Machine_ID": "",
        "Grinder_ID": "",
        "Basket_ID": "",
        "Dose_In_g": 18.0,
        "Yield_Out_g": 36.0,
        "Time_Sec": 28,
        "Grind_Setting": "12",
        "Shot_Eligibility": "Good Espresso",
        "Taste_Summary": "Balanced",
        "User_Notes": "",
        "AI_Feedback": "",
        "Storage_Method": "Ambient",
    }


def _make_fake_client(brew_rows: list[dict[str, object]]) -> FakeSheetsClient:
    return FakeSheetsClient(
        {
            "Catalog": [_BASE_CATALOG.copy()],
            "Inventory": [_BASE_BAG.copy()],
            "Hardware": [],
            "Maintenance": [],
            "Brew_Log": [row.copy() for row in brew_rows],
        }
    )


async def _get_brew_log(fake_client: FakeSheetsClient, url: str) -> dict:
    get_process_cache()._store.clear()
    app.dependency_overrides[get_sheets_client] = lambda: fake_client
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            response = await client.get(url)
    finally:
        app.dependency_overrides.pop(get_sheets_client, None)
        get_process_cache()._store.clear()

    assert response.status_code == 200
    return response.json()


async def test_brew_log_list_paginated_envelope() -> None:
    """The Brew Log list must return a paginated envelope, not a bare array."""
    payload = await _get_brew_log(
        _make_fake_client(
            [
                _brew_row("SH-20260515-01", "2026-05-15"),
                _brew_row("SH-20260514-01", "2026-05-14"),
            ]
        ),
        "/api/brew-log",
    )

    assert {"items", "total_count", "page", "per_page", "has_next", "sync_alert"}.issubset(
        payload.keys()
    )
    assert payload["page"] == 1
    assert payload["per_page"] == 100
    assert isinstance(payload["items"], list)
    assert payload["has_next"] is ((payload["page"] * payload["per_page"]) < payload["total_count"])


async def test_brew_log_date_boundary() -> None:
    """Shots around the switchover boundary must not be filtered out implicitly."""
    payload = await _get_brew_log(
        _make_fake_client(
            [
                _brew_row("SH-20260514-2359", "2026-05-14T23:59:00Z"),
                _brew_row("SH-20260515-0001", "2026-05-15T00:01:00Z"),
            ]
        ),
        "/api/brew-log?page=1&per_page=100",
    )

    shot_ids = {item["shot_id"] for item in payload["items"]}
    assert "SH-20260514-2359" in shot_ids
    assert "SH-20260515-0001" in shot_ids


async def test_brew_log_per_page_clamped() -> None:
    """Large per_page values must be clamped to 100 to prevent response amplification."""
    brew_rows = [_brew_row(f"SH-20260515-{idx:03d}", f"2026-05-{(idx % 28) + 1:02d}") for idx in range(150)]

    with patch("app.routers.api_brew_log.settings.brew_log_sync_alert", False):
        payload = await _get_brew_log(_make_fake_client(brew_rows), "/api/brew-log?per_page=500")

    assert payload["per_page"] == 100
    assert len(payload["items"]) == 100
    assert payload["total_count"] == 150
    assert payload["has_next"] is True

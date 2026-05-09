"""Tests for auto image sourcing on POST /api/hardware."""
from __future__ import annotations

import base64
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner

from app.deps import get_llm_client, get_sheets_client
from app.main import app
from app.repos.base import get_process_cache
from app.routers.api_hardware import _hw_to_out

# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}


def _make_session_cookie(data: dict) -> str:
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return TimestampSigner(_TEST_SECRET).sign(payload).decode("utf-8")


_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})

# ---------------------------------------------------------------------------
# Full 5-column Hardware seed row (required — FakeSheetsClient derives headers
# from first row's keys; missing columns are silently dropped on update_row).
# ---------------------------------------------------------------------------

_HW_SEED: list[dict] = [
    {
        "Hardware_ID": "M01",
        "Category": "Machine",
        "Name": "Existing Machine",
        "Product_URL": "",
        "Local_Image_Path": "",
    }
]


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


class _FakeLLMNoOp:
    async def complete(self, prompt: str, max_tokens: int = 512) -> str:
        return '{"roaster": "", "bean_name": "", "roast_level": ""}'


@pytest.fixture(autouse=True)
def _reset_overrides():
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient(initial={"Hardware": [row.copy() for row in _HW_SEED]})
    app.dependency_overrides[get_sheets_client] = lambda: fake
    app.dependency_overrides[get_llm_client] = lambda: _FakeLLMNoOp()
    get_process_cache()._store.clear()
    yield
    app.dependency_overrides.pop(get_sheets_client, None)
    app.dependency_overrides.pop(get_llm_client, None)
    get_process_cache()._store.clear()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_create_with_product_url_sources_and_uploads_image():
    """POST /api/hardware with product_url → image is sourced, uploaded, and returned."""
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient(initial={"Hardware": [row.copy() for row in _HW_SEED]})
    app.dependency_overrides[get_sheets_client] = lambda: fake

    fake_img = b"\xff\xd8\xff" + b"\x00" * 100  # minimal JPEG-ish bytes
    gcs_path = "https://storage.googleapis.com/bucket/hardware-images/G01-abc12345.jpg"

    with (
        patch(
            "app.routers.api_hardware.fetch_page_context",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.routers.api_hardware.source_bean_image",
            new_callable=AsyncMock,
            return_value="https://cdn.niche.com/niche-zero.jpg",
        ),
        patch(
            "app.routers.api_hardware.fetch_image_bytes",
            new_callable=AsyncMock,
            return_value=(fake_img, "image/jpeg"),
        ),
        patch(
            "app.routers.api_hardware.upload_image",
            new_callable=AsyncMock,
            return_value=gcs_path,
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/hardware",
                json={
                    "category": "Grinder",
                    "name": "Niche Zero",
                    "product_url": "https://www.nichecoffee.co.uk/products/niche-zero",
                },
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["image_path"] == gcs_path

    # Verify the second upsert (Local_Image_Path update) landed in the sheet
    hardware_id = data["hardware_id"]
    row = fake.get_all_records("Hardware")
    hw_row = next((r for r in row if r["Hardware_ID"] == hardware_id), None)
    assert hw_row is not None
    assert hw_row["Local_Image_Path"] == gcs_path


async def test_create_with_product_url_image_sourcing_fails_gracefully():
    """source_bean_image raises → item is still created with image_path None."""
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient(initial={"Hardware": [row.copy() for row in _HW_SEED]})
    app.dependency_overrides[get_sheets_client] = lambda: fake

    with (
        patch(
            "app.routers.api_hardware.fetch_page_context",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
        "app.routers.api_hardware.source_bean_image",
        new_callable=AsyncMock,
        side_effect=Exception("mock failure"),
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/hardware",
                json={
                    "category": "Grinder",
                    "name": "Niche Zero",
                    "product_url": "https://www.nichecoffee.co.uk/products/niche-zero",
                },
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["image_path"] is None

    # Initial upsert must have run before pipeline — Local_Image_Path is "" not None
    hardware_id = data["hardware_id"]
    rows = fake.get_all_records("Hardware")
    hw_row = next((r for r in rows if r["Hardware_ID"] == hardware_id), None)
    assert hw_row is not None
    assert hw_row["Local_Image_Path"] == ""


async def test_create_with_product_url_fetch_image_fails_gracefully():
    """fetch_image_bytes returns None → item created, image_path is None."""
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient(initial={"Hardware": [row.copy() for row in _HW_SEED]})
    app.dependency_overrides[get_sheets_client] = lambda: fake

    with (
        patch(
            "app.routers.api_hardware.fetch_page_context",
            new_callable=AsyncMock,
            return_value=None,
        ),
        patch(
            "app.routers.api_hardware.source_bean_image",
            new_callable=AsyncMock,
            return_value="https://cdn.niche.com/niche-zero.jpg",
        ),
        patch(
            "app.routers.api_hardware.fetch_image_bytes",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/hardware",
                json={
                    "category": "Grinder",
                    "name": "Niche Zero",
                    "product_url": "https://www.nichecoffee.co.uk/products/niche-zero",
                },
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    assert resp.json()["image_path"] is None


async def test_create_without_product_url_no_image_sourcing():
    """No product_url → source_bean_image never called; item created, image_path None."""
    with (
        patch("app.routers.api_hardware.source_bean_image", new_callable=AsyncMock) as mock_source,
        patch("app.routers.api_hardware.fetch_image_bytes", new_callable=AsyncMock) as mock_fetch,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/hardware",
                json={"category": "Basket", "name": "IMS 20g"},
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    assert resp.json()["image_path"] is None
    mock_source.assert_not_called()
    mock_fetch.assert_not_called()


async def test_create_with_invalid_product_url_scheme():
    """product_url with ftp:// scheme → 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/hardware",
            json={
                "category": "Machine",
                "name": "Some Machine",
                "product_url": "ftp://example.com/machine",
            },
            cookies={"session": _AUTHED_COOKIE},
        )

    assert resp.status_code == 422


async def test_hw_to_out_reads_local_image_path():
    """_hw_to_out() maps Local_Image_Path to image_path; empty string becomes None."""
    gcs_url = "https://storage.googleapis.com/bucket/hardware-images/M01-abc.jpg"

    row_with_image = {
        "Hardware_ID": "M01",
        "Category": "Machine",
        "Name": "Test Machine",
        "Product_URL": "https://example.com",
        "Local_Image_Path": gcs_url,
    }
    out = _hw_to_out(row_with_image)
    assert out.image_path == gcs_url

    row_no_image = {
        "Hardware_ID": "M02",
        "Category": "Machine",
        "Name": "Another Machine",
        "Product_URL": "",
        "Local_Image_Path": "",
    }
    out_no_image = _hw_to_out(row_no_image)
    assert out_no_image.image_path is None

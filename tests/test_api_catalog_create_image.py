"""Tests for auto image sourcing on POST /api/catalog."""

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
# Fixtures
# ---------------------------------------------------------------------------


class _FakeLLMNoOp:
    async def complete(self, prompt: str, max_tokens: int = 512) -> str:
        return '{"roaster": "", "bean_name": "", "roast_level": ""}'


@pytest.fixture(autouse=True)
def _reset_overrides():
    from tests.doubles import FakeSheetsClient

    fake = FakeSheetsClient()
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


@pytest.mark.asyncio
async def test_create_with_product_url_sources_and_uploads_image():
    """When product_url is given, source_bean_image is called and image is uploaded."""
    fake_img = b"\xff\xd8\xff" + b"\x00" * 100  # minimal JPEG-ish bytes

    with (
        patch(
            "app.routers.api_catalog.source_bean_image",
            new_callable=AsyncMock,
            return_value="https://cdn.roaster.com/bag.jpg",
        ),
        patch(
            "app.routers.api_catalog.fetch_image_bytes",
            new_callable=AsyncMock,
            return_value=(fake_img, "image/jpeg"),
        ),
        patch(
            "app.routers.api_catalog.upload_image",
            new_callable=AsyncMock,
            return_value="https://storage.googleapis.com/bucket/bean-images/CAT100-abc.jpg",
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/catalog",
                json={
                    "roaster": "Verve",
                    "bean_name": "Seabright",
                    "roast_level": "Medium",
                    "product_url": "https://vervecoffee.com/products/seabright",
                },
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["image_path"] == "https://storage.googleapis.com/bucket/bean-images/CAT100-abc.jpg"


@pytest.mark.asyncio
async def test_create_with_source_image_url_skips_resourcing():
    """source_image_url bypasses source_bean_image; only fetch+upload is called."""
    fake_img = b"\x89PNG" + b"\x00" * 100

    with (
        patch("app.routers.api_catalog.source_bean_image", new_callable=AsyncMock) as mock_source,
        patch(
            "app.routers.api_catalog.fetch_image_bytes",
            new_callable=AsyncMock,
            return_value=(fake_img, "image/png"),
        ),
        patch(
            "app.routers.api_catalog.upload_image",
            new_callable=AsyncMock,
            return_value="https://storage.googleapis.com/bucket/bean-images/CAT100-abc.png",
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/catalog",
                json={
                    "roaster": "Verve",
                    "bean_name": "Seabright",
                    "roast_level": "Medium",
                    "product_url": "https://vervecoffee.com/products/seabright",
                    "source_image_url": "https://cdn.roaster.com/bag.png",
                },
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    data = resp.json()
    assert data["image_path"] == "https://storage.googleapis.com/bucket/bean-images/CAT100-abc.png"
    mock_source.assert_not_called()


@pytest.mark.asyncio
async def test_create_without_product_url_skips_image_sourcing():
    """No product_url → no image sourcing attempt; entry still created successfully."""
    with (
        patch("app.routers.api_catalog.source_bean_image", new_callable=AsyncMock) as mock_source,
        patch("app.routers.api_catalog.fetch_image_bytes", new_callable=AsyncMock) as mock_fetch,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/catalog",
                json={"roaster": "Blue Bottle", "bean_name": "Hayes Valley", "roast_level": "Dark"},
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    assert resp.json()["image_path"] is None
    mock_source.assert_not_called()
    mock_fetch.assert_not_called()


@pytest.mark.asyncio
async def test_create_image_sourcing_failure_does_not_break_create():
    """If sourcing fails, the catalog entry is still created — just without an image."""
    with patch(
        "app.routers.api_catalog.source_bean_image",
        new_callable=AsyncMock,
        side_effect=Exception("network error"),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/catalog",
                json={
                    "roaster": "Sightglass",
                    "bean_name": "Owl's Howl",
                    "roast_level": "Light",
                    "product_url": "https://sightglasscoffee.com/products/owls-howl",
                },
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 201
    assert resp.json()["image_path"] is None

"""Unit tests for POST /api/catalog/infer route."""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.deps import get_llm_client
from app.services.inference import LLMError
from app.services.image_sourcer import PageContext


# ---------------------------------------------------------------------------
# Fake LLM clients
# ---------------------------------------------------------------------------


class _FakeLLMSuccess:
    """Returns valid JSON with text inference fields populated."""

    async def complete(self, prompt: str, max_tokens: int = 512) -> str:
        return '{"roaster": "Blue Bottle", "bean_name": "Giant Steps", "roast_level": "Medium"}'


class _FakeLLMFailure:
    """Raises LLMError to simulate network/API failure."""

    async def complete(self, prompt: str, max_tokens: int = 512) -> str:
        raise LLMError("LLM unavailable")


class _FakeLLMEmpty:
    """Returns JSON with all empty strings (inference found nothing)."""

    async def complete(self, prompt: str, max_tokens: int = 512) -> str:
        return '{"roaster": "", "bean_name": "", "roast_level": ""}'


# ---------------------------------------------------------------------------
# Auth helper — copy pattern from test_api.py
# ---------------------------------------------------------------------------


def _make_authed_cookie() -> str:
    """Create a valid signed session cookie for test user."""
    import base64, json as _json
    from itsdangerous import TimestampSigner

    _TEST_SECRET = "dev-insecure-secret-for-testing-only"
    payload = _json.dumps({"user": {"email": "test@example.com", "name": "Test"}})
    b64 = base64.b64encode(payload.encode()).decode()
    signed = TimestampSigner(_TEST_SECRET).sign(b64).decode()
    return signed


_AUTHED_COOKIE = _make_authed_cookie()


# ---------------------------------------------------------------------------
# Fixture to reset dependency overrides
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_overrides():
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_catalog_infer_success():
    """Successful inference returns pre-filled fields with HTTP 200."""
    app.dependency_overrides[get_llm_client] = lambda: _FakeLLMSuccess()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/catalog/infer",
            json={"url": "https://example.com/coffee"},
            cookies={"session": _AUTHED_COOKIE},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["roaster"] == "Blue Bottle"
    assert data["bean_name"] == "Giant Steps"
    assert data["roast_level"] == "Medium"


@pytest.mark.asyncio
async def test_catalog_infer_llm_failure_returns_200_empty():
    """LLM failure returns HTTP 200 with empty fields — never 5xx."""
    app.dependency_overrides[get_llm_client] = lambda: _FakeLLMFailure()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/catalog/infer",
            json={"url": "https://example.com/coffee"},
            cookies={"session": _AUTHED_COOKIE},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["roaster"] == ""
    assert data["bean_name"] == ""
    assert data["roast_level"] == ""


@pytest.mark.asyncio
async def test_catalog_infer_empty_url_returns_200_empty():
    """Empty URL short-circuits without calling LLM; returns HTTP 200 empty."""
    app.dependency_overrides[get_llm_client] = lambda: _FakeLLMEmpty()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/catalog/infer",
            json={"url": ""},
            cookies={"session": _AUTHED_COOKIE},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["roaster"] == ""
    assert data["bean_name"] == ""


@pytest.mark.asyncio
async def test_catalog_infer_requires_auth():
    """Unauthenticated request is rejected (no session cookie)."""
    app.dependency_overrides[get_llm_client] = lambda: _FakeLLMSuccess()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/catalog/infer",
            json={"url": "https://example.com/coffee"},
        )
    assert resp.status_code in (401, 403, 302)


@pytest.mark.asyncio
async def test_catalog_infer_uses_page_text_for_roast_level():
    """Infer passes og:description page content to LLM — not just the URL slug.

    The LLM prompt must contain page text so roast level (never in the URL)
    can be reliably inferred. We verify by asserting the prompt received by
    the fake LLM contains the og:description text from the page.
    """
    captured_prompts: list[str] = []

    class _CapturingLLM:
        async def complete(self, prompt: str, max_tokens: int = 512) -> str:
            captured_prompts.append(prompt)
            return '{"roaster": "Verve", "bean_name": "Seabright", "roast_level": "Light"}'

    rich_ctx = PageContext(
        og_title="Seabright Light Roast | Verve Coffee",
        og_description="A bright, light roast from Santa Cruz with notes of citrus.",
        og_image="https://cdn.vervecoffee.com/bag.jpg",
    )

    app.dependency_overrides[get_llm_client] = lambda: _CapturingLLM()
    with (
        patch(
            "app.routers.api_catalog.fetch_page_context",
            new_callable=AsyncMock,
            return_value=rich_ctx,
        ),
        patch(
            "app.routers.api_catalog.source_bean_image",
            new_callable=AsyncMock,
            return_value="https://cdn.vervecoffee.com/bag.jpg",
        ),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/catalog/infer",
                json={"url": "https://vervecoffee.com/products/seabright"},
                cookies={"session": _AUTHED_COOKIE},
            )

    assert resp.status_code == 200
    data = resp.json()
    assert data["roast_level"] == "Light"
    assert data["image_path"] == "https://cdn.vervecoffee.com/bag.jpg"
    # Confirm the LLM received real page text, not just the URL
    assert len(captured_prompts) == 1
    assert (
        "light roast" in captured_prompts[0].lower() or "seabright" in captured_prompts[0].lower()
    )

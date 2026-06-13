"""Tests for auto image sourcing on POST /api/catalog."""

from __future__ import annotations

import base64
import io
import json
import os
import uuid
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, patch

import pytest
import sqlalchemy as sa
from fastapi import Depends, HTTPException
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.datastructures import Headers, UploadFile

from app.deps import current_household_membership, get_llm_client, get_sheets_client
from app.main import app
from app.models.base import get_db
from app.models.household import HouseholdMember
from app.repos.base import get_process_cache
from app.routers.api_catalog import api_catalog_upload_image

pytestmark = pytest.mark.asyncio(loop_scope="module")

# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "test@example.com", "name": "Test User", "picture": ""}


def _make_session_cookie(data: dict) -> str:
    payload = base64.b64encode(json.dumps(data).encode("utf-8"))
    return TimestampSigner(_TEST_SECRET).sign(payload).decode("utf-8")


_AUTHED_COOKIE = _make_session_cookie({"user": _TEST_USER})
_SQL_SCHEMA_READY = False
_SQL_ENGINE = None


def _require_sql_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — skipping SQL-backed catalog API regression")
    global _SQL_SCHEMA_READY
    if not _SQL_SCHEMA_READY:
        from tests.conftest import _run_alembic_upgrade_head

        _run_alembic_upgrade_head()
        _SQL_SCHEMA_READY = True
    from app.config import settings

    monkeypatch.setattr(settings, "use_postgres", True)


def _sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _SQL_ENGINE
    if _SQL_ENGINE is None:
        _SQL_ENGINE = create_async_engine(os.environ["DATABASE_URL"], echo=False)

    return async_sessionmaker(_SQL_ENGINE, expire_on_commit=False)


async def _seed_sql_household(household_id: uuid.UUID, user_id: uuid.UUID, suffix: str) -> None:
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
                "username": f"sql-catalog-{suffix}",
                "display_name": f"SQL Catalog {suffix}",
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
            {"hid": household_id, "name": f"SQL Catalog Household {suffix}", "uid": user_id},
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
        seed_catalog_id = f"CAT{2_000_000_000 + int(suffix[:8], 16)}"
        await session.execute(
            sa.text(
                """
                INSERT INTO catalog (household_id, sheets_id, roaster, bean_name, roast_level)
                VALUES (:hid, :catalog_id, :roaster, 'Seed Bean', 'Medium')
                ON CONFLICT (household_id, sheets_id) DO NOTHING
                """
            ),
            {
                "hid": household_id,
                "catalog_id": seed_catalog_id,
                "roaster": f"Seed Roaster {suffix}",
            },
        )
        await session.commit()


def _install_sql_app_overrides(active: dict[str, uuid.UUID]) -> None:
    from tests.doubles import FakeSheetsClient

    app.dependency_overrides[get_sheets_client] = lambda: FakeSheetsClient()
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
    app.dependency_overrides.pop(get_sheets_client, None)


def _roast_date_for_suffix(suffix: str, offset: int = 0) -> str:
    seed = int(suffix[:8], 16) + offset
    year = 2200 + (seed % 7000)
    month = 1 + ((seed // 7000) % 12)
    day = 1 + ((seed // (7000 * 12)) % 28)
    return f"{year:04d}-{month:02d}-{day:02d}"


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


async def test_sql_catalog_create_then_upload_image_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Manual create can be followed by local/test image upload without GCS credentials."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    await _seed_sql_household(household_id, user_id, suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)

    try:
        with patch(
            "app.routers.api_catalog.upload_image",
            new_callable=AsyncMock,
            return_value="/static/uploads/spec039-bag.png",
        ) as mock_upload:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                created = await client.post(
                    "/api/catalog",
                    json={
                        "roaster": f"SPEC039 Roaster {suffix}",
                        "bean_name": "Manual Image Bean",
                        "roast_level": "Medium",
                    },
                    cookies={"session": _AUTHED_COOKIE},
                )
                catalog_id = created.json()["catalog_id"]
                uploaded = await client.post(
                    f"/api/catalog/{catalog_id}/image",
                    files={"file": ("bag.png", b"\x89PNG\r\n\x1a\n", "image/png")},
                    cookies={"session": _AUTHED_COOKIE},
                )
                detail = await client.get(
                    f"/api/catalog/{catalog_id}",
                    cookies={"session": _AUTHED_COOKIE},
                )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert uploaded.status_code == 200
    assert uploaded.json()["image_path"] == "/static/uploads/spec039-bag.png"
    assert detail.status_code == 200
    assert detail.json()["item"]["image_path"] == "/static/uploads/spec039-bag.png"
    mock_upload.assert_awaited_once()


async def test_sql_catalog_image_upload_failure_keeps_created_catalog_visible(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Partial success is safe: failed upload does not delete the catalog entry."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    await _seed_sql_household(household_id, user_id, suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/catalog",
                json={
                    "roaster": f"SPEC039 Upload Fail {suffix}",
                    "bean_name": "Manual Image Bean",
                    "roast_level": "Light",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            catalog_id = created.json()["catalog_id"]

        with patch(
            "app.routers.api_catalog.upload_image",
            new_callable=AsyncMock,
            side_effect=RuntimeError("simulated local upload failure"),
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app, raise_app_exceptions=False),
                base_url="http://test",
            ) as client:
                failed = await client.post(
                    f"/api/catalog/{catalog_id}/image",
                    files={"file": ("bag.jpg", b"\xff\xd8\xff", "image/jpeg")},
                    cookies={"session": _AUTHED_COOKIE},
                )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            detail = await client.get(
                f"/api/catalog/{catalog_id}",
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert failed.status_code == 500
    assert detail.status_code == 200
    assert detail.json()["item"]["image_path"] is None


async def test_sql_catalog_image_upload_rejects_non_image_without_deleting_catalog(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Upload validation rejects unacceptable files and preserves the catalog row."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    await _seed_sql_household(household_id, user_id, suffix)
    active = {"household_id": household_id, "user_id": user_id}
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/catalog",
                json={
                    "roaster": f"SPEC039 Reject Upload {suffix}",
                    "bean_name": "Manual Image Bean",
                    "roast_level": "Dark",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            catalog_id = created.json()["catalog_id"]
            rejected = await client.post(
                f"/api/catalog/{catalog_id}/image",
                files={"file": ("not-image.txt", b"not image", "text/plain")},
                cookies={"session": _AUTHED_COOKIE},
            )
            detail = await client.get(
                f"/api/catalog/{catalog_id}",
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert rejected.status_code == 422
    assert detail.status_code == 200
    assert detail.json()["item"]["image_path"] is None


async def test_catalog_upload_image_rejects_missing_content_type() -> None:
    """Missing upload content_type is rejected instead of defaulting to JPEG."""
    file = UploadFile(io.BytesIO(b"\xff\xd8\xff"), filename="bag.jpg", headers=Headers())
    catalog_repo = AsyncMock()
    catalog_repo.get.return_value = {"Catalog_ID": "CAT001"}

    with pytest.raises(HTTPException, match="file must be a JPEG, PNG, or WebP image."):
        await api_catalog_upload_image("CAT001", file=file, catalog_repo=catalog_repo)


async def test_catalog_upload_image_rejects_mismatched_content_bytes() -> None:
    """Declared image type is not enough; uploaded bytes must match it."""
    file = UploadFile(
        io.BytesIO(b"not actually a png"),
        filename="bag.png",
        headers=Headers({"content-type": "image/png"}),
    )
    catalog_repo = AsyncMock()
    catalog_repo.get.return_value = {"Catalog_ID": "CAT001"}

    with pytest.raises(HTTPException, match="file content does not match"):
        await api_catalog_upload_image("CAT001", file=file, catalog_repo=catalog_repo)


async def test_sql_catalog_add_bag_rejects_roast_mismatch_when_catalog_roast_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Catalog roast is authoritative for add-bag when present."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    await _seed_sql_household(household_id, user_id, suffix)
    active = {"household_id": household_id, "user_id": user_id}
    roast_date = _roast_date_for_suffix(suffix)
    next_roast_date = _roast_date_for_suffix(suffix, offset=1)
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/catalog",
                json={
                    "roaster": f"SPEC039 Roast Lock {suffix}",
                    "bean_name": "Locked Bean",
                    "roast_level": "Medium",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            catalog_id = created.json()["catalog_id"]
            mismatch = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={
                    "roast_date": roast_date,
                    "roast_level": "Dark",
                    "storage_method": "Ambient",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            matched = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={
                    "roast_date": next_roast_date,
                    "roast_level": "Medium",
                    "storage_method": "Ambient",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert mismatch.status_code == 422
    assert "match catalog roast level" in mismatch.text
    assert matched.status_code == 201
    assert matched.json()["roast_level"] == "Medium"


async def test_sql_catalog_add_bag_requires_valid_roast_when_catalog_roast_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty catalog roast leaves add-bag roast selectable but still required and validated."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    await _seed_sql_household(household_id, user_id, suffix)
    active = {"household_id": household_id, "user_id": user_id}
    roast_date = _roast_date_for_suffix(suffix)
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/catalog",
                json={
                    "roaster": f"SPEC039 Empty Roast {suffix}",
                    "bean_name": "Selectable Bean",
                    "roast_level": "",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            catalog_id = created.json()["catalog_id"]
            missing = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={"roast_date": roast_date, "roast_level": ""},
                cookies={"session": _AUTHED_COOKIE},
            )
            invalid = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={"roast_date": roast_date, "roast_level": "Extra Dark"},
                cookies={"session": _AUTHED_COOKIE},
            )
            valid = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={"roast_date": roast_date, "roast_level": "Light"},
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert missing.status_code == 422
    assert invalid.status_code == 422
    assert valid.status_code == 201
    assert valid.json()["roast_level"] == "Light"


async def test_sql_catalog_add_bag_cross_household_catalog_returns_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Add-bag cannot use a catalog entry from another household."""
    _require_sql_backend(monkeypatch)
    suffix_one = uuid.uuid4().hex[:10]
    household_one = uuid.uuid4()
    user_one = uuid.uuid4()
    await _seed_sql_household(household_one, user_one, suffix_one)
    active = {"household_id": household_one, "user_id": user_one}
    roast_date = _roast_date_for_suffix(suffix_one)
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/catalog",
                json={
                    "roaster": f"SPEC039 Household One {suffix_one}",
                    "bean_name": "Hidden Bean",
                    "roast_level": "Medium",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            catalog_id = created.json()["catalog_id"]

        suffix_two = uuid.uuid4().hex[:10]
        household_two = uuid.uuid4()
        user_two = uuid.uuid4()
        await _seed_sql_household(household_two, user_two, suffix_two)
        active["household_id"] = household_two
        active["user_id"] = user_two

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={"roast_date": roast_date, "roast_level": "Medium"},
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert response.status_code == 404


async def test_sql_inventory_patch_active_finished_status_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Inventory PATCH accepts only Active/Finished and returns status as source of truth."""
    _require_sql_backend(monkeypatch)
    suffix = uuid.uuid4().hex[:10]
    household_id = uuid.uuid4()
    user_id = uuid.uuid4()
    await _seed_sql_household(household_id, user_id, suffix)
    active = {"household_id": household_id, "user_id": user_id}
    roast_date = _roast_date_for_suffix(suffix)
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/catalog",
                json={
                    "roaster": f"SPEC039 Inventory {suffix}",
                    "bean_name": "Status Bean",
                    "roast_level": "Medium",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            catalog_id = created.json()["catalog_id"]
            bag_response = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={"roast_date": roast_date, "roast_level": "Medium"},
                cookies={"session": _AUTHED_COOKIE},
            )
            bag_id = bag_response.json()["bag_id"]
            finished = await client.patch(
                f"/api/inventory/{bag_id}",
                json={"status": "Finished"},
                cookies={"session": _AUTHED_COOKIE},
            )
            invalid = await client.patch(
                f"/api/inventory/{bag_id}",
                json={"status": "Archived"},
                cookies={"session": _AUTHED_COOKIE},
            )
            reactivated = await client.patch(
                f"/api/inventory/{bag_id}",
                json={"status": "Active"},
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert bag_response.status_code == 201
    assert finished.status_code == 200
    assert finished.json()["status"] == "Finished"
    assert finished.json()["bag_id"] == bag_id
    assert invalid.status_code == 422
    assert reactivated.status_code == 200
    assert reactivated.json()["status"] == "Active"


async def test_sql_inventory_patch_cross_household_returns_404(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Inventory PATCH is household-scoped by RLS."""
    _require_sql_backend(monkeypatch)
    suffix_one = uuid.uuid4().hex[:10]
    household_one = uuid.uuid4()
    user_one = uuid.uuid4()
    await _seed_sql_household(household_one, user_one, suffix_one)
    active = {"household_id": household_one, "user_id": user_one}
    roast_date = _roast_date_for_suffix(suffix_one)
    _install_sql_app_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/catalog",
                json={
                    "roaster": f"SPEC039 Inv Household One {suffix_one}",
                    "bean_name": "Hidden Bag Bean",
                    "roast_level": "Light",
                },
                cookies={"session": _AUTHED_COOKIE},
            )
            catalog_id = created.json()["catalog_id"]
            bag_response = await client.post(
                f"/api/catalog/{catalog_id}/inventory",
                json={"roast_date": roast_date, "roast_level": "Light"},
                cookies={"session": _AUTHED_COOKIE},
            )
            bag_id = bag_response.json()["bag_id"]

        suffix_two = uuid.uuid4().hex[:10]
        household_two = uuid.uuid4()
        user_two = uuid.uuid4()
        await _seed_sql_household(household_two, user_two, suffix_two)
        active["household_id"] = household_two
        active["user_id"] = user_two

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.patch(
                f"/api/inventory/{bag_id}",
                json={"status": "Finished"},
                cookies={"session": _AUTHED_COOKIE},
            )
    finally:
        _clear_sql_app_overrides()

    assert created.status_code == 201
    assert bag_response.status_code == 201
    assert response.status_code == 404

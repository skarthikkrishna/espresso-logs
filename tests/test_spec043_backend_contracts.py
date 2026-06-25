"""Spec-043 backend contract tests for form/wizard API dependencies."""

from __future__ import annotations

import base64
import io
import json
import os
import uuid
from collections.abc import AsyncGenerator, Callable
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
import sqlalchemy as sa
from fastapi import Depends, HTTPException
from httpx import ASGITransport, AsyncClient
from itsdangerous import TimestampSigner
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.datastructures import Headers, UploadFile

from app.deps import (
    current_household_membership,
    get_sheets_client,
    resolve_guest_or_member,
)
from app.main import app
from app.models.api import BrewLogEntryOut
from app.models.base import get_db
from app.models.household import HouseholdMember
from app.routers.api_brew_log import _BrewLogCreateBody
from app.routers.api_catalog import api_catalog_upload_image
from app.routers.api_hardware import (
    _HardwareUpdateBody,
    api_hardware_update,
    api_hardware_upload_image,
)
from app.routers.api_inventory import _BagPatchBody, api_inventory_patch
from app.routers.api_inventory import router as _inventory_router
from app.repos.base import get_process_cache
from tests.doubles import FakeSheetsClient


_TEST_SECRET = "dev-insecure-secret-for-testing-only"
_TEST_USER = {"email": "tester@example.com", "name": "Tester", "picture": ""}
_AUTHED_COOKIE = (
    TimestampSigner(_TEST_SECRET)
    .sign(base64.b64encode(json.dumps({"user": _TEST_USER}).encode("utf-8")))
    .decode("utf-8")
)
_SQL_SCHEMA_READY = False
_SQL_ENGINE = None

_PREFILL_IDS = {
    "bag_id": "BAG-SPEC043-01",
    "machine_id": "HW-SPEC043-MACHINE",
    "grinder_id": "HW-SPEC043-GRINDER",
    "basket_id": "HW-SPEC043-BASKET",
}

_CATALOG_ROW = {
    "Catalog_ID": "CAT-SPEC043-01",
    "Roaster": "Spec Roaster",
    "Bean_Name": "Spec Bean",
    "Roast_Level": "Medium",
    "Product_URL": "",
    "Local_Image_Path": "",
}
_INVENTORY_ROW = {
    "Bag_ID": _PREFILL_IDS["bag_id"],
    "Beans": "Spec Roaster — Spec Bean",
    "RoastDate": "2026-06-01",
    "RoastLevel": "Medium",
    "Display_Name": "Spec Roaster — Spec Bean",
    "Catalog_ID": _CATALOG_ROW["Catalog_ID"],
    "Status": "Active",
    "Storage_Method": "Ambient",
}
_HARDWARE_ROWS = [
    {
        "Hardware_ID": _PREFILL_IDS["machine_id"],
        "Category": "Machine",
        "Name": "Spec Machine",
        "Maker": "Spec Maker",
        "Purchase_Date": "",
        "Notes": "",
        "Product_URL": "",
        "Local_Image_Path": "",
    },
    {
        "Hardware_ID": _PREFILL_IDS["grinder_id"],
        "Category": "Grinder",
        "Name": "Spec Grinder",
        "Maker": "Spec Maker",
        "Purchase_Date": "",
        "Notes": "",
        "Product_URL": "",
        "Local_Image_Path": "",
    },
    {
        "Hardware_ID": _PREFILL_IDS["basket_id"],
        "Category": "Basket",
        "Name": "Spec Basket",
        "Maker": "Spec Maker",
        "Purchase_Date": "",
        "Notes": "",
        "Product_URL": "",
        "Local_Image_Path": "",
    },
]
_BREW_ROW = {
    "Shot_ID": "SHOT-SPEC043-01",
    "Date": "2026-06-24",
    "Bag_ID": _PREFILL_IDS["bag_id"],
    "Machine_ID": _PREFILL_IDS["machine_id"],
    "Grinder_ID": _PREFILL_IDS["grinder_id"],
    "Basket_ID": _PREFILL_IDS["basket_id"],
    "Dose_In_g": "18.0",
    "Yield_Out_g": "36.0",
    "Time_Sec": "28",
    "Grind_Setting": "12",
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet",
    "User_Notes": "",
    "AI_Feedback": "",
    "Storage_Method": "Ambient",
}
_POST_BODY = {
    "bag_id": _PREFILL_IDS["bag_id"],
    "machine_id": _PREFILL_IDS["machine_id"],
    "grinder_id": _PREFILL_IDS["grinder_id"],
    "basket_id": _PREFILL_IDS["basket_id"],
    "dose_in_g": 18.0,
    "yield_out_g": 36.0,
    "time_sec": 28.0,
    "grind_setting": "12",
    "shot_eligibility": "Good Espresso",
    "taste_summary": "Sweet",
    "user_notes": "",
    "storage_method": "Ambient",
    "shot_date": "2026-06-24",
}


def _fake_client(*, brew_rows: list[dict[str, Any]] | None = None) -> FakeSheetsClient:
    return FakeSheetsClient(
        {
            "Catalog": [_CATALOG_ROW.copy()],
            "Inventory": [_INVENTORY_ROW.copy()],
            "Hardware": [row.copy() for row in _HARDWARE_ROWS],
            "Brew_Log": [row.copy() for row in (brew_rows or [_BREW_ROW])],
            "Maintenance": [],
        }
    )


def _install_fake_sheets(fake: FakeSheetsClient) -> None:
    app.dependency_overrides[get_sheets_client] = lambda: fake
    get_process_cache()._store.clear()


def _clear_overrides() -> None:
    app.dependency_overrides.pop(get_sheets_client, None)
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(current_household_membership, None)
    app.dependency_overrides.pop(resolve_guest_or_member, None)
    get_process_cache()._store.clear()


def _require_sql_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — skipping SQL-backed household isolation test")
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


async def _seed_sql_household(
    household_id: uuid.UUID, user_id: uuid.UUID, suffix: str
) -> dict[str, str]:
    ids = {
        "catalog_id": f"CAT043{suffix}",
        "bag_id": f"BAG043{suffix}",
        "machine_id": f"HW043M{suffix}",
        "grinder_id": f"HW043G{suffix}",
        "basket_id": f"HW043B{suffix}",
        "shot_id": f"SHOT043{suffix}",
    }
    async with _sessionmaker()() as session:
        await session.execute(
            sa.text(
                """
                INSERT INTO users (id, username, password_hash, display_name)
                VALUES (:uid, :username, 'fixture-only', :display_name)
                ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
                """
            ),
            {"uid": user_id, "username": f"spec043-{suffix}", "display_name": f"Spec043 {suffix}"},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO households (id, name, created_by)
                VALUES (:hid, :name, :uid)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {"hid": household_id, "name": f"Spec043 Household {suffix}", "uid": user_id},
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO household_members (household_id, user_id, role)
                VALUES (:hid, :uid, 'admin')
                ON CONFLICT (household_id, user_id) DO UPDATE SET role = EXCLUDED.role
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
                VALUES (:hid, :catalog_id, :roaster, :bean_name, 'Medium')
                """
            ),
            {
                "hid": household_id,
                "catalog_id": ids["catalog_id"],
                "roaster": f"SQL Roaster {suffix}",
                "bean_name": f"SQL Bean {suffix}",
            },
        )
        await session.execute(
            sa.text(
                """
                INSERT INTO inventory_bags (
                    household_id, sheets_id, sheets_catalog_id, beans, display_name,
                    roast_level, status, storage_method
                )
                VALUES (:hid, :bag_id, :catalog_id, :beans, :display_name, 'Medium', 'Active', 'Ambient')
                """
            ),
            {
                "hid": household_id,
                "bag_id": ids["bag_id"],
                "catalog_id": ids["catalog_id"],
                "beans": f"SQL Roaster {suffix} — SQL Bean {suffix}",
                "display_name": f"SQL Roaster {suffix} — SQL Bean {suffix}",
            },
        )
        for key, category in (
            ("machine_id", "Machine"),
            ("grinder_id", "Grinder"),
            ("basket_id", "Basket"),
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
                    "hardware_id": ids[key],
                    "category": category,
                    "name": f"SQL {category} {suffix}",
                },
            )
        await session.execute(
            sa.text(
                """
                INSERT INTO brew_log (
                    household_id, sheets_id, brewed_at, bag_id, machine_id, grinder_id, basket_id,
                    dose_g, yield_g, time_sec, grind_setting, shot_eligibility, taste_summary,
                    notes, storage_method
                )
                VALUES (
                    :hid, :shot_id, '2026-06-24T12:00:00Z', :bag_id, :machine_id,
                    :grinder_id, :basket_id, 18.0, 36.0, 28, 12.0, 'Good Espresso',
                    :taste_summary, :notes, 'Ambient'
                )
                """
            ),
            {
                "hid": household_id,
                "shot_id": ids["shot_id"],
                "bag_id": ids["bag_id"],
                "machine_id": ids["machine_id"],
                "grinder_id": ids["grinder_id"],
                "basket_id": ids["basket_id"],
                "taste_summary": f"sweet {suffix}",
                "notes": f"notes {suffix}",
            },
        )
        await session.commit()
    return ids


def _install_sql_overrides(active: dict[str, uuid.UUID]) -> None:
    _install_fake_sheets(_fake_client(brew_rows=[]))

    async def _sql_db() -> AsyncGenerator[AsyncSession, None]:
        async with _sessionmaker()() as session:
            yield session

    async def _membership(db: AsyncSession = Depends(get_db)) -> HouseholdMember:
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
    app.dependency_overrides[current_household_membership] = _membership
    app.dependency_overrides[resolve_guest_or_member] = _membership


async def test_brew_log_response_model_and_routes_expose_prefill_ids() -> None:
    """List/detail models carry route-key IDs so log-similar can prefill without scraping text."""
    schema_fields = set(BrewLogEntryOut.model_fields)
    assert {"bag_id", "machine_id", "grinder_id", "basket_id"}.issubset(schema_fields)

    fake = _fake_client()
    _install_fake_sheets(fake)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            client.cookies.set("session", _AUTHED_COOKIE)
            list_response = await client.get("/api/brew-log")
            detail_response = await client.get(f"/api/brew-log/{_BREW_ROW['Shot_ID']}")
    finally:
        _clear_overrides()

    assert list_response.status_code == 200, list_response.text
    assert detail_response.status_code == 200, detail_response.text
    list_item = list_response.json()["items"][0]
    detail_item = detail_response.json()
    for key, expected in _PREFILL_IDS.items():
        assert list_item[key] == expected
        assert detail_item[key] == expected


async def test_brew_log_post_idempotency_still_replays_original_response() -> None:
    """Adding ID fields must not regress POST /api/brew-log idempotent replay semantics."""
    from app.deps import get_idempotency_store

    fake = _fake_client(brew_rows=[])
    _install_fake_sheets(fake)
    get_idempotency_store().clear()
    body = {**_POST_BODY, "idempotency_key": "spec043-idempotency-key"}
    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="ok")):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                first = await client.post("/api/brew-log", json=body)
                second = await client.post("/api/brew-log", json=body)
    finally:
        get_idempotency_store().clear()
        _clear_overrides()

    assert first.status_code == 201, first.text
    assert second.status_code == 200, second.text
    assert second.json()["shot_id"] == first.json()["shot_id"]
    for key, expected in _PREFILL_IDS.items():
        assert second.json()[key] == expected


async def test_brew_log_create_body_rejects_client_supplied_household_id() -> None:
    """Tenant ownership must come from auth context, never from POST body input."""
    fake = _fake_client(brew_rows=[])
    _install_fake_sheets(fake)
    try:
        with patch("app.routers.api_brew_log.get_ai_feedback", AsyncMock(return_value="ok")):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                client.cookies.set("session", _AUTHED_COOKIE)
                response = await client.post(
                    "/api/brew-log",
                    json={**_POST_BODY, "household_id": str(uuid.uuid4())},
                )
    finally:
        _clear_overrides()

    assert response.status_code == 422, response.text


def test_brew_log_create_body_model_forbids_household_id() -> None:
    """Direct model validation must reject tenant fields before route code runs."""
    with pytest.raises(ValidationError):
        _BrewLogCreateBody(**{**_POST_BODY, "household_id": str(uuid.uuid4())})


async def test_sql_brew_log_list_and_detail_are_household_scoped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A household must see only its own shots and prefill IDs in list/detail responses."""
    _require_sql_backend(monkeypatch)
    household_one = uuid.uuid4()
    user_one = uuid.uuid4()
    ids_one = await _seed_sql_household(household_one, user_one, uuid.uuid4().hex[:8])
    household_two = uuid.uuid4()
    user_two = uuid.uuid4()
    ids_two = await _seed_sql_household(household_two, user_two, uuid.uuid4().hex[:8])
    active = {"household_id": household_one, "user_id": user_one}
    _install_sql_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            list_one = await client.get("/api/brew-log")
            detail_one = await client.get(f"/api/brew-log/{ids_one['shot_id']}")
            leaked_detail = await client.get(f"/api/brew-log/{ids_two['shot_id']}")

            active["household_id"] = household_two
            active["user_id"] = user_two
            list_two = await client.get("/api/brew-log")
    finally:
        _clear_overrides()

    assert list_one.status_code == 200, list_one.text
    assert detail_one.status_code == 200, detail_one.text
    assert leaked_detail.status_code == 404, leaked_detail.text
    assert list_two.status_code == 200, list_two.text

    items_one = list_one.json()["items"]
    items_two = list_two.json()["items"]
    assert {item["shot_id"] for item in items_one} == {ids_one["shot_id"]}
    assert {item["shot_id"] for item in items_two} == {ids_two["shot_id"]}
    for key in ("bag_id", "machine_id", "grinder_id", "basket_id"):
        assert detail_one.json()[key] == ids_one[key]
        assert items_one[0][key] == ids_one[key]
        assert ids_two[key] not in {detail_one.json()[key], items_one[0][key]}


async def test_sql_defaults_endpoint_includes_time_sec_and_is_household_scoped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Defaults must include extraction time without leaking another household's bag."""
    _require_sql_backend(monkeypatch)
    household_one = uuid.uuid4()
    user_one = uuid.uuid4()
    ids_one = await _seed_sql_household(household_one, user_one, uuid.uuid4().hex[:8])
    household_two = uuid.uuid4()
    user_two = uuid.uuid4()
    ids_two = await _seed_sql_household(household_two, user_two, uuid.uuid4().hex[:8])
    active = {"household_id": household_one, "user_id": user_one}
    _install_sql_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            own_defaults = await client.get(f"/api/defaults/{ids_one['bag_id']}")
            leaked_defaults = await client.get(f"/api/defaults/{ids_two['bag_id']}")

            active["household_id"] = household_two
            active["user_id"] = user_two
            second_household_defaults = await client.get(f"/api/defaults/{ids_two['bag_id']}")
    finally:
        _clear_overrides()

    assert own_defaults.status_code == 200, own_defaults.text
    assert leaked_defaults.status_code == 200, leaked_defaults.text
    assert second_household_defaults.status_code == 200, second_household_defaults.text

    own_body = own_defaults.json()
    leaked_body = leaked_defaults.json()
    second_body = second_household_defaults.json()

    assert own_body["machine_id"] == ids_one["machine_id"]
    assert own_body["time_sec"] == "28"
    assert leaked_body["machine_id"] is None
    assert leaked_body["time_sec"] is None
    assert ids_two["machine_id"] not in {own_body["machine_id"], leaked_body["machine_id"]}
    assert second_body["machine_id"] == ids_two["machine_id"]
    assert second_body["time_sec"] == "28"


async def test_hardware_update_parity_covers_all_six_displayed_fields() -> None:
    """The edit endpoint must persist every field already displayed by hardware detail."""
    existing = {
        "Hardware_ID": "HW-PARITY",
        "Name": "Old Machine",
        "Category": "Machine",
        "Maker": "Old Maker",
        "Product_URL": "https://example.test/old",
        "Purchase_Date": "2025-01-01",
        "Notes": "old notes",
        "Local_Image_Path": "/static/hardware/old.jpg",
    }
    repo = AsyncMock()
    repo.get.return_value = existing
    body = _HardwareUpdateBody(
        name="New Machine",
        category="Grinder",
        maker="New Maker",
        product_url="https://example.test/new",
        purchase_date="2026-06-24",
        notes="new notes",
    )

    result = await api_hardware_update("HW-PARITY", body=body, _=object(), hardware_repo=repo)

    repo.upsert.assert_awaited_once()
    updated = repo.upsert.await_args.args[0]
    assert updated == {
        **existing,
        "Name": "New Machine",
        "Category": "Grinder",
        "Maker": "New Maker",
        "Product_URL": "https://example.test/new",
        "Purchase_Date": "2026-06-24",
        "Notes": "new notes",
    }
    assert result.model_dump() == {
        "hardware_id": "HW-PARITY",
        "name": "New Machine",
        "category": "Grinder",
        "maker": "New Maker",
        "product_url": "https://example.test/new",
        "purchase_date": "2026-06-24",
        "notes": "new notes",
        "image_path": "/static/hardware/old.jpg",
    }


async def test_inventory_patch_validation_preserves_roast_contract_without_cleanup() -> None:
    """Bag edits validate current fields without deriving/syncing roast ownership from catalog."""
    bag = {
        "Bag_ID": "BAG-PATCH",
        "Beans": "Original Beans",
        "RoastDate": "2026-06-01",
        "RoastLevel": "Medium",
        "Display_Name": "Original Display",
        "Catalog_ID": "CAT-PATCH",
        "Status": "Active",
        "Storage_Method": "Ambient",
    }
    inventory_repo = AsyncMock()
    inventory_repo.get.return_value = bag
    catalog_repo = AsyncMock()
    catalog_repo.get.return_value = {
        "Catalog_ID": "CAT-PATCH",
        "Roaster": "Patch Roaster",
        "Bean_Name": "Patch Bean",
        "Roast_Level": "Medium",
    }

    updated = await api_inventory_patch(
        "BAG-PATCH",
        body=_BagPatchBody(
            beans="Updated Beans",
            roast_date="2026-06-02",
            roast_level="Medium",
            status="Finished",
            storage_method="Freezer",
        ),
        _=object(),
        inventory_repo=inventory_repo,
        catalog_repo=catalog_repo,
    )

    inventory_repo.upsert.assert_awaited_once()
    assert inventory_repo.upsert.await_args.args[0] == {
        **bag,
        "Beans": "Updated Beans",
        "RoastDate": "2026-06-02",
        "RoastLevel": "Medium",
        "Status": "Finished",
        "Storage_Method": "Freezer",
    }
    assert updated.status == "Finished"
    assert updated.roast_level == "Medium"

    with pytest.raises(HTTPException, match="status must be one of"):
        await api_inventory_patch(
            "BAG-PATCH",
            body=_BagPatchBody(status="Archived"),
            _=object(),
            inventory_repo=inventory_repo,
            catalog_repo=catalog_repo,
        )
    with pytest.raises(HTTPException, match="match catalog roast level"):
        await api_inventory_patch(
            "BAG-PATCH",
            body=_BagPatchBody(roast_level="Dark"),
            _=object(),
            inventory_repo=inventory_repo,
            catalog_repo=catalog_repo,
        )

    catalog_repo.get.return_value = {
        "Catalog_ID": "CAT-PATCH",
        "Roaster": "Patch Roaster",
        "Bean_Name": "Patch Bean",
        "Roast_Level": "",
    }
    selectable = await api_inventory_patch(
        "BAG-PATCH",
        body=_BagPatchBody(roast_level="Dark"),
        _=object(),
        inventory_repo=inventory_repo,
        catalog_repo=catalog_repo,
    )
    assert selectable.roast_level == "Dark"


def test_inventory_patch_body_rejects_household_id() -> None:
    """Bag edit ownership must remain route/auth-scoped and not body-scoped."""
    with pytest.raises(ValidationError):
        _BagPatchBody(status="Finished", household_id=str(uuid.uuid4()))


async def test_sql_inventory_patch_is_household_scoped(monkeypatch: pytest.MonkeyPatch) -> None:
    """A bag status/edit request for another household must resolve as missing."""
    _require_sql_backend(monkeypatch)
    household_one = uuid.uuid4()
    user_one = uuid.uuid4()
    ids_one = await _seed_sql_household(household_one, user_one, uuid.uuid4().hex[:8])
    household_two = uuid.uuid4()
    user_two = uuid.uuid4()
    await _seed_sql_household(household_two, user_two, uuid.uuid4().hex[:8])
    active = {"household_id": household_two, "user_id": user_two}
    _install_sql_overrides(active)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.patch(
                f"/api/inventory/{ids_one['bag_id']}",
                json={"status": "Finished"},
            )
    finally:
        _clear_overrides()

    assert response.status_code == 404, response.text


_UPLOAD_CASES: tuple[tuple[str, bytes, str, str], ...] = (
    ("jpg", b"\xff\xd8\xffpayload", "image/jpeg", "jpg"),
    ("png", b"\x89PNG\r\n\x1a\npayload", "image/png", "png"),
    ("webp", b"RIFF1234WEBPpayload", "image/webp", "webp"),
)


@pytest.mark.parametrize("ext,img_bytes,content_type,expected_ext", _UPLOAD_CASES)
async def test_catalog_upload_accepts_jpeg_png_webp_by_signature(
    ext: str,
    img_bytes: bytes,
    content_type: str,
    expected_ext: str,
) -> None:
    """Catalog media upload accepts only the supported image types after byte sniffing."""
    file = UploadFile(
        filename=f"bag.{ext}",
        file=io.BytesIO(img_bytes),
        headers=Headers({"content-type": content_type}),
    )
    catalog_repo = AsyncMock()
    catalog_repo.get.return_value = {"Catalog_ID": "CAT-UPLOAD", "Local_Image_Path": ""}

    with patch(
        "app.routers.api_catalog.upload_image",
        AsyncMock(return_value=f"/static/catalog/CAT-UPLOAD.{expected_ext}"),
    ) as mock_upload:
        response = await api_catalog_upload_image(
            "CAT-UPLOAD", _=object(), file=file, catalog_repo=catalog_repo
        )

    assert json.loads(response.body) == {"image_path": f"/static/catalog/CAT-UPLOAD.{expected_ext}"}
    mock_upload.assert_awaited_once()
    assert mock_upload.await_args.args[0] == img_bytes
    assert mock_upload.await_args.args[1] == content_type
    assert mock_upload.await_args.args[2].startswith("bean-images/CAT-UPLOAD-")
    assert mock_upload.await_args.args[2].endswith(f".{expected_ext}")


@pytest.mark.parametrize("ext,img_bytes,content_type,expected_ext", _UPLOAD_CASES)
async def test_hardware_upload_accepts_jpeg_png_webp_by_signature(
    ext: str,
    img_bytes: bytes,
    content_type: str,
    expected_ext: str,
) -> None:
    """Hardware media upload enforces the same accepted image contract as catalog."""
    file = UploadFile(
        filename=f"hardware.{ext}",
        file=io.BytesIO(img_bytes),
        headers=Headers({"content-type": content_type}),
    )
    hardware_repo = AsyncMock()
    hardware_repo.get.return_value = {"Hardware_ID": "HW-UPLOAD", "Local_Image_Path": ""}

    with patch(
        "app.routers.api_hardware.upload_image",
        AsyncMock(return_value=f"/static/hardware/HW-UPLOAD.{expected_ext}"),
    ) as mock_upload:
        response = await api_hardware_upload_image(
            "HW-UPLOAD",
            _=object(),
            file=file,
            hardware_repo=hardware_repo,
        )

    assert response.image_path == f"/static/hardware/HW-UPLOAD.{expected_ext}"
    mock_upload.assert_awaited_once()
    assert mock_upload.await_args.args[0] == img_bytes
    assert mock_upload.await_args.args[1] == content_type
    assert mock_upload.await_args.args[2].startswith("hardware-images/HW-UPLOAD-")
    assert mock_upload.await_args.args[2].endswith(f".{expected_ext}")


@pytest.mark.parametrize(
    "endpoint,patch_target,repo_factory,expected_missing",
    (
        (
            api_catalog_upload_image,
            "app.routers.api_catalog.upload_image",
            lambda: AsyncMock(),
            "Catalog entry not found",
        ),
        (
            api_hardware_upload_image,
            "app.routers.api_hardware.upload_image",
            lambda: AsyncMock(),
            "Hardware item not found",
        ),
    ),
)
async def test_upload_constraints_reject_empty_oversize_mismatch_and_missing_entity(
    endpoint: Callable[..., Any],
    patch_target: str,
    repo_factory: Callable[[], AsyncMock],
    expected_missing: str,
) -> None:
    """Server-side upload security must not rely on filename or client-side hints."""
    repo = repo_factory()
    repo.get.return_value = {"Local_Image_Path": ""}

    async def _call(img_bytes: bytes, content_type: str) -> None:
        file = UploadFile(
            filename="upload.bin",
            file=io.BytesIO(img_bytes),
            headers=Headers({"content-type": content_type}),
        )
        kwargs = {"_": object(), "file": file}
        if endpoint is api_catalog_upload_image:
            kwargs["catalog_repo"] = repo
        else:
            kwargs["hardware_repo"] = repo
        await endpoint("ENTITY-UPLOAD", **kwargs)

    with patch(patch_target, AsyncMock()) as mock_upload:
        with pytest.raises(HTTPException) as empty_error:
            await _call(b"", "image/png")
        assert empty_error.value.status_code == 422
        assert "must not be empty" in str(empty_error.value.detail)

        with pytest.raises(HTTPException) as oversize_error:
            await _call(b"\x89PNG\r\n\x1a\n" + (b"x" * 2_097_145), "image/png")
        assert oversize_error.value.status_code == 413
        assert "2 MB" in str(oversize_error.value.detail)

        with pytest.raises(HTTPException) as mismatch_error:
            await _call(b"not actually a png", "image/png")
        assert mismatch_error.value.status_code == 422
        assert "does not match" in str(mismatch_error.value.detail)

        repo.get.return_value = None
        with pytest.raises(HTTPException) as missing_error:
            await _call(b"\xff\xd8\xff", "image/jpeg")
        assert missing_error.value.status_code == 404
        assert missing_error.value.detail == expected_missing

    mock_upload.assert_not_awaited()


def test_spec043_introduced_no_schema_or_roast_ownership_migration() -> None:
    """Spec-043 is API/UI parity only; Alembic schema ownership stays frozen."""
    expected_versions = {
        "0001_initial_schema",
        "0002_add_household_id_columns",
        "0003_make_entity_household_id_nullable",
        "0004_add_sheets_identity_and_v2_columns",
        "0005_add_sheets_hardware_id_to_maintenance",
        "0006_add_sheets_catalog_id_to_inventory_bags",
        "0007_m5_schema_corrections",
        "0008_invitation_status",
        "0009_household_soft_delete",
        "0010_import_sessions",
        "0011_household_member_invitation_timestamps",
        "0012_user_active_household",
        "0013_refresh_token_rotated_at",
        "0014_brew_log_idempotency_rls",
        "0015_spec040_link_token_contracts",
        "0016_add_hardware_maker",
    }
    version_dir = Path("alembic/versions")
    actual_versions = {path.stem for path in version_dir.glob("*.py") if path.name != "__init__.py"}

    assert actual_versions == expected_versions
    assert not any("roast" in version or "spec043" in version for version in actual_versions)
    assert _inventory_router is not None

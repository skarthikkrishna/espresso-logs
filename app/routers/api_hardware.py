"""JSON hardware endpoints.

Deployment prerequisite: The live Google Sheet's Hardware tab must have
``Maker`` (column D), ``Product_URL`` (column E), and ``Local_Image_Path``
(column F) added to the header row **before** this code is deployed to production. Without these
columns gspread will silently drop those fields from any upsert() call.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, List
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.deps import (
    _DualWriteHardwareRepo,
    _DualWriteMaintenanceRepo,
    current_household_membership,
    get_hardware_repo,
    get_llm_client,
    get_maintenance_repo,
)
from app.models.api import (
    HardwareDetailOut,
    HardwareImageUploadOut,
    HardwareItemOut,
    MaintenanceEventOut,
)
from app.models.household import HouseholdMember
from app.services.image_sourcer import fetch_image_bytes, fetch_page_context, source_bean_image
from app.services.image_store import upload_image
from app.services.inference import LLMClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["hardware"])

_CATEGORIES = ["Machine", "Grinder", "Basket", "Storage"]
_ALLOWED_UPLOAD_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_UPLOAD_BYTES = 2_097_152
_JPEG_SIGNATURES = (b"\xff\xd8\xff",)
_PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
_WEBP_RIFF_SIGNATURE = b"RIFF"
_WEBP_FORMAT_SIGNATURE = b"WEBP"

_ACTION_TYPES_BY_CATEGORY = {
    "Machine": ["Backflush", "Descale", "Steam Wand Clean"],
    "Grinder": ["Re-zero"],
    "Basket": [],
    "Storage": [],  # Storage items have no maintenance action types (FR-014)
}


def _hw_to_out(row: dict[str, Any]) -> HardwareItemOut:
    return HardwareItemOut(
        hardware_id=row.get("Hardware_ID", ""),
        category=row.get("Category", ""),
        name=row.get("Name", ""),
        maker=row.get("Maker") or None,
        purchase_date=row.get("Purchase_Date") or None,
        notes=row.get("Notes") or None,
        product_url=row.get("Product_URL") or None,
        image_path=row.get("Local_Image_Path") or None,
    )


def _upload_bytes_match_content_type(img_bytes: bytes, content_type: str) -> bool:
    if content_type == "image/jpeg":
        return img_bytes.startswith(_JPEG_SIGNATURES)
    if content_type == "image/png":
        return img_bytes.startswith(_PNG_SIGNATURE)
    if content_type == "image/webp":
        return (
            len(img_bytes) >= 12
            and img_bytes.startswith(_WEBP_RIFF_SIGNATURE)
            and img_bytes[8:12] == _WEBP_FORMAT_SIGNATURE
        )
    return False


def _maint_to_out(row: dict[str, Any], hardware_name: str) -> MaintenanceEventOut:
    return MaintenanceEventOut(
        maintenance_id=row.get("Maintenance_ID", ""),
        hardware_id=row.get("Hardware_ID", ""),
        hardware_name=hardware_name,
        date=row.get("Date", ""),
        action_type=row.get("Action_Type", ""),
        notes=row.get("Notes") or None,
    )


# NOTE: action-types is registered BEFORE {hardware_id} to avoid path conflict
@router.get("/hardware/action-types")
async def api_hardware_action_types(
    _: HouseholdMember = Depends(current_household_membership),
) -> dict[str, Any]:
    return {"action_types": _ACTION_TYPES_BY_CATEGORY}


@router.get("/hardware", response_model=List[HardwareItemOut])
async def api_hardware_list(
    _: HouseholdMember = Depends(current_household_membership),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> list[HardwareItemOut]:
    return [_hw_to_out(row) for row in await hardware_repo.list()]


@router.get("/hardware/{hardware_id}", response_model=HardwareDetailOut)
async def api_hardware_detail(
    hardware_id: str,
    _: HouseholdMember = Depends(current_household_membership),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
    maintenance_repo: _DualWriteMaintenanceRepo = Depends(get_maintenance_repo),
) -> HardwareDetailOut:
    item = await hardware_repo.get(hardware_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Hardware item not found")

    hardware_name = item.get("Name", hardware_id)
    events = await maintenance_repo.list(hardware_id=hardware_id)
    events.sort(key=lambda e: e.get("Date", ""), reverse=True)

    return HardwareDetailOut(
        item=_hw_to_out(item),
        maintenance=[_maint_to_out(e, hardware_name) for e in events],
    )


class _HardwareCreateBody(BaseModel):
    category: str
    name: str
    maker: str | None = None
    product_url: str | None = None


@router.post("/hardware", response_model=HardwareItemOut, status_code=201)
async def api_hardware_create(
    body: _HardwareCreateBody,
    _: HouseholdMember = Depends(current_household_membership),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
    llm_client: LLMClient = Depends(get_llm_client),
) -> HardwareItemOut:
    if body.category not in _CATEGORIES:
        raise HTTPException(status_code=422, detail="Invalid category")
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Name is required")
    if body.product_url:
        scheme = urlparse(body.product_url.strip()).scheme
        if scheme not in ("http", "https"):
            raise HTTPException(status_code=422, detail="product_url must be http or https")

    hardware_id = hardware_repo.next_id(body.category)
    row: dict[str, Any] = {
        "Hardware_ID": hardware_id,
        "Category": body.category,
        "Name": body.name.strip(),
        "Maker": (body.maker or "").strip(),
        "Product_URL": (body.product_url or "").strip(),
        "Local_Image_Path": "",
    }
    await hardware_repo.upsert(row)

    # Auto-source and upload image from product URL (non-fatal — item is always created).
    if body.product_url:
        try:
            page_ctx = await fetch_page_context(body.product_url.strip())
            img_cdn_url = await source_bean_image(
                roaster="",
                bean_name=body.name.strip(),
                product_url=body.product_url.strip(),
                llm_client=llm_client,
                page_ctx=page_ctx,
            )
            if img_cdn_url:
                fetched = await fetch_image_bytes(img_cdn_url)
                if fetched:
                    img_bytes, content_type = fetched
                    ext = content_type.split("/")[-1].replace("jpeg", "jpg")
                    obj_name = f"hardware-images/{hardware_id}-{uuid.uuid4().hex[:8]}.{ext}"
                    image_path = await upload_image(
                        img_bytes, content_type, obj_name, settings.assets_bucket
                    )
                    await hardware_repo.upsert({**row, "Local_Image_Path": image_path})
                    row["Local_Image_Path"] = image_path
        except Exception as exc:  # noqa: BLE001
            logger.warning("image pipeline failed for hardware %r: %s", hardware_id, exc)

    return _hw_to_out(row)


class _HardwareUpdateBody(BaseModel):
    name: str
    category: str | None = None
    maker: str | None = None


@router.put("/hardware/{hardware_id}", response_model=HardwareItemOut)
async def api_hardware_update(
    hardware_id: str,
    body: _HardwareUpdateBody,
    _: HouseholdMember = Depends(current_household_membership),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> HardwareItemOut:
    item = await hardware_repo.get(hardware_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Hardware item not found")
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="Name is required")

    updated = dict(item)
    updated["Name"] = body.name.strip()
    if body.maker is not None:
        updated["Maker"] = body.maker.strip()
    if body.category and body.category in _CATEGORIES:
        updated["Category"] = body.category
    await hardware_repo.upsert(updated)
    return _hw_to_out(updated)


@router.post("/hardware/{hardware_id}/image", response_model=HardwareImageUploadOut)
async def api_hardware_upload_image(
    hardware_id: str,
    _: HouseholdMember = Depends(current_household_membership),
    file: UploadFile = File(...),
    hardware_repo: _DualWriteHardwareRepo = Depends(get_hardware_repo),
) -> HardwareImageUploadOut:
    item = await hardware_repo.get(hardware_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Hardware item not found")

    content_type = (file.content_type or "").split(";")[0].strip()
    if content_type not in _ALLOWED_UPLOAD_CONTENT_TYPES:
        raise HTTPException(status_code=422, detail="file must be a JPEG, PNG, or WebP image.")
    img_bytes = await file.read()
    if not img_bytes:
        raise HTTPException(status_code=422, detail="file must not be empty.")
    if len(img_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file must be 2 MB or smaller.")
    if not _upload_bytes_match_content_type(img_bytes, content_type):
        raise HTTPException(
            status_code=422,
            detail="file content does not match the declared image type.",
        )

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
    obj_name = f"hardware-images/{hardware_id}-{uuid.uuid4().hex[:8]}.{ext}"
    image_path = await upload_image(img_bytes, content_type, obj_name, settings.assets_bucket)
    fresh = await hardware_repo.get(hardware_id)
    if fresh is not None:
        await hardware_repo.upsert({**fresh, "Local_Image_Path": image_path})
    return HardwareImageUploadOut(image_path=image_path)

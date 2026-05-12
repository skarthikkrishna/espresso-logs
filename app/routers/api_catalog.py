"""JSON catalog endpoints."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date
from typing import Any, List
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import settings
from app.deps import (
    CurrentUser,
    get_brew_log_repo,
    get_catalog_repo,
    get_hardware_repo,
    get_inventory_repo,
    get_llm_client,
)
from app.services.inference import LLMClient
from app.models.api import BrewLogEntryOut, CatalogDetailOut, CatalogItemOut, InventoryBagOut
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.hardware import HardwareRepo
from app.repos.inventory import InventoryRepo
from app.services.ids import make_inventory_id
from app.services.image_sourcer import fetch_image_bytes, fetch_page_context, source_bean_image
from app.services.image_store import upload_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["catalog"])

_ROAST_LEVELS = ["Light", "Light / Medium", "Medium", "Medium / Dark", "Dark"]


def _next_catalog_id(existing: list[dict[str, Any]]) -> str:
    nums = []
    for row in existing:
        cid = row.get("Catalog_ID", "")
        if cid.startswith("CAT"):
            try:
                nums.append(int(cid[3:]))
            except ValueError:
                pass
    return f"CAT{(max(nums, default=99) + 1):03d}"


def _catalog_to_out(row: dict[str, Any]) -> CatalogItemOut:
    return CatalogItemOut(
        catalog_id=row.get("Catalog_ID", ""),
        roaster=row.get("Roaster", ""),
        bean_name=row.get("Bean_Name", ""),
        roast_level=row.get("Roast_Level", ""),
        product_url=row.get("Product_URL") or None,
        image_path=row.get("Local_Image_Path") or None,
    )


def _bag_to_out(row: dict[str, Any], display_name: str) -> InventoryBagOut:
    return InventoryBagOut(
        bag_id=row.get("Bag_ID", ""),
        display_name=display_name,
        beans=row.get("Beans", ""),
        roast_date=row.get("RoastDate") or None,
        roast_level=row.get("RoastLevel") or None,
        catalog_id=row.get("Catalog_ID", ""),
        status=row.get("Status", ""),
        storage_method=row.get("Storage_Method") or None,
    )


def _shot_to_out(
    shot: dict[str, Any],
    bag_display: str,
    roast_level: str | None,
    machine_name: str | None,
    grinder_name: str | None,
    basket_name: str | None,
) -> BrewLogEntryOut:
    def _float(v: object) -> float | None:
        try:
            return float(v)  # type: ignore[arg-type]
        except Exception:
            return None

    return BrewLogEntryOut(
        shot_id=shot.get("Shot_ID", ""),
        date=shot.get("Date", ""),
        bag_display=bag_display,
        roast_level=roast_level,
        machine_name=machine_name,
        grinder_name=grinder_name,
        basket_name=basket_name,
        storage_method=shot.get("Storage_Method") or None,
        dose_in_g=_float(shot.get("Dose_In_g")),
        yield_out_g=_float(shot.get("Yield_Out_g")),
        time_sec=_float(shot.get("Time_Sec")),
        grind_setting=str(shot["Grind_Setting"])
        if shot.get("Grind_Setting") not in (None, "")
        else None,
        shot_eligibility=shot.get("Shot_Eligibility") or None,
        taste_summary=shot.get("Taste_Summary") or None,
        user_notes=shot.get("User_Notes") or None,
        ai_feedback=shot.get("AI_Feedback") or None,
    )


@router.get("/catalog", response_model=List[CatalogItemOut])
async def api_catalog_list(
    user: CurrentUser,
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
) -> list[CatalogItemOut]:
    return [_catalog_to_out(row) for row in catalog_repo.list()]


@router.get("/catalog/{catalog_id}", response_model=CatalogDetailOut)
async def api_catalog_detail(
    catalog_id: str,
    user: CurrentUser,
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
    brew_log_repo: BrewLogRepo = Depends(get_brew_log_repo),
    hardware_repo: HardwareRepo = Depends(get_hardware_repo),
) -> CatalogDetailOut:
    entry = catalog_repo.get(catalog_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Catalog entry not found")

    display_name = f"{entry.get('Roaster', '')} — {entry.get('Bean_Name', '')}"
    all_bags = inventory_repo.list(status=None)
    linked_bags = [b for b in all_bags if b.get("Catalog_ID") == catalog_id]

    linked_shots: list[dict[str, Any]] = []
    for bag in linked_bags:
        linked_shots.extend(brew_log_repo.list_for_bag(bag["Bag_ID"]))
    linked_shots.sort(key=lambda s: s.get("Date", ""), reverse=True)
    linked_shots = linked_shots[:10]

    hw_cache: dict[str, dict[str, Any] | None] = {}

    def _hw(hw_id: str | None) -> str | None:
        if not hw_id:
            return None
        if hw_id not in hw_cache:
            hw_cache[hw_id] = hardware_repo.get(hw_id)
        hw = hw_cache[hw_id]
        return hw.get("Name") if hw else None

    bag_out_list = [_bag_to_out(b, display_name) for b in linked_bags]
    shot_out_list = [
        _shot_to_out(
            s,
            display_name,
            None,
            _hw(s.get("Machine_ID")),
            _hw(s.get("Grinder_ID")),
            _hw(s.get("Basket_ID")),
        )
        for s in linked_shots
    ]

    return CatalogDetailOut(
        item=_catalog_to_out(entry),
        bags=bag_out_list,
        recent_shots=shot_out_list,
    )


class _CatalogCreateBody(BaseModel):
    roaster: str
    bean_name: str
    roast_level: str
    product_url: str | None = None
    # Pre-sourced CDN image URL returned by /catalog/infer — skips og:image re-fetch at create time.
    source_image_url: str | None = None


class _InferCatalogBody(BaseModel):
    url: str


class InferCatalogOut(BaseModel):
    roaster: str
    bean_name: str
    roast_level: str
    image_path: str | None


@router.post("/catalog", response_model=CatalogItemOut, status_code=201)
async def api_catalog_create(
    body: _CatalogCreateBody,
    user: CurrentUser,
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
    llm_client: LLMClient = Depends(get_llm_client),
) -> CatalogItemOut:
    errors: list[str] = []
    if not body.roaster.strip():
        errors.append("Roaster is required.")
    if not body.bean_name.strip():
        errors.append("Bean name is required.")
    if body.roast_level not in _ROAST_LEVELS:
        errors.append("Invalid roast level.")
    if body.product_url:
        scheme = urlparse(body.product_url.strip()).scheme
        if scheme not in {"http", "https"}:
            errors.append("Product URL must start with http:// or https://.")
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    existing = catalog_repo._fetch_all()
    catalog_id = _next_catalog_id(existing)
    row = {
        "Catalog_ID": catalog_id,
        "Roaster": body.roaster.strip(),
        "Bean_Name": body.bean_name.strip(),
        "Roast_Level": body.roast_level,
        "Product_URL": (body.product_url or "").strip(),
        "Local_Image_Path": "",
    }

    # Auto-source and upload image from product URL before writing to Sheets.
    # Use the pre-sourced URL from the infer step if available (avoids re-fetching og:image);
    # otherwise scrape og:image directly from product_url.
    img_cdn_url = (body.source_image_url or "").strip()
    if not img_cdn_url and body.product_url:
        try:
            img_cdn_url = await source_bean_image(
                body.roaster.strip(), body.bean_name.strip(), body.product_url.strip(), llm_client
            )
        except Exception as exc:
            logger.warning("source_bean_image failed for %r: %s", body.product_url, exc)

    if img_cdn_url:
        try:
            fetched = await fetch_image_bytes(img_cdn_url)
            if fetched:
                img_bytes, content_type = fetched
                if "png" in content_type:
                    ext = "png"
                elif "webp" in content_type:
                    ext = "webp"
                else:
                    ext = "jpg"
                obj_name = f"bean-images/{catalog_id}-{uuid.uuid4().hex[:8]}.{ext}"
                image_path = await upload_image(
                    img_bytes, content_type, obj_name, settings.assets_bucket
                )
                row["Local_Image_Path"] = image_path
        except Exception as exc:
            logger.warning("image upload failed for %r: %s", catalog_id, exc)

    # Single upsert — image path (if any) is already staged in row before writing.
    await catalog_repo.upsert(row)  # type: ignore[misc, func-returns-value]
    return _catalog_to_out(row)


class _CatalogUpdateBody(BaseModel):
    roaster: str
    bean_name: str
    roast_level: str
    product_url: str | None = None


@router.put("/catalog/{catalog_id}", response_model=CatalogItemOut)
async def api_catalog_update(
    catalog_id: str,
    body: _CatalogUpdateBody,
    user: CurrentUser,
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
) -> CatalogItemOut:
    """Update an editable catalog entry. Preserves Local_Image_Path; use the
    /image endpoint to change the image."""
    # Validation mirrors POST /api/catalog so both endpoints enforce the same
    # contract (e.g. whitespace-only product_url is rejected, not silently
    # stored as empty).
    errors: list[str] = []
    if not body.roaster.strip():
        errors.append("Roaster is required.")
    if not body.bean_name.strip():
        errors.append("Bean name is required.")
    if body.roast_level not in _ROAST_LEVELS:
        errors.append("Invalid roast level.")
    if body.product_url:
        scheme = urlparse(body.product_url.strip()).scheme
        if scheme not in {"http", "https"}:
            errors.append("Product URL must start with http:// or https://.")
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    # Re-read the current row from the sheet, bypassing the in-process cache,
    # so a concurrent /image upload (or another edit) is not silently
    # overwritten by a stale Local_Image_Path. This narrows but does not
    # fully eliminate the race window — the same caveat applies to the
    # existing /image endpoint upsert below.
    fresh_rows = catalog_repo._fetch_all()
    entry = next((r for r in fresh_rows if r.get("Catalog_ID") == catalog_id), None)
    if entry is None:
        raise HTTPException(status_code=404, detail="Catalog entry not found")

    updated = {
        **entry,
        "Catalog_ID": catalog_id,
        "Roaster": body.roaster.strip(),
        "Bean_Name": body.bean_name.strip(),
        "Roast_Level": body.roast_level,
        "Product_URL": (body.product_url or "").strip(),
    }
    await catalog_repo.upsert(updated)  # type: ignore[misc, func-returns-value]
    return _catalog_to_out(updated)


_EMPTY_INFER = InferCatalogOut(roaster="", bean_name="", roast_level="", image_path=None)


@router.post("/catalog/infer", response_model=InferCatalogOut, status_code=200)
async def api_catalog_infer(
    body: _InferCatalogBody,
    user: CurrentUser,
    llm_client: LLMClient = Depends(get_llm_client),
) -> InferCatalogOut:
    """Infer catalog fields from a product URL using page scrape + LLM.

    Always returns 200 — never raises 4xx/5xx for inference or scrape failures.

    Partial-success behavior: text fields (roaster, bean_name, roast_level) and
    image_path are resolved independently. A scrape or LLM failure for one does
    not suppress results from the other — e.g. if the LLM fails, image_path may
    still be populated from og:image, and vice versa.

    Strategy: fetch the product page once, extract og:image for the image and
    og:title/og:description/meta:description for LLM inference. The LLM receives
    actual page content (not just the URL slug), giving reliable roast-level inference.
    """
    if not body.url.strip():
        return _EMPTY_INFER

    # Fetch page once — extract both image and text context.
    page_ctx = await fetch_page_context(body.url.strip())

    # Build LLM prompt from real page text rather than URL slug alone.
    context_block = page_ctx.inference_text()
    if context_block:
        prompt = (
            "You are a coffee product data extractor. Given the product page text below, "
            "return ONLY a JSON object with these exact keys: "
            "roaster (string), bean_name (string), roast_level (one of: "
            "Light, Light / Medium, Medium, Medium / Dark, Dark, or empty string if unclear). "
            "Return raw JSON only, no markdown, no explanation.\n\n"
            f"Product page text:\n{context_block}"
        )
    else:
        # Fallback: infer from URL slug when page fetch failed
        prompt = (
            f"Given this coffee product URL: {body.url}\n"
            "Return ONLY a JSON object with these exact keys: "
            "roaster (string), bean_name (string), roast_level (one of: "
            "Light, Light / Medium, Medium, Medium / Dark, Dark, or empty string). "
            "If you cannot determine a value, use an empty string. "
            "Return raw JSON only, no markdown."
        )

    roaster = bean_name = roast_level = ""
    try:
        raw = await llm_client.complete(prompt)
        text = raw.strip()
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
            text = text.rsplit("```", 1)[0].strip()
        data = json.loads(text)
        roast_level_raw = data.get("roast_level", "") or ""
        roaster = data.get("roaster", "") or ""
        bean_name = data.get("bean_name", "") or ""
        roast_level = roast_level_raw if roast_level_raw in _ROAST_LEVELS else ""
    except Exception as exc:
        logger.warning("catalog infer LLM failed for url=%r: %s", body.url, exc)

    # Source image — reuse the pre-fetched page context to skip a second HTTP call.
    image_path: str | None = None
    try:
        sourced = await source_bean_image(
            roaster, bean_name, body.url, llm_client, page_ctx=page_ctx
        )
        image_path = sourced or None
    except Exception as exc:
        logger.warning("catalog infer image source failed for url=%r: %s", body.url, exc)

    return InferCatalogOut(
        roaster=roaster,
        bean_name=bean_name,
        roast_level=roast_level,
        image_path=image_path,
    )


class _BagCreateBody(BaseModel):
    beans: str = ""
    roast_date: str
    roast_level: str
    storage_method: str | None = None


@router.post("/catalog/{catalog_id}/inventory", response_model=InventoryBagOut, status_code=201)
async def api_catalog_add_bag(
    catalog_id: str,
    body: _BagCreateBody,
    user: CurrentUser,
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
    inventory_repo: InventoryRepo = Depends(get_inventory_repo),
) -> InventoryBagOut:
    entry = catalog_repo.get(catalog_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Catalog entry not found")

    roaster = entry.get("Roaster", "")
    try:
        roast_date = date.fromisoformat(body.roast_date)
    except ValueError:
        raise HTTPException(status_code=422, detail="roast_date must be ISO format (YYYY-MM-DD)")

    existing_ids = [b["Bag_ID"] for b in inventory_repo.list(status=None)]
    bag_id = make_inventory_id(roaster, roast_date, body.roast_level, existing_ids)

    display_name = f"{roaster} — {entry.get('Bean_Name', '')}"
    row = {
        "Bag_ID": bag_id,
        "Beans": body.beans or display_name,
        "RoastDate": body.roast_date,
        "RoastLevel": body.roast_level,
        "Display_Name": display_name,
        "Catalog_ID": catalog_id,
        "Status": "Active",
        "Storage_Method": body.storage_method or "",
    }
    await inventory_repo.upsert(row)  # type: ignore[misc, func-returns-value]
    return _bag_to_out(row, display_name)


@router.post("/catalog/{catalog_id}/image")
async def api_catalog_upload_image(
    catalog_id: str,
    user: CurrentUser,
    file: UploadFile = File(...),
    catalog_repo: CatalogRepo = Depends(get_catalog_repo),
) -> JSONResponse:
    entry = catalog_repo.get(catalog_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Catalog entry not found")

    img_bytes = await file.read()
    content_type = (file.content_type or "image/jpeg").split(";")[0].strip()
    obj_name = f"bean-images/{catalog_id}-{uuid.uuid4().hex[:8]}.jpg"
    image_path = await upload_image(img_bytes, content_type, obj_name, settings.assets_bucket)
    fresh = catalog_repo.get(catalog_id)
    if fresh is not None:
        await catalog_repo.upsert({**fresh, "Local_Image_Path": image_path})  # type: ignore[misc, func-returns-value]
    return JSONResponse({"image_path": image_path})

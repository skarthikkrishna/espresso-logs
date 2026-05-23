"""Bootstrap Import Wizard router."""

from __future__ import annotations

import asyncio
import dataclasses
import datetime
import logging
import uuid
from pathlib import Path
from typing import Any

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import require_admin
from app.models.base import get_db
from app.models.household import HouseholdMember, ImportSession
from app.services.image_sourcer import fetch_image_bytes, source_bean_image
from app.services.importer import (
    CANONICAL_ENUM_VALUES,
    ImportState,
    migrate_grinder_calibration_row,
    normalize_brew_log_row,
    normalize_catalog_row,
    normalize_hardware_row,
    normalize_inventory_row,
)

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_admin)])

_IMPORT_SESSION_COOKIE = "import_session_id"
_IMPORT_FILE_PREFIX = "coffee_import_"
_IMPORT_TMP_DIR = Path(__file__).resolve().parents[2] / ".import-wizard-cache"


# Template-friendly sorted-list version of CANONICAL_ENUM_VALUES
CANONICAL_ENUM_VALUES_FOR_TEMPLATE: dict[str, list[str]] = {
    k: sorted(v) for k, v in CANONICAL_ENUM_VALUES.items()
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_dry_run(state: ImportState) -> dict[str, list[dict[str, Any]]]:
    """Normalize all rows; migrate Grinder_Calibration; return preview dict."""
    preview: dict[str, list[dict[str, Any]]] = {}
    normalize_map = {
        "Brew_Log": normalize_brew_log_row,
        "Catalog": normalize_catalog_row,
        "Hardware": normalize_hardware_row,
        "Inventory": normalize_inventory_row,
    }
    for section_name, rows in state.sections.items():
        if section_name == "Grinder_Calibration":
            continue
        norm_fn = normalize_map.get(section_name)
        if norm_fn is None:
            continue
        mapping = state.column_mappings.get(section_name, {})
        preview[section_name] = [norm_fn(row, mapping, state.confirmed_enum_maps) for row in rows]
    cal_rows = state.sections.get("Grinder_Calibration", [])
    if cal_rows:
        preview["Maintenance"] = [
            migrate_grinder_calibration_row(row, i + 1) for i, row in enumerate(cal_rows)
        ]
    return preview


async def _get_import_session(
    db: AsyncSession,
    request: Request,
    membership: HouseholdMember,
) -> ImportSession | None:
    """Return the active import session from the cookie when it is still valid."""
    import_session_id = request.cookies.get(_IMPORT_SESSION_COOKIE)
    if not import_session_id:
        return None
    try:
        session_id = uuid.UUID(import_session_id)
    except ValueError:
        return None
    result = await db.execute(
        sa.select(ImportSession).where(
            ImportSession.id == session_id,
            ImportSession.household_id == membership.household_id,
            ImportSession.created_by == membership.user_id,
            ImportSession.expires_at > sa.func.now(),
        )
    )
    return result.scalar_one_or_none()


async def _load_state(
    db: AsyncSession,
    request: Request,
    membership: HouseholdMember,
) -> ImportState | None:
    """Load ImportState from the DB-backed import session."""
    import_session = await _get_import_session(db, request, membership)
    if import_session is None:
        return None
    try:
        return ImportState(**import_session.state)
    except Exception:
        return None


async def _save_state(
    db: AsyncSession,
    import_session_id: uuid.UUID,
    state: ImportState,
) -> None:
    """Persist ImportState to the import_sessions table."""
    await db.execute(
        sa.update(ImportSession)
        .where(ImportSession.id == import_session_id)
        .values(state=dataclasses.asdict(state))
    )
    await db.flush()


async def _clear_state(db: AsyncSession, import_session_id: uuid.UUID) -> None:
    """Delete the DB-backed import session."""
    await db.execute(sa.delete(ImportSession).where(ImportSession.id == import_session_id))
    await db.flush()


async def _create_import_session(db: AsyncSession, membership: HouseholdMember) -> ImportSession:
    """Create a fresh DB-backed import wizard session."""
    import_session = ImportSession(
        household_id=membership.household_id,
        created_by=membership.user_id,
        state={},
        expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2),
    )
    db.add(import_session)
    await db.flush()
    await db.refresh(import_session)
    return import_session


def _has_fresh_local_image_path(row: dict[str, Any]) -> bool:
    """Return True only when Local_Image_Path already points to a usable remote image."""
    local_image_path = str(row.get("Local_Image_Path", "") or "").strip()
    return local_image_path.startswith(("http://", "https://"))


async def _enrich_catalog_images(
    catalog_rows: list[dict[str, Any]],
    llm_client: Any,
    import_id: str,
) -> list[dict[str, Any]]:
    """Source images for catalog rows and cache bytes in a project-local directory."""

    async def _enrich_one(row: dict[str, Any]) -> dict[str, Any]:
        if _has_fresh_local_image_path(row):
            return row
        roaster = row.get("Roaster", "")
        bean_name = row.get("Bean_Name", "")
        product_url = row.get("Product_URL", "")
        catalog_id = row.get("Catalog_ID", "")
        if not (roaster or bean_name):
            return row
        image_url = await source_bean_image(roaster, bean_name, product_url, llm_client)
        if image_url:
            result = await fetch_image_bytes(image_url)
            if result and catalog_id:
                img_bytes, content_type = result
                _IMPORT_TMP_DIR.mkdir(parents=True, exist_ok=True)
                bin_path = (
                    _IMPORT_TMP_DIR / f"{_IMPORT_FILE_PREFIX}{import_id}_img_{catalog_id}.bin"
                )
                bin_path.write_bytes(img_bytes)
                content_type_path = _IMPORT_TMP_DIR / (
                    f"{_IMPORT_FILE_PREFIX}{import_id}_img_{catalog_id}.ct"
                )
                content_type_path.write_text(content_type, encoding="utf-8")
        return row

    return list(await asyncio.gather(*[_enrich_one(row) for row in catalog_rows]))


@router.get("/import")
async def start_import_wizard(
    response: Response,
    membership: HouseholdMember = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Start the import wizard and issue a DB-backed session id."""
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    import_session = await _create_import_session(db, membership)
    await db.commit()
    response.set_cookie(
        _IMPORT_SESSION_COOKIE,
        str(import_session.id),
        httponly=True,
        samesite="lax",
        path="/import",
        max_age=7200,
    )
    return {"session_id": str(import_session.id)}

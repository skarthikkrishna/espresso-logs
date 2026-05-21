"""Bootstrap Import Wizard router."""

from __future__ import annotations

import asyncio
import dataclasses
import json
import logging
import tempfile
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, Request

from app.deps import current_household_membership
from app.services.image_sourcer import source_bean_image, fetch_image_bytes
from app.services.importer import (
    ImportState,
    CANONICAL_ENUM_VALUES,
    migrate_grinder_calibration_row,
    normalize_brew_log_row,
    normalize_catalog_row,
    normalize_hardware_row,
    normalize_inventory_row,
)

logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(current_household_membership)])


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


_IMPORT_TMP_DIR = Path(tempfile.gettempdir())
_IMPORT_FILE_PREFIX = "coffee_import_"


def _state_path(import_id: str) -> Path:
    return _IMPORT_TMP_DIR / f"{_IMPORT_FILE_PREFIX}{import_id}.json"


def _load_state(request: Request) -> ImportState | None:
    """Load ImportState from a /tmp file keyed by the session import_id.

    Browser cookie stores only the UUID (tiny); full state lives in /tmp.
    Returns None if the session has no import_id or the file is missing/corrupt
    (e.g. Cloud Run instance was replaced mid-wizard).
    """
    import_id = request.session.get("import_id")
    if not import_id:
        return None
    path = _state_path(import_id)
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return ImportState(**data)
    except Exception:
        return None


def _save_state(request: Request, state: ImportState) -> None:
    """Persist ImportState to /tmp; store the UUID key in the session cookie.

    The full state can be 10s of KB (raw rows + mappings) — far beyond the 4 KB
    browser cookie limit. Writing to /tmp avoids silent cookie truncation.
    """
    import_id = request.session.get("import_id")
    if not import_id:
        import_id = str(uuid.uuid4())
        request.session["import_id"] = import_id
    _state_path(import_id).write_text(json.dumps(dataclasses.asdict(state)), encoding="utf-8")


def _clear_state(request: Request) -> None:
    """Delete the /tmp state file and any image tmp files, then clear the session key."""
    import_id = request.session.pop("import_id", None)
    if import_id:
        try:
            _state_path(import_id).unlink(missing_ok=True)
        except Exception:  # nosec B110  # best-effort cleanup; silently skip unlink failures
            pass
        for f in _IMPORT_TMP_DIR.glob(f"{_IMPORT_FILE_PREFIX}{import_id}_img_*"):
            try:
                f.unlink(missing_ok=True)
            except Exception:  # nosec B110  # best-effort cleanup; silently skip unlink failures
                pass


def _has_fresh_local_image_path(row: dict[str, Any]) -> bool:
    """Return True only when Local_Image_Path already points to a usable remote image."""
    local_image_path = str(row.get("Local_Image_Path", "") or "").strip()
    return local_image_path.startswith(("http://", "https://"))


async def _enrich_catalog_images(
    catalog_rows: list[dict[str, Any]],
    llm_client: Any,
    import_id: str,
) -> list[dict[str, Any]]:
    """Source image for each catalog row; download bytes to /tmp.

    tmp path: /tmp/coffee_import_{import_id}_img_{catalog_id}.bin
    All rows are processed concurrently (asyncio.gather).
    """

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
                tmp_path = (
                    _IMPORT_TMP_DIR / f"{_IMPORT_FILE_PREFIX}{import_id}_img_{catalog_id}.bin"
                )
                tmp_path.write_bytes(img_bytes)
                ct_path = _IMPORT_TMP_DIR / f"{_IMPORT_FILE_PREFIX}{import_id}_img_{catalog_id}.ct"
                ct_path.write_text(content_type, encoding="utf-8")
        # Row gets empty Local_Image_Path; actual URL set at commit time from GCS
        return row  # leave Local_Image_Path unchanged (still "")

    return list(await asyncio.gather(*[_enrich_one(row) for row in catalog_rows]))

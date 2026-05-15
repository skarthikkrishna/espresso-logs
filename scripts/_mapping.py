"""Shared table definitions, from_sheets_dict mappers, checksum, and bulk_upsert.

Imported by both migrate_sheets_to_postgres.py and validate_migration.py.
"""

from __future__ import annotations

import datetime
import decimal
import hashlib
import uuid
from datetime import timezone
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine

# ---------------------------------------------------------------------------
# Enum sets
# ---------------------------------------------------------------------------

ROAST_LEVEL_ENUM: frozenset[str] = frozenset(
    {"Light", "Light / Medium", "Medium", "Medium / Dark", "Dark"}
)
INVENTORY_STATUS_ENUM: frozenset[str] = frozenset({"Active", "Finished"})
STORAGE_METHOD_ENUM: frozenset[str] = frozenset(
    {
        "Freezer", "Fridge", "Pantry", "Airtight Container", "Valve Bag", "Open Bag", "Mylar Bag",
        # Extended values found in production Sheets data
        "Frozen — Bag", "Frozen — Glass Tube", "Frozen — Knodos Glass Tube",
        "Ambient — Bag",
    }
)
HARDWARE_CATEGORY_ENUM: frozenset[str] = frozenset(
    {"Machine", "Grinder", "Basket", "Storage"}
)
MAINTENANCE_ACTION_ENUM: frozenset[str] = frozenset(
    {"Re-zero", "Backflush", "Descale", "Steam Wand Clean"}
)
SHOT_ELIGIBILITY_ENUM: frozenset[str] = frozenset(
    {"Reject", "Passable", "Good Espresso", "God Shot"}
)
TASTE_SUMMARY_ENUM: frozenset[str] = frozenset(
    {
        "Sour", "Bitter", "Balanced", "Fruity", "Nutty", "Chocolatey", "Floral",
        # Extended values found in production Sheets data
        "Weak & Sour", "Sweet & Balanced", "Salty / Channeled",
        "Harsh & Bitter", "Strong & Muddy",
    }
)

# ---------------------------------------------------------------------------
# Table definitions (SQLAlchemy Core — no ORM)
# ---------------------------------------------------------------------------

_metadata = sa.MetaData()

CATALOG_TABLE = sa.Table(
    "catalog",
    _metadata,
    sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    sa.Column("household_id", sa.UUID(), nullable=True),
    sa.Column("roaster", sa.Text(), nullable=False),
    sa.Column("bean_name", sa.Text(), nullable=False),
    sa.Column("origin", sa.Text(), nullable=True),
    sa.Column("process", sa.Text(), nullable=True),
    sa.Column("roast_level", sa.Text(), nullable=False),
    sa.Column("notes", sa.Text(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    # 0004 additions
    sa.Column("sheets_id", sa.Text(), nullable=True, unique=True),
    sa.Column("product_url", sa.Text(), nullable=True),
    sa.Column("local_image_path", sa.Text(), nullable=True),
)

INVENTORY_BAGS_TABLE = sa.Table(
    "inventory_bags",
    _metadata,
    sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    sa.Column("household_id", sa.UUID(), nullable=True),
    sa.Column("catalog_id", sa.UUID(), nullable=True),
    sa.Column("roast_date", sa.Date(), nullable=True),
    sa.Column("weight_g", sa.Numeric(), nullable=True),
    sa.Column("purchase_url", sa.Text(), nullable=True),
    sa.Column("notes", sa.Text(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    # 0004 additions
    sa.Column("sheets_id", sa.Text(), nullable=True, unique=True),
    sa.Column("beans", sa.Text(), nullable=True),
    sa.Column("display_name", sa.Text(), nullable=True),
    sa.Column("roast_level", sa.Text(), nullable=True),
    sa.Column("status", sa.Text(), nullable=True),
    sa.Column("storage_method", sa.Text(), nullable=True),
)

HARDWARE_TABLE = sa.Table(
    "hardware",
    _metadata,
    sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    sa.Column("household_id", sa.UUID(), nullable=True),
    sa.Column("name", sa.Text(), nullable=False),
    sa.Column("category", sa.Text(), nullable=False),
    sa.Column("purchase_date", sa.Date(), nullable=True),
    sa.Column("notes", sa.Text(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    # 0004 additions
    sa.Column("sheets_id", sa.Text(), nullable=True, unique=True),
    sa.Column("product_url", sa.Text(), nullable=True),
    sa.Column("local_image_path", sa.Text(), nullable=True),
)

MAINTENANCE_LOG_TABLE = sa.Table(
    "maintenance_log",
    _metadata,
    sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    sa.Column("household_id", sa.UUID(), nullable=True),
    sa.Column("hardware_id", sa.UUID(), nullable=True),
    sa.Column("action", sa.Text(), nullable=False),
    sa.Column("performed_at", sa.DateTime(timezone=True), nullable=False),
    sa.Column("notes", sa.Text(), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    # 0004 additions
    sa.Column("sheets_id", sa.Text(), nullable=True, unique=True),
)

BREW_LOG_TABLE = sa.Table(
    "brew_log",
    _metadata,
    sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
    sa.Column("household_id", sa.UUID(), nullable=True),
    sa.Column("catalog_id", sa.UUID(), nullable=True),
    sa.Column("brew_method", sa.Text(), nullable=True),
    sa.Column("dose_g", sa.Numeric(), nullable=True),
    sa.Column("yield_g", sa.Numeric(), nullable=True),
    sa.Column("time_sec", sa.Integer(), nullable=True),
    sa.Column("rating", sa.Integer(), nullable=True),
    sa.Column("notes", sa.Text(), nullable=True),
    sa.Column("brewed_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    # 0004 additions
    sa.Column("sheets_id", sa.Text(), nullable=True, unique=True),
    sa.Column("bag_id", sa.Text(), nullable=True),
    sa.Column("machine_id", sa.Text(), nullable=True),
    sa.Column("grinder_id", sa.Text(), nullable=True),
    sa.Column("basket_id", sa.Text(), nullable=True),
    sa.Column("grind_setting", sa.Numeric(precision=5, scale=1), nullable=True),
    sa.Column("shot_eligibility", sa.Text(), nullable=True),
    sa.Column("taste_summary", sa.Text(), nullable=True),
    sa.Column("ai_feedback", sa.Text(), nullable=True),
    sa.Column("storage_method", sa.Text(), nullable=True),
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _nullable(val: str) -> str | None:
    """Return None if val is empty, else val."""
    return val if val else None


def _validate_enum(value: str, enum_set: frozenset[str], field_name: str) -> str:
    """Validate value is in enum_set (case-insensitive match, returns canonical form)."""
    if value in enum_set:
        return value
    lower_map = {v.lower(): v for v in enum_set}
    if value.lower() in lower_map:
        return lower_map[value.lower()]
    raise ValueError(f"{field_name}={value!r} not in {sorted(enum_set)}")


def _validate_enum_nullable(value: str, enum_set: frozenset[str], field_name: str) -> str | None:
    """Like _validate_enum but returns None for empty string."""
    if not value:
        return None
    return _validate_enum(value, enum_set, field_name)


def _parse_float(val: str, field_name: str) -> float | None:
    """Parse a float from a Sheets cell; return None for empty string."""
    if val == "":
        return None
    try:
        return float(val)
    except ValueError:
        raise ValueError(f"{field_name}={val!r} is not a valid float")


def _parse_float_1dp(val: str, field_name: str) -> float | None:
    """Parse a float rounded to 1 decimal place, matching NUMERIC(5,1) DB columns."""
    result = _parse_float(val, field_name)
    return round(result, 1) if result is not None else None


def _parse_int(val: str, field_name: str) -> int | None:
    """Parse an int from a Sheets cell; return None for empty string."""
    if val == "":
        return None
    try:
        return int(val)
    except ValueError:
        raise ValueError(f"{field_name}={val!r} is not a valid int")


# ---------------------------------------------------------------------------
# from_sheets_dict mappers
# ---------------------------------------------------------------------------


def from_sheets_dict_catalog(
    row: dict[str, Any],
    *,
    household_id: str,
) -> dict[str, Any]:
    """Map a raw Sheets Catalog row to a Postgres insert dict."""
    sheets_id = str(row.get("Catalog_ID", "")).strip()
    if not sheets_id:
        raise ValueError("Catalog_ID is required and must not be empty")

    roaster = str(row.get("Roaster", "")).strip()
    if not roaster:
        raise ValueError("Roaster is required")

    bean_name = str(row.get("Bean_Name", "")).strip()
    if not bean_name:
        raise ValueError("Bean_Name is required")

    roast_level = _validate_enum(
        str(row.get("Roast_Level", "")).strip(), ROAST_LEVEL_ENUM, "Roast_Level"
    )

    return {
        "sheets_id": sheets_id,
        "household_id": household_id,
        "roaster": roaster,
        "bean_name": bean_name,
        "roast_level": roast_level,
        "product_url": _nullable(str(row.get("Product_URL", "")).strip()),
        "local_image_path": _nullable(str(row.get("Local_Image_Path", "")).strip()),
        "origin": _nullable(str(row.get("Origin", "")).strip()),
        "process": _nullable(str(row.get("Process", "")).strip()),
        "notes": _nullable(str(row.get("Notes", "")).strip()),
    }


def from_sheets_dict_inventory(
    row: dict[str, Any],
    *,
    household_id: str,
    catalog_id_to_pg_uuid: dict[str, str],
) -> dict[str, Any]:
    """Map a raw Sheets Inventory row to a Postgres insert dict."""
    sheets_id = str(row.get("Bag_ID", "")).strip()
    if not sheets_id:
        raise ValueError("Bag_ID is required and must not be empty")

    beans = str(row.get("Beans", "")).strip()
    if not beans:
        raise ValueError("Beans is required")

    roast_date_str = str(row.get("RoastDate", "")).strip()
    if not roast_date_str:
        raise ValueError("RoastDate is required")
    roast_date = datetime.date.fromisoformat(roast_date_str)

    roast_level = _validate_enum(
        str(row.get("RoastLevel", "")).strip(), ROAST_LEVEL_ENUM, "RoastLevel"
    )

    display_name = str(row.get("Display_Name", "")).strip()
    if not display_name:
        raise ValueError("Display_Name is required")

    catalog_id_sheets = str(row.get("Catalog_ID", "")).strip()
    catalog_id: str | None = catalog_id_to_pg_uuid.get(catalog_id_sheets)

    status = _validate_enum(str(row.get("Status", "")).strip(), INVENTORY_STATUS_ENUM, "Status")

    storage_method_raw = str(row.get("Storage_Method", "")).strip()
    storage_method: str | None
    if storage_method_raw:
        storage_method = _validate_enum(storage_method_raw, STORAGE_METHOD_ENUM, "Storage_Method")
    else:
        storage_method = None

    return {
        "sheets_id": sheets_id,
        "household_id": household_id,
        "beans": beans,
        "roast_date": roast_date,
        "roast_level": roast_level,
        "display_name": display_name,
        "catalog_id": catalog_id,
        "status": status,
        "storage_method": storage_method,
    }


def from_sheets_dict_hardware(
    row: dict[str, Any],
    *,
    household_id: str,
) -> dict[str, Any]:
    """Map a raw Sheets Hardware row to a Postgres insert dict."""
    sheets_id = str(row.get("Hardware_ID", "")).strip()
    if not sheets_id:
        raise ValueError("Hardware_ID is required and must not be empty")

    category = _validate_enum(
        str(row.get("Category", "")).strip(), HARDWARE_CATEGORY_ENUM, "Category"
    )

    name = str(row.get("Name", "")).strip()
    if not name:
        raise ValueError("Name is required")

    return {
        "sheets_id": sheets_id,
        "household_id": household_id,
        "category": category,
        "name": name,
        "product_url": _nullable(str(row.get("Product_URL", "")).strip()),
        "local_image_path": _nullable(str(row.get("Local_Image_Path", "")).strip()),
    }


def from_sheets_dict_maintenance(
    row: dict[str, Any],
    *,
    household_id: str,
    hardware_id_to_pg_uuid: dict[str, str],
) -> dict[str, Any]:
    """Map a raw Sheets Maintenance row to a Postgres insert dict."""
    sheets_id = str(row.get("Maintenance_ID", "")).strip()
    if not sheets_id:
        raise ValueError("Maintenance_ID is required and must not be empty")

    hardware_id_sheets = str(row.get("Hardware_ID", "")).strip()
    hardware_id: str | None = hardware_id_to_pg_uuid.get(hardware_id_sheets)

    date_str = str(row.get("Date", "")).strip()
    if not date_str:
        raise ValueError("Date is required for maintenance")
    performed_at = datetime.datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)

    action = _validate_enum(
        str(row.get("Action_Type", "")).strip(), MAINTENANCE_ACTION_ENUM, "Action_Type"
    )

    return {
        "sheets_id": sheets_id,
        "household_id": household_id,
        "hardware_id": hardware_id,
        "performed_at": performed_at,
        "action": action,
        "notes": _nullable(str(row.get("Notes", "")).strip()),
    }


def from_sheets_dict_brew_log(
    row: dict[str, Any],
    *,
    household_id: str,
) -> dict[str, Any]:
    """Map a raw Sheets Brew_Log row to a Postgres insert dict."""
    sheets_id = str(row.get("Shot_ID", "")).strip()
    if not sheets_id:
        raise ValueError("Shot_ID is required and must not be empty")

    date_str = str(row.get("Date", "")).strip()
    if not date_str:
        raise ValueError("Date is required for brew_log")
    brewed_at = datetime.datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)

    bag_id = str(row.get("Bag_ID", "")).strip()

    storage_method_raw = str(row.get("Storage_Method", "")).strip()
    storage_method: str | None
    if storage_method_raw:
        storage_method = _validate_enum(storage_method_raw, STORAGE_METHOD_ENUM, "Storage_Method")
    else:
        storage_method = None

    return {
        "sheets_id": sheets_id,
        "household_id": household_id,
        "brewed_at": brewed_at,
        "bag_id": bag_id if bag_id else None,
        "machine_id": _nullable(str(row.get("Machine_ID", "")).strip()),
        "grinder_id": _nullable(str(row.get("Grinder_ID", "")).strip()),
        "basket_id": _nullable(str(row.get("Basket_ID", "")).strip()),
        "dose_g": _parse_float_1dp(str(row.get("Dose_In_g", "")).strip(), "Dose_In_g"),
        "yield_g": _parse_float_1dp(str(row.get("Yield_Out_g", "")).strip(), "Yield_Out_g"),
        "time_sec": _parse_int(str(row.get("Time_Sec", "")).strip(), "Time_Sec"),
        "grind_setting": _parse_float_1dp(str(row.get("Grind_Setting", "")).strip(), "Grind_Setting"),
        "shot_eligibility": _validate_enum(
            str(row.get("Shot_Eligibility", "")).strip(), SHOT_ELIGIBILITY_ENUM, "Shot_Eligibility"
        ),
        "taste_summary": _validate_enum_nullable(
            str(row.get("Taste_Summary", "")).strip(), TASTE_SUMMARY_ENUM, "Taste_Summary"
        ),
        "notes": _nullable(str(row.get("User_Notes", "")).strip()),
        "ai_feedback": _nullable(str(row.get("AI_Feedback", "")).strip()),
        "storage_method": storage_method,
        # catalog_id remains NULL in M3
        "catalog_id": None,
    }


# ---------------------------------------------------------------------------
# Checksum
# ---------------------------------------------------------------------------

_CHECKSUM_EXCLUDE: frozenset[str] = frozenset({"id", "household_id", "sheets_id", "created_at"})


def row_checksum(row: dict[str, Any]) -> str:
    """Compute SHA-256 checksum of a row dict, excluding injected/identity fields."""
    fields = sorted(k for k in row if k not in _CHECKSUM_EXCLUDE)
    parts: list[str] = []
    for field in fields:
        v = row[field]
        if v is None:
            parts.append("NULL")
        elif isinstance(v, float):
            parts.append(f"{v:.6f}")
        elif isinstance(v, decimal.Decimal):
            parts.append(f"{float(v):.6f}")
        elif isinstance(v, datetime.datetime):
            # datetime must come before date (datetime is a subclass of date)
            parts.append(v.isoformat())
        elif isinstance(v, datetime.date):
            parts.append(v.isoformat())
        elif isinstance(v, uuid.UUID):
            parts.append(str(v))
        else:
            parts.append(str(v))
    return hashlib.sha256("|".join(parts).encode()).hexdigest()


# ---------------------------------------------------------------------------
# Bulk upsert
# ---------------------------------------------------------------------------


async def bulk_upsert(
    engine: AsyncEngine,
    table: sa.Table,
    rows: list[dict[str, Any]],
) -> int:
    """Upsert rows into table, conflicting on sheets_id. Returns count of rows processed."""
    if not rows:
        return 0
    async with engine.begin() as conn:
        stmt = pg_insert(table).values(rows)
        set_cols = {col: stmt.excluded[col] for col in rows[0] if col not in ("id", "created_at")}
        upsert_stmt = stmt.on_conflict_do_update(
            index_elements=["sheets_id"],
            set_=set_cols,
        )
        await conn.execute(upsert_stmt)
    return len(rows)

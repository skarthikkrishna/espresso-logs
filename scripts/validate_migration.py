#!/usr/bin/env python3
"""Validate M3 migration: row counts + checksums between Sheets and Postgres.

Usage:
    SPREADSHEET_ID=xxx DATABASE_URL=postgresql+asyncpg://... \\
        python scripts/validate_migration.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

from app.repos.sheets_client import RealSheetsClient
from scripts._mapping import (
    BREW_LOG_TABLE,
    CATALOG_TABLE,
    HARDWARE_TABLE,
    INVENTORY_BAGS_TABLE,
    MAINTENANCE_LOG_TABLE,
    from_sheets_dict_brew_log,
    from_sheets_dict_catalog,
    from_sheets_dict_hardware,
    from_sheets_dict_inventory,
    from_sheets_dict_maintenance,
    row_checksum,
)


def _get_env_or_exit(var: str) -> str:
    val = os.environ.get(var)
    if not val:
        print(f"ERROR: {var} environment variable is required", file=sys.stderr)
        sys.exit(2)
    return val


async def main() -> None:
    """Run row-count and checksum validation between Sheets and Postgres."""
    spreadsheet_id = _get_env_or_exit("SPREADSHEET_ID")
    database_url = _get_env_or_exit("DATABASE_URL")

    engine = create_async_engine(database_url, echo=False)
    sheets = RealSheetsClient(spreadsheet_id)

    # Build FK lookups
    catalog_id_to_pg_uuid: dict[str, str] = {}
    hardware_id_to_pg_uuid: dict[str, str] = {}
    async with engine.connect() as conn:
        rows_c = await conn.execute(
            sa.select(CATALOG_TABLE.c.sheets_id, CATALOG_TABLE.c.id).where(
                CATALOG_TABLE.c.sheets_id.isnot(None)
            )
        )
        for r in rows_c:
            catalog_id_to_pg_uuid[str(r[0])] = str(r[1])

        rows_h = await conn.execute(
            sa.select(HARDWARE_TABLE.c.sheets_id, HARDWARE_TABLE.c.id).where(
                HARDWARE_TABLE.c.sheets_id.isnot(None)
            )
        )
        for r in rows_h:
            hardware_id_to_pg_uuid[str(r[0])] = str(r[1])

    # Use a dummy household_id so checksums compare only Sheets-origin fields
    DUMMY_HH = "00000000-0000-0000-0000-000000000000"

    def _map_catalog(row: dict[str, Any]) -> dict[str, Any]:
        return from_sheets_dict_catalog(row, household_id=DUMMY_HH)

    def _map_inventory(row: dict[str, Any]) -> dict[str, Any]:
        return from_sheets_dict_inventory(
            row, household_id=DUMMY_HH, catalog_id_to_pg_uuid=catalog_id_to_pg_uuid
        )

    def _map_hardware(row: dict[str, Any]) -> dict[str, Any]:
        return from_sheets_dict_hardware(row, household_id=DUMMY_HH)

    def _map_maintenance(row: dict[str, Any]) -> dict[str, Any]:
        return from_sheets_dict_maintenance(
            row, household_id=DUMMY_HH, hardware_id_to_pg_uuid=hardware_id_to_pg_uuid
        )

    def _map_brew_log(row: dict[str, Any]) -> dict[str, Any]:
        return from_sheets_dict_brew_log(row, household_id=DUMMY_HH)

    entities: list[tuple[str, str, Any, sa.Table]] = [
        ("Catalog", "Catalog", _map_catalog, CATALOG_TABLE),
        ("Inventory", "Inventory", _map_inventory, INVENTORY_BAGS_TABLE),
        ("Hardware", "Hardware", _map_hardware, HARDWARE_TABLE),
        ("Maintenance", "Maintenance", _map_maintenance, MAINTENANCE_LOG_TABLE),
        ("Brew_Log", "Brew_Log", _map_brew_log, BREW_LOG_TABLE),
    ]

    overall_pass = True

    for entity_name, tab_name, mapper, table in entities:
        raw = sheets.get_all_records(tab_name)
        sheets_rows: dict[str, dict[str, Any]] = {}
        mapping_errors = 0
        duplicate_count = 0
        for i, row in enumerate(raw):
            try:
                mapped = mapper(row)
                sid = mapped.get("sheets_id")
                if sid:
                    sid_str = str(sid)
                    if sid_str in sheets_rows:
                        print(
                            f"  [{entity_name} row {i}] DUPLICATE sheets_id={sid_str}",
                            file=sys.stderr,
                        )
                        duplicate_count += 1
                    else:
                        sheets_rows[sid_str] = mapped
            except (ValueError, KeyError) as exc:
                print(f"  [{entity_name} row {i}] mapping error: {exc}", file=sys.stderr)
                mapping_errors += 1

        async with engine.connect() as conn:
            pg_result = await conn.execute(
                sa.select(table).where(table.c.sheets_id.isnot(None)).order_by(table.c.sheets_id)
            )
            pg_rows: dict[str, dict[str, Any]] = {
                str(r.sheets_id): dict(r._mapping) for r in pg_result
            }

        sheets_count = len(sheets_rows)
        pg_count = len(pg_rows)
        count_match = sheets_count == pg_count
        checksum_errors = 0

        for sid, sheets_row in sheets_rows.items():
            if sid not in pg_rows:
                print(f"  [{entity_name}] MISSING in Postgres: {sid}", file=sys.stderr)
                checksum_errors += 1
                continue
            s_checksum = row_checksum(sheets_row)
            p_checksum = row_checksum(pg_rows[sid])
            if s_checksum != p_checksum:
                print(
                    f"  [{entity_name}] CHECKSUM MISMATCH sheets_id={sid}",
                    file=sys.stderr,
                )
                checksum_errors += 1

        status = "✓" if (count_match and checksum_errors == 0 and mapping_errors == 0 and duplicate_count == 0) else "✗"
        if not count_match or checksum_errors > 0 or mapping_errors > 0 or duplicate_count > 0:
            overall_pass = False

        count_note = f" (sheets={sheets_count}, pg={pg_count})" if not count_match else ""
        extra_parts: list[str] = []
        if mapping_errors > 0:
            extra_parts.append(f"{mapping_errors} mapping errors")
        if duplicate_count > 0:
            extra_parts.append(f"{duplicate_count} duplicates")
        extra_note = ", " + ", ".join(extra_parts) if extra_parts else ""
        print(
            f"{status} {entity_name}: {pg_count} rows — {checksum_errors} checksum errors"
            f"{count_note}{extra_note}"
        )

    await engine.dispose()

    if overall_pass:
        print("\nVALIDATION PASSED")
        sys.exit(0)
    else:
        print("\nVALIDATION FAILED")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

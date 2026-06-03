#!/usr/bin/env python3
"""Migrate data from Google Sheets to PostgreSQL (M3 backfill).

Usage:
    SPREADSHEET_ID=xxx DATABASE_URL=postgresql+asyncpg://... \\
        python scripts/migrate_sheets_to_postgres.py
    SPREADSHEET_ID=xxx DATABASE_URL=... \\
        python scripts/migrate_sheets_to_postgres.py --entity Catalog --entity Hardware
    SPREADSHEET_ID=xxx DATABASE_URL=... \\
        python scripts/migrate_sheets_to_postgres.py --dry-run
"""

from __future__ import annotations

import argparse
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
    bulk_upsert,
    from_sheets_dict_brew_log,
    from_sheets_dict_catalog,
    from_sheets_dict_hardware,
    from_sheets_dict_inventory,
    from_sheets_dict_maintenance,
)
from scripts._seed import ensure_default_household, ensure_system_user


def _get_env_or_exit(var: str) -> str:
    val = os.environ.get(var)
    if not val:
        print(f"ERROR: {var} environment variable is required", file=sys.stderr)
        sys.exit(2)
    return val


async def main(argv: list[str] | None = None) -> None:
    """Run the Sheets → Postgres migration."""
    parser = argparse.ArgumentParser(description="Migrate Sheets data to Postgres")
    parser.add_argument(
        "--entity",
        action="append",
        dest="entities",
        metavar="ENTITY",
        help="Entity to migrate (repeatable). Default: all.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Read and map data but do not write to Postgres.",
    )
    args = parser.parse_args(argv)

    spreadsheet_id = _get_env_or_exit("SPREADSHEET_ID")
    database_url = _get_env_or_exit("DATABASE_URL")

    engine = create_async_engine(database_url, echo=False)
    sheets = RealSheetsClient(spreadsheet_id)

    if not args.dry_run:
        system_user_id = await ensure_system_user(engine)
        household_id = await ensure_default_household(engine, system_user_id)
        hh_str = str(household_id)
    else:
        hh_str = "00000000-0000-0000-0000-000000000000"

    entity_filter: set[str] | None = set(args.entities) if args.entities else None
    results: dict[str, tuple[int, int, int]] = {}

    # ── Catalog ──────────────────────────────────────────────────────────────
    if entity_filter is None or "Catalog" in entity_filter:
        print("→ Migrating Catalog...")
        raw_catalog = sheets.get_all_records("Catalog")
        mapped_catalog: list[dict[str, Any]] = []
        catalog_errors = 0
        for i, row in enumerate(raw_catalog):
            try:
                mapped_catalog.append(from_sheets_dict_catalog(row, household_id=hh_str))
            except (ValueError, KeyError) as exc:
                print(f"  [Catalog row {i}] SKIP: {exc}", file=sys.stderr)
                catalog_errors += 1
        upserted_catalog = 0
        if not args.dry_run:
            try:
                upserted_catalog = await bulk_upsert(engine, CATALOG_TABLE, mapped_catalog)
            except Exception as exc:
                print(f"  [Catalog] upsert failed: {exc}", file=sys.stderr)
                catalog_errors += 1
        results["Catalog"] = (len(mapped_catalog), upserted_catalog, catalog_errors)
        print(
            f"  mapped={len(mapped_catalog)}, errors={catalog_errors}, upserted={upserted_catalog}"
        )

    # Build catalog lookup (needed by Inventory mapper)
    catalog_id_to_pg_uuid: dict[str, str] = {}
    async with engine.begin() as conn:
        if not args.dry_run:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": hh_str},
            )
        rows_c = await conn.execute(
            sa.select(CATALOG_TABLE.c.sheets_id, CATALOG_TABLE.c.id).where(
                CATALOG_TABLE.c.sheets_id.isnot(None)
            )
        )
        for r in rows_c:
            catalog_id_to_pg_uuid[str(r[0])] = str(r[1])

    # ── Inventory ─────────────────────────────────────────────────────────────
    if entity_filter is None or "Inventory" in entity_filter:
        print("→ Migrating Inventory...")
        raw_inv = sheets.get_all_records("Inventory")
        mapped_inv: list[dict[str, Any]] = []
        inv_errors = 0
        for i, row in enumerate(raw_inv):
            try:
                mapped_inv.append(
                    from_sheets_dict_inventory(
                        row,
                        household_id=hh_str,
                        catalog_id_to_pg_uuid=catalog_id_to_pg_uuid,
                    )
                )
            except (ValueError, KeyError) as exc:
                print(f"  [Inventory row {i}] SKIP: {exc}", file=sys.stderr)
                inv_errors += 1
        upserted_inv = 0
        if not args.dry_run:
            try:
                upserted_inv = await bulk_upsert(engine, INVENTORY_BAGS_TABLE, mapped_inv)
            except Exception as exc:
                print(f"  [Inventory] upsert failed: {exc}", file=sys.stderr)
                inv_errors += 1
        results["Inventory"] = (len(mapped_inv), upserted_inv, inv_errors)
        print(f"  mapped={len(mapped_inv)}, errors={inv_errors}, upserted={upserted_inv}")

    # ── Hardware ──────────────────────────────────────────────────────────────
    if entity_filter is None or "Hardware" in entity_filter:
        print("→ Migrating Hardware...")
        raw_hw = sheets.get_all_records("Hardware")
        mapped_hw: list[dict[str, Any]] = []
        hw_errors = 0
        for i, row in enumerate(raw_hw):
            try:
                mapped_hw.append(from_sheets_dict_hardware(row, household_id=hh_str))
            except (ValueError, KeyError) as exc:
                print(f"  [Hardware row {i}] SKIP: {exc}", file=sys.stderr)
                hw_errors += 1
        upserted_hw = 0
        if not args.dry_run:
            try:
                upserted_hw = await bulk_upsert(engine, HARDWARE_TABLE, mapped_hw)
            except Exception as exc:
                print(f"  [Hardware] upsert failed: {exc}", file=sys.stderr)
                hw_errors += 1
        results["Hardware"] = (len(mapped_hw), upserted_hw, hw_errors)
        print(f"  mapped={len(mapped_hw)}, errors={hw_errors}, upserted={upserted_hw}")

    # Build hardware lookup (needed by Maintenance mapper)
    hardware_id_to_pg_uuid: dict[str, str] = {}
    async with engine.begin() as conn:
        if not args.dry_run:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": hh_str},
            )
        rows_h = await conn.execute(
            sa.select(HARDWARE_TABLE.c.sheets_id, HARDWARE_TABLE.c.id).where(
                HARDWARE_TABLE.c.sheets_id.isnot(None)
            )
        )
        for r in rows_h:
            hardware_id_to_pg_uuid[str(r[0])] = str(r[1])

    # ── Maintenance ───────────────────────────────────────────────────────────
    if entity_filter is None or "Maintenance" in entity_filter:
        print("→ Migrating Maintenance...")
        raw_maint = sheets.get_all_records("Maintenance")
        mapped_maint: list[dict[str, Any]] = []
        maint_errors = 0
        for i, row in enumerate(raw_maint):
            try:
                mapped_maint.append(
                    from_sheets_dict_maintenance(
                        row,
                        household_id=hh_str,
                        hardware_id_to_pg_uuid=hardware_id_to_pg_uuid,
                    )
                )
            except (ValueError, KeyError) as exc:
                print(f"  [Maintenance row {i}] SKIP: {exc}", file=sys.stderr)
                maint_errors += 1
        upserted_maint = 0
        if not args.dry_run:
            try:
                upserted_maint = await bulk_upsert(engine, MAINTENANCE_LOG_TABLE, mapped_maint)
            except Exception as exc:
                print(f"  [Maintenance] upsert failed: {exc}", file=sys.stderr)
                maint_errors += 1
        results["Maintenance"] = (len(mapped_maint), upserted_maint, maint_errors)
        print(f"  mapped={len(mapped_maint)}, errors={maint_errors}, upserted={upserted_maint}")

    # ── Brew_Log ──────────────────────────────────────────────────────────────
    if entity_filter is None or "Brew_Log" in entity_filter:
        print("→ Migrating Brew_Log...")
        raw_brew = sheets.get_all_records("Brew_Log")
        mapped_brew: list[dict[str, Any]] = []
        brew_errors = 0
        for i, row in enumerate(raw_brew):
            try:
                mapped_brew.append(from_sheets_dict_brew_log(row, household_id=hh_str))
            except (ValueError, KeyError) as exc:
                print(f"  [Brew_Log row {i}] SKIP: {exc}", file=sys.stderr)
                brew_errors += 1
        upserted_brew = 0
        if not args.dry_run:
            try:
                upserted_brew = await bulk_upsert(engine, BREW_LOG_TABLE, mapped_brew)
            except Exception as exc:
                print(f"  [Brew_Log] upsert failed: {exc}", file=sys.stderr)
                brew_errors += 1
        results["Brew_Log"] = (len(mapped_brew), upserted_brew, brew_errors)
        print(f"  mapped={len(mapped_brew)}, errors={brew_errors}, upserted={upserted_brew}")

    await engine.dispose()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n── MIGRATION SUMMARY ────────────────────────────────────────────────")
    all_pass = True
    for entity, (mapped_count, upserted_count, error_count) in results.items():
        dry = " (DRY RUN)" if args.dry_run else ""
        if error_count > 0:
            all_pass = False
        status = "PASS" if error_count == 0 else "FAIL"
        print(f"  {entity}: {mapped_count} mapped, {upserted_count} upserted{dry} — {status}")
    print("─────────────────────────────────────────────────────────────────────")
    if all_pass:
        print("MIGRATION COMPLETE")
    else:
        print("MIGRATION FAILED")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

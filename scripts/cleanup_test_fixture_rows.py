#!/usr/bin/env python3
"""Dry-run-first cleanup for SQL fixture catalog pollution."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tests.db_safety import assert_explicit_test_database_url, is_explicit_test_database_url

SQL_ROASTER_PATTERN = r"^SQL Roaster [0-9a-f]{8,}$"
SQL_BEAN_PATTERN = r"^SQL Bean [0-9a-f]{8,}$"
SPEC039_ROASTER_PATTERN = r"^SPEC039 Roaster [0-9a-f]{8,}$"

_PATTERN_PARAMS = {
    "sql_roaster_pattern": SQL_ROASTER_PATTERN,
    "sql_bean_pattern": SQL_BEAN_PATTERN,
    "spec039_roaster_pattern": SPEC039_ROASTER_PATTERN,
}

_COUNTS_SQL = text(
    """
    WITH fixture_catalog AS (
        SELECT id, household_id, sheets_id
        FROM catalog
        WHERE roaster ~ :sql_roaster_pattern
           OR roaster ~ :spec039_roaster_pattern
           OR bean_name ~ :sql_bean_pattern
    ),
    fixture_inventory AS (
        SELECT i.id, i.household_id, i.sheets_id
        FROM inventory_bags i
        WHERE i.catalog_id IN (SELECT id FROM fixture_catalog)
           OR EXISTS (
               SELECT 1
               FROM fixture_catalog c
               WHERE c.sheets_id IS NOT NULL
                 AND i.sheets_catalog_id = c.sheets_id
                 AND i.household_id IS NOT DISTINCT FROM c.household_id
           )
    ),
    fixture_brew_log AS (
        SELECT b.id
        FROM brew_log b
        WHERE b.catalog_id IN (SELECT id FROM fixture_catalog)
           OR EXISTS (
               SELECT 1
               FROM fixture_inventory i
               WHERE i.sheets_id IS NOT NULL
                 AND b.bag_id = i.sheets_id
                 AND b.household_id IS NOT DISTINCT FROM i.household_id
           )
    )
    SELECT
        (SELECT count(*) FROM fixture_catalog) AS catalog_rows,
        (SELECT count(*) FROM fixture_inventory) AS inventory_rows,
        (SELECT count(*) FROM fixture_brew_log) AS brew_log_rows
    """
)

_DELETE_BREW_LOG_SQL = text(
    """
    WITH fixture_catalog AS (
        SELECT id, household_id, sheets_id
        FROM catalog
        WHERE roaster ~ :sql_roaster_pattern
           OR roaster ~ :spec039_roaster_pattern
           OR bean_name ~ :sql_bean_pattern
    ),
    fixture_inventory AS (
        SELECT i.id, i.household_id, i.sheets_id
        FROM inventory_bags i
        WHERE i.catalog_id IN (SELECT id FROM fixture_catalog)
           OR EXISTS (
               SELECT 1
               FROM fixture_catalog c
               WHERE c.sheets_id IS NOT NULL
                 AND i.sheets_catalog_id = c.sheets_id
                 AND i.household_id IS NOT DISTINCT FROM c.household_id
           )
    )
    DELETE FROM brew_log b
    WHERE b.catalog_id IN (SELECT id FROM fixture_catalog)
       OR EXISTS (
           SELECT 1
           FROM fixture_inventory i
           WHERE i.sheets_id IS NOT NULL
             AND b.bag_id = i.sheets_id
             AND b.household_id IS NOT DISTINCT FROM i.household_id
       )
    RETURNING b.id
    """
)

_DELETE_INVENTORY_SQL = text(
    """
    WITH fixture_catalog AS (
        SELECT id, household_id, sheets_id
        FROM catalog
        WHERE roaster ~ :sql_roaster_pattern
           OR roaster ~ :spec039_roaster_pattern
           OR bean_name ~ :sql_bean_pattern
    )
    DELETE FROM inventory_bags i
    WHERE i.catalog_id IN (SELECT id FROM fixture_catalog)
       OR EXISTS (
           SELECT 1
           FROM fixture_catalog c
           WHERE c.sheets_id IS NOT NULL
             AND i.sheets_catalog_id = c.sheets_id
             AND i.household_id IS NOT DISTINCT FROM c.household_id
       )
    RETURNING i.id
    """
)

_DELETE_CATALOG_SQL = text(
    """
    DELETE FROM catalog c
    WHERE c.roaster ~ :sql_roaster_pattern
       OR c.roaster ~ :spec039_roaster_pattern
       OR c.bean_name ~ :sql_bean_pattern
    RETURNING c.id
    """
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Remove known SQL integration-test fixture rows. Defaults to dry-run; "
            "mutation requires --apply."
        )
    )
    parser.add_argument(
        "--database-url",
        default=None,
        help=(
            "Database URL to inspect. Defaults to TEST_DATABASE_URL, then DATABASE_URL. "
            "The URL is never printed."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete matched fixture rows. Without this flag, only a dry-run summary is printed.",
    )
    parser.add_argument(
        "--confirm-non-test-db",
        action="store_true",
        help=(
            "Allow --apply when the database name/path is not explicitly test-marked. "
            "Use only after reviewing the dry-run summary and taking a backup."
        ),
    )
    return parser


def _get_database_url(args: argparse.Namespace) -> str:
    database_url = (
        args.database_url or os.environ.get("TEST_DATABASE_URL") or os.environ.get("DATABASE_URL")
    )
    if not database_url:
        print(
            "ERROR: set TEST_DATABASE_URL or DATABASE_URL, or pass --database-url", file=sys.stderr
        )
        raise SystemExit(2)
    return database_url


def _assert_safe_to_apply(database_url: str, *, allow_non_test_db: bool) -> None:
    try:
        assert_explicit_test_database_url(database_url, purpose="fixture cleanup mutation")
    except RuntimeError:
        if allow_non_test_db:
            print(
                "WARNING: applying cleanup to a database whose name/path is not explicitly "
                "test-marked because --confirm-non-test-db was provided.",
                file=sys.stderr,
            )
            return
        print(
            "ERROR: refusing --apply because the database name/path is not explicitly "
            "test-marked. Re-run without --apply for a dry-run summary, or pass "
            "--confirm-non-test-db only after reviewing the dry-run and taking a backup.",
            file=sys.stderr,
        )
        raise SystemExit(1) from None


async def _fetch_counts(conn) -> dict[str, int]:
    row = (await conn.execute(_COUNTS_SQL, _PATTERN_PARAMS)).mappings().one()
    return {
        "catalog": int(row["catalog_rows"]),
        "inventory_bags": int(row["inventory_rows"]),
        "brew_log": int(row["brew_log_rows"]),
    }


async def _delete_rows(conn) -> dict[str, int]:
    brew_log = (await conn.execute(_DELETE_BREW_LOG_SQL, _PATTERN_PARAMS)).all()
    inventory = (await conn.execute(_DELETE_INVENTORY_SQL, _PATTERN_PARAMS)).all()
    catalog = (await conn.execute(_DELETE_CATALOG_SQL, _PATTERN_PARAMS)).all()
    return {
        "catalog": len(catalog),
        "inventory_bags": len(inventory),
        "brew_log": len(brew_log),
    }


def _print_summary(*, mode: str, counts: dict[str, int]) -> None:
    total = sum(counts.values())
    print(f"Mode: {mode}")
    print("Matched anchored fixture patterns:")
    print(f"  - {SQL_ROASTER_PATTERN}")
    print(f"  - {SQL_BEAN_PATTERN}")
    print(f"  - {SPEC039_ROASTER_PATTERN}")
    print("Safely associated rows:")
    print(f"  catalog: {counts['catalog']}")
    print(f"  inventory_bags: {counts['inventory_bags']}")
    print(f"  brew_log: {counts['brew_log']}")
    print(f"Total rows {'deleted' if mode == 'apply' else 'that would be deleted'}: {total}")
    if mode == "dry-run":
        print("No rows were changed. Re-run with --apply to delete matched fixture rows.")
    elif total == 0:
        print("No-op: no matching fixture rows remained.")


async def _run(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    database_url = _get_database_url(args)

    if args.apply:
        _assert_safe_to_apply(database_url, allow_non_test_db=args.confirm_non_test_db)
    elif not is_explicit_test_database_url(database_url):
        print(
            "WARNING: database name/path is not explicitly test-marked; dry-run only.",
            file=sys.stderr,
        )

    engine = create_async_engine(database_url, echo=False)
    try:
        async with engine.begin() as conn:
            if args.apply:
                counts = await _delete_rows(conn)
                _print_summary(mode="apply", counts=counts)
            else:
                counts = await _fetch_counts(conn)
                _print_summary(mode="dry-run", counts=counts)
    finally:
        await engine.dispose()

    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(_run()))
    except Exception as exc:
        print(f"ERROR: fixture cleanup failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()

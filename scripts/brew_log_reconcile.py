#!/usr/bin/env python3
"""
scripts/brew_log_reconcile.py — Brew Log Sheets↔Postgres reconciliation tool.

Usage:
    python scripts/brew_log_reconcile.py [--since YYYY-MM-DD] [--until YYYY-MM-DD] \
        [--shot-id SHOT_ID ...] [--apply]

Modes:
    dry-run (default): report missing rows, exit non-zero if any found
    --apply: insert missing rows into Postgres, exit non-zero if any inserts fail
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.deps import get_sheets_client
from app.models.base import _is_cloud_sql_url, close_engine, get_session_factory, init_async_engine
from app.repos.base import TTLCache
from app.repos.brew_log import BrewLogRepo
from app.repos.sql.brew_log import SqlBrewLogRepo


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Reconcile Brew Log rows between Sheets and Postgres"
    )
    parser.add_argument(
        "--since", type=date.fromisoformat, help="Only include shots on/after YYYY-MM-DD"
    )
    parser.add_argument(
        "--until", type=date.fromisoformat, help="Only include shots on/before YYYY-MM-DD"
    )
    parser.add_argument(
        "--shot-id",
        action="append",
        dest="shot_ids",
        default=[],
        help="Specific Shot_ID to reconcile (repeatable)",
    )
    parser.add_argument(
        "--apply", action="store_true", help="Insert missing Sheets rows into Postgres"
    )
    return parser


def _get_database_url() -> str:
    database_url = os.environ.get("DATABASE_URL") or settings.database_url
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required", file=sys.stderr)
        raise SystemExit(2)
    return database_url


def _filter_rows(
    rows: list[dict[str, Any]],
    since: date | None,
    until: date | None,
    shot_ids: set[str],
) -> list[dict[str, Any]]:
    filtered: list[dict[str, Any]] = []
    for row in rows:
        shot_id = str(row.get("Shot_ID") or "").strip()
        if not shot_id:
            continue
        if shot_ids and shot_id not in shot_ids:
            continue
        if since is not None or until is not None:
            raw_date = str(row.get("Date") or "").strip()
            try:
                # Accept both plain dates ("2026-05-14") and full ISO datetimes
                # ("2026-05-14T23:59:00Z", "2026-05-14T23:59:00+00:00").
                brewed_on = date.fromisoformat(raw_date[:10])
            except ValueError as exc:
                raise ValueError(
                    f"Shot_ID {shot_id!r} has non-ISO Date value {raw_date!r}"
                ) from exc
            if since is not None and brewed_on < since:
                continue
            if until is not None and brewed_on > until:
                continue
        filtered.append(row)
    return filtered


async def _apply_missing(sql_repo: SqlBrewLogRepo, rows: list[dict[str, Any]]) -> int:
    failures = 0
    for row in rows:
        shot_id = str(row.get("Shot_ID") or "")
        try:
            await sql_repo.add(row)
            print(f"INSERTED {shot_id}")
        except Exception as exc:
            failures += 1
            print(f"FAILED {shot_id}: {exc}", file=sys.stderr)
    return failures


async def _run(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    database_url = _get_database_url()

    if _is_cloud_sql_url(database_url):
        await init_async_engine(database_url)

    # Use TTL=0 so every run fetches fresh data from Sheets, bypassing the
    # process-level cache that could mask real drift or report false drift.
    sheets_repo = BrewLogRepo(client=get_sheets_client(), cache=TTLCache(ttl=0))
    sheets_rows = _filter_rows(sheets_repo.list(), args.since, args.until, set(args.shot_ids))

    async with get_session_factory()() as session:
        sql_repo = SqlBrewLogRepo(session)
        postgres_ids = set(await sql_repo.list_existing_ids())
        missing_rows = [
            row for row in sheets_rows if str(row.get("Shot_ID") or "") not in postgres_ids
        ]

        print(f"Sheets rows considered: {len(sheets_rows)}")
        print(f"Postgres Brew_Log IDs: {len(postgres_ids)}")
        print(f"Missing in Postgres: {len(missing_rows)}")

        if missing_rows:
            missing_ids = [str(row.get("Shot_ID") or "") for row in missing_rows]
            print("Missing Shot_IDs:", ", ".join(missing_ids), file=sys.stderr)

        if not missing_rows:
            print("No drift detected.")
            return 0

        if not args.apply:
            print("Drift detected. Re-run with --apply to insert missing rows.", file=sys.stderr)
            return 1

        failures = await _apply_missing(sql_repo, missing_rows)
        inserted = len(missing_rows) - failures
        print(f"Inserted rows: {inserted}")
        if failures:
            print(f"Apply completed with {failures} failures.", file=sys.stderr)
            return 1
        print("Apply completed successfully.")
        return 0


async def main(argv: list[str] | None = None) -> int:
    try:
        return await _run(argv)
    finally:
        await close_engine()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

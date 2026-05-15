#!/usr/bin/env python3
"""Smoke test: connect to local Postgres and verify all 5 SQL repos can list rows.

Usage:
    DATABASE_URL=postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs \\
        uv run python scripts/smoke_test_postgres.py
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.repos.sql.brew_log import SqlBrewLogRepo
from app.repos.sql.catalog import SqlCatalogRepo
from app.repos.sql.hardware import SqlHardwareRepo
from app.repos.sql.inventory import SqlInventoryRepo
from app.repos.sql.maintenance import SqlMaintenanceRepo


async def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is required", file=sys.stderr)
        sys.exit(2)

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)  # type: ignore[call-overload]

    results: list[tuple[str, str, int | str]] = []

    async with async_session() as session:
        repos: list[tuple[str, object]] = [
            ("SqlBrewLogRepo", SqlBrewLogRepo(session)),
            ("SqlCatalogRepo", SqlCatalogRepo(session)),
            ("SqlInventoryRepo", SqlInventoryRepo(session)),
            ("SqlHardwareRepo", SqlHardwareRepo(session)),
            ("SqlMaintenanceRepo", SqlMaintenanceRepo(session)),
        ]

        for name, repo in repos:
            try:
                rows = await repo.list()  # type: ignore[union-attr]
                count = len(rows)
                status = "PASS"
                results.append((name, status, count))
            except Exception as exc:
                results.append((name, "FAIL", str(exc)))

    await engine.dispose()

    print("\n── SMOKE TEST SUMMARY ──────────────────────────────────────────────")
    all_pass = True
    for name, status, info in results:
        if status == "FAIL":
            all_pass = False
            print(f"  {name}: {status} — {info}")
        else:
            count = info
            row_status = f"{count} rows"
            if isinstance(count, int) and count == 0:
                row_status += " ⚠️  (0 rows — expected data if migration ran)"
            print(f"  {name}: {status} — {row_status}")
    print("────────────────────────────────────────────────────────────────────")
    if all_pass:
        print("SMOKE TEST PASSED ✓")
    else:
        print("SMOKE TEST FAILED ✗")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

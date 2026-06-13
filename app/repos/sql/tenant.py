"""Tenant helpers for SQL repositories under strict Postgres RLS."""

from __future__ import annotations

from dataclasses import dataclass
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement


def parse_uuid(val: Any) -> uuid.UUID | None:
    if val in (None, ""):
        return None
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


async def current_household_id(db: AsyncSession) -> uuid.UUID | None:
    result = await db.execute(text("SELECT current_setting('app.current_household_id', true)"))
    return parse_uuid(result.scalar_one_or_none())


async def row_household_id_or_context(db: AsyncSession, row: dict[str, Any]) -> uuid.UUID | None:
    return parse_uuid(
        row.get("household_id") or row.get("Household_ID")
    ) or await current_household_id(db)


class NoActiveHouseholdContextError(RuntimeError):
    """Raised when a tenant-scoped read tries to build a predicate without context."""


@dataclass(frozen=True)
class HouseholdReadScope:
    """Fail-closed read scope for app-layer tenant filtering."""

    household_id: uuid.UUID | None
    _predicate: ColumnElement[bool] | None

    @property
    def has_context(self) -> bool:
        """True when an active household context was available for this read."""
        return self.household_id is not None

    def require_predicate(self) -> ColumnElement[bool]:
        """Return the tenant predicate, or fail loudly instead of allowing unscoped reads."""
        if self._predicate is None:
            raise NoActiveHouseholdContextError(
                "No active household context for tenant-scoped read"
            )
        return self._predicate


async def household_read_scope(db: AsyncSession, model: type[Any]) -> HouseholdReadScope:
    """Return a household predicate for *model*, or a no-context signal.

    Callers must return an empty/not-found result when ``has_context`` is false;
    ``require_predicate()`` raises so missing context cannot silently become an
    unfiltered query.
    """
    household_id = await current_household_id(db)
    if household_id is None:
        return HouseholdReadScope(household_id=None, _predicate=None)
    return HouseholdReadScope(
        household_id=household_id,
        _predicate=getattr(model, "household_id") == household_id,
    )


async def assert_runtime_rls(db: AsyncSession) -> None:
    """Fail startup/readiness when the Postgres runtime role can bypass tenant RLS."""
    role_result = await db.execute(
        text(
            """
            SELECT rolsuper, rolbypassrls
            FROM pg_roles
            WHERE rolname = current_user
            """
        )
    )
    role = role_result.one_or_none()
    if role is None or bool(role.rolsuper) or bool(role.rolbypassrls):
        raise RuntimeError("Unsafe database runtime role: superuser and BYPASSRLS are not allowed")

    required_tables = {"brew_log", "catalog", "inventory_bags", "hardware", "maintenance_log"}
    table_result = await db.execute(
        text(
            """
            SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = current_schema()
              AND c.relkind = 'r'
              AND c.relname IN ('brew_log', 'catalog', 'inventory_bags', 'hardware', 'maintenance_log')
            """
        )
    )
    flags = {
        row.relname: (bool(row.relrowsecurity), bool(row.relforcerowsecurity))
        for row in table_result.all()
    }
    missing = required_tables.difference(flags)
    unsafe = sorted(
        name for name, (rls_enabled, force_rls) in flags.items() if not rls_enabled or not force_rls
    )
    if missing or unsafe:
        raise RuntimeError(
            "Unsafe tenant RLS configuration for required tables: "
            "RLS and FORCE RLS must both be enabled"
        )

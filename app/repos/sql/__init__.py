"""SQL-backed repository implementations for M2 dual-write shadow.

Each class mirrors the write interface of its Sheets counterpart.
Reads are not implemented — the Sheets repos remain the read source
of truth through M3.
"""

from app.repos.sql.brew_log import SqlBrewLogRepo
from app.repos.sql.catalog import SqlCatalogRepo
from app.repos.sql.hardware import SqlHardwareRepo
from app.repos.sql.inventory import SqlInventoryRepo
from app.repos.sql.maintenance import SqlMaintenanceRepo

__all__ = [
    "SqlCatalogRepo",
    "SqlBrewLogRepo",
    "SqlInventoryRepo",
    "SqlHardwareRepo",
    "SqlMaintenanceRepo",
]

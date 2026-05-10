"""Tests for the 5 household-scoped entity ORM models.

Unit tests — no database connection required.
Verifies that each entity model declares household_id and uses the correct table name.
"""

from __future__ import annotations

import pytest

from app.models.brew_log import BrewLog
from app.models.catalog import CatalogBean
from app.models.hardware import Hardware
from app.models.inventory import InventoryBag
from app.models.maintenance import MaintenanceLog

ENTITY_MODELS = [
    (CatalogBean, "catalog"),
    (BrewLog, "brew_log"),
    (InventoryBag, "inventory_bags"),
    (Hardware, "hardware"),
    (MaintenanceLog, "maintenance_log"),
]


@pytest.mark.parametrize("model_cls, expected_tablename", ENTITY_MODELS)
def test_entity_table_name(model_cls, expected_tablename: str) -> None:
    assert model_cls.__tablename__ == expected_tablename


@pytest.mark.parametrize("model_cls, _", ENTITY_MODELS)
def test_entity_has_household_id(model_cls, _) -> None:
    assert "household_id" in model_cls.__table__.columns.keys()


def test_catalog_bean_required_columns() -> None:
    cols = set(CatalogBean.__table__.columns.keys())
    assert {"id", "household_id", "roaster", "bean_name", "created_at"}.issubset(cols)


def test_brew_log_has_catalog_fk() -> None:
    fks = {fk.target_fullname for fk in BrewLog.__table__.foreign_keys}
    assert "catalog.id" in fks


def test_inventory_bag_has_catalog_fk() -> None:
    fks = {fk.target_fullname for fk in InventoryBag.__table__.foreign_keys}
    assert "catalog.id" in fks


def test_maintenance_log_has_hardware_fk() -> None:
    fks = {fk.target_fullname for fk in MaintenanceLog.__table__.foreign_keys}
    assert "hardware.id" in fks

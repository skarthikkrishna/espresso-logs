"""Cache-behaviour tests for MaintenanceRepo."""

from __future__ import annotations

import pytest

from app.repos.base import TTLCache
from app.repos.maintenance import MaintenanceRepo
from tests.doubles import FakeSheetsClient

MAINT_ROWS = [
    {
        "Maintenance_ID": "MNT001",
        "Hardware_ID": "M01",
        "Date": "2025-01-10",
        "Action_Type": "Backflush",
        "Notes": "",
    },
    {
        "Maintenance_ID": "MNT002",
        "Hardware_ID": "G01",
        "Date": "2025-01-11",
        "Action_Type": "Calibration",
        "Notes": "",
    },
]


@pytest.fixture
def fake_client():
    client = FakeSheetsClient()
    client.seed("Maintenance", MAINT_ROWS)
    return client


@pytest.fixture
def cache():
    return TTLCache(ttl=60.0)


@pytest.fixture
def repo(fake_client, cache):
    return MaintenanceRepo(client=fake_client, cache=cache)


def test_list_populates_cache(repo, fake_client):
    rows = repo.list()
    assert len(rows) == 2
    assert fake_client.call_count("get_all_records") == 1
    repo.list()
    assert fake_client.call_count("get_all_records") == 1


def test_list_hardware_filter_uses_cache(repo, fake_client):
    repo.list()
    events = repo.list(hardware_id="M01")
    assert len(events) == 1
    assert events[0]["Maintenance_ID"] == "MNT001"
    assert fake_client.call_count("get_all_records") == 1


def test_get_uses_cache(repo, fake_client):
    repo.list()
    item = repo.get("MNT002")
    assert item is not None
    assert item["Hardware_ID"] == "G01"
    assert fake_client.call_count("get_all_records") == 1


def test_get_unknown_id_returns_none(repo):
    assert repo.get("MNT999") is None


def test_add_invalidates_cache(repo, fake_client):
    repo.list()
    repo.add(
        {
            "Maintenance_ID": "MNT003",
            "Hardware_ID": "M01",
            "Date": "2025-02-01",
            "Action_Type": "Descale",
            "Notes": "",
        }
    )
    repo.list()
    assert fake_client.call_count("get_all_records") == 2


def test_add_many_invalidates_cache(repo, fake_client):
    repo.list()
    repo.add_many(
        [
            {
                "Maintenance_ID": "MNT004",
                "Hardware_ID": "G01",
                "Date": "2025-03-01",
                "Action_Type": "Burr clean",
                "Notes": "",
            }
        ]
    )
    repo.list()
    assert fake_client.call_count("get_all_records") == 2


def test_delete_rows_invalidates_cache(repo, fake_client):
    repo.list()
    repo.delete_rows(2, 2)
    repo.list()
    assert fake_client.call_count("get_all_records") == 2

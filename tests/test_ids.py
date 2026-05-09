"""
Tests for app/services/ids.py.

Covers all generators, all 5 roast_level_code values, collision suffixing,
and malformed-ID guard in make_maintenance_id.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.services.ids import (
    make_inventory_id,
    make_maintenance_id,
    make_shot_id,
    roast_level_code,
    roaster_code,
)


# ---------------------------------------------------------------------------
# roaster_code
# ---------------------------------------------------------------------------


def test_roaster_code_single_word():
    assert roaster_code("Verve") == "Ve"


def test_roaster_code_multi_word():
    # Only first word, first 2 chars, title-cased
    assert roaster_code("Chromatic Coffee") == "Ch"


def test_roaster_code_short_word():
    # First word has < 2 chars — returns what's available
    assert roaster_code("A Roaster") == "A"


def test_roaster_code_leading_whitespace():
    assert roaster_code("  Verve  Coffee") == "Ve"


# ---------------------------------------------------------------------------
# roast_level_code — all 5 canonical values
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "level,expected",
    [
        ("Light", "L"),
        ("Light / Medium", "LM"),
        ("Medium", "M"),
        ("Medium / Dark", "MD"),
        ("Dark", "D"),
    ],
)
def test_roast_level_code_canonical(level: str, expected: str):
    assert roast_level_code(level) == expected


def test_roast_level_code_unknown_raises():
    with pytest.raises(ValueError, match="Unknown roast level"):
        roast_level_code("Extra Dark")


# ---------------------------------------------------------------------------
# make_shot_id
# ---------------------------------------------------------------------------

_TEST_DATE = date(2025, 4, 29)


def test_make_shot_id_first_shot_of_day():
    shot_id = make_shot_id(_TEST_DATE, "Ve20250201M", [])
    assert shot_id == "SH-20250429-01"


def test_make_shot_id_second_shot_same_day():
    existing = ["SH-20250429-01"]
    shot_id = make_shot_id(_TEST_DATE, "Ve20250201M", existing)
    assert shot_id == "SH-20250429-02"


def test_make_shot_id_collisions_across_bags():
    # Sequence is global per day (not per bag)
    existing = ["SH-20250429-01", "SH-20250429-02", "SH-20250429-03"]
    shot_id = make_shot_id(_TEST_DATE, "AnyBag", existing)
    assert shot_id == "SH-20250429-04"


def test_make_shot_id_different_date_ignored():
    # IDs from a different date don't count toward today's sequence
    existing = ["SH-20250428-01", "SH-20250428-02"]
    shot_id = make_shot_id(_TEST_DATE, "Ve20250201M", existing)
    assert shot_id == "SH-20250429-01"


def test_make_shot_id_format_padding():
    existing = [f"SH-20250429-{i:02d}" for i in range(1, 10)]
    shot_id = make_shot_id(_TEST_DATE, "bag", existing)
    assert shot_id == "SH-20250429-10"


# ---------------------------------------------------------------------------
# make_inventory_id
# ---------------------------------------------------------------------------

_ROAST_DATE = date(2025, 2, 1)


def test_make_inventory_id_basic():
    bid = make_inventory_id("Verve", _ROAST_DATE, "Medium", [])
    assert bid == "Ve20250201M"


def test_make_inventory_id_collision_suffix():
    existing = ["Ve20250201M"]
    bid = make_inventory_id("Verve", _ROAST_DATE, "Medium", existing)
    assert bid == "Ve20250201M-2"


def test_make_inventory_id_multiple_collisions():
    existing = ["Ve20250201M", "Ve20250201M-2", "Ve20250201M-3"]
    bid = make_inventory_id("Verve", _ROAST_DATE, "Medium", existing)
    assert bid == "Ve20250201M-4"


def test_make_inventory_id_light_medium():
    bid = make_inventory_id("Chromatic", _ROAST_DATE, "Light / Medium", [])
    assert bid == "Ch20250201LM"


def test_make_inventory_id_dark():
    bid = make_inventory_id("Blue Bottle", _ROAST_DATE, "Dark", [])
    assert bid == "Bl20250201D"


# ---------------------------------------------------------------------------
# make_maintenance_id
# ---------------------------------------------------------------------------


def test_make_maintenance_id_empty():
    assert make_maintenance_id([]) == "MNT001"


def test_make_maintenance_id_sequential():
    existing = ["MNT001", "MNT002"]
    assert make_maintenance_id(existing) == "MNT003"


def test_make_maintenance_id_gap_in_sequence():
    # Should find the *highest* and add 1, not just count
    existing = ["MNT001", "MNT005"]
    assert make_maintenance_id(existing) == "MNT006"


def test_make_maintenance_id_ignores_malformed():
    # Malformed IDs must not be counted
    existing = ["MNT001", "MNT-002", "MAINT003", "MNT", "MNT00X"]
    assert make_maintenance_id(existing) == "MNT002"


def test_make_maintenance_id_padding():
    existing = [f"MNT{i:03d}" for i in range(1, 100)]
    assert make_maintenance_id(existing) == "MNT100"

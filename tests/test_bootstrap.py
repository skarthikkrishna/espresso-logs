"""
Phase 8 — Bootstrap Import Wizard unit tests.

All tests are offline: FakeSheetsClient for repos, inline FakeLLMClient for LLM.
Run with: SPREADSHEET_ID=dummy uv run pytest tests/test_bootstrap.py -v
"""
from __future__ import annotations

import io
import json
from dataclasses import asdict
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import openpyxl
import pytest

from app.services.importer import (
    ImportParseError,
    ImportState,
    KNOWN_ENUM_MAPS,
    CANONICAL_COLUMNS,
    build_batch_mapping_prompt,
    build_mapping_prompt,
    find_enum_divergences,
    migrate_grinder_calibration_row,
    normalize_brew_log_row,
    normalize_catalog_row,
    normalize_hardware_row,
    normalize_inventory_row,
    parse_batch_mapping_response,
    parse_legacy_csv,
    parse_mapping_response,
    parse_xlsx_to_sections,
)
from app.services.image_sourcer import source_bean_image
from app.repos.brew_log import BrewLogRepo
from app.repos.catalog import CatalogRepo
from app.repos.hardware import HardwareRepo
from app.repos.inventory import InventoryRepo
from app.repos.maintenance import MaintenanceRepo
from tests.doubles import FakeSheetsClient

FIXTURE_CSV = (Path(__file__).parent / "fixtures" / "legacy_sample.csv").read_text()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class FakeLLMClient:
    """Returns '{"mapping": {}}' — operator must manually confirm all columns."""

    async def complete(self, prompt: str) -> str:
        return '{"mapping": {}}'


def _identity_mapping(rows: list[dict]) -> dict[str, str | None]:
    """Map each column to itself (simulates a perfect LLM response)."""
    if not rows:
        return {}
    return {col: col for col in rows[0].keys()}


# ---------------------------------------------------------------------------
# T001–T008: pure function tests
# ---------------------------------------------------------------------------


def test_parse_legacy_csv_sections():
    """T001: parse_legacy_csv returns all 5 sections with correct row counts."""
    sections = parse_legacy_csv(FIXTURE_CSV)
    assert len(sections) == 5
    assert len(sections["Brew_Log"]) == 30
    assert len(sections["Grinder_Calibration"]) == 3
    assert len(sections["Hardware"]) == 4


def test_parse_legacy_csv_missing_section():
    """T002: CSV without ##Brew_Log section raises ImportParseError."""
    csv_no_brew = "##Catalog\nCatalog_ID\nCAT100\n"
    with pytest.raises(ImportParseError, match="Required section Brew_Log is missing"):
        parse_legacy_csv(csv_no_brew)


def test_brew_log_has_calibration_id_column():
    """T003: Legacy parsed Brew_Log data contains Calibration_ID key."""
    sections = parse_legacy_csv(FIXTURE_CSV)
    assert "Calibration_ID" in sections["Brew_Log"][0]


def test_brew_log_has_flavor_compass_column():
    """T004: Legacy parsed Brew_Log data contains Flavor_Compass key."""
    sections = parse_legacy_csv(FIXTURE_CSV)
    assert "Flavor_Compass" in sections["Brew_Log"][0]


def test_normalize_brew_log_row_discards_calibration_id():
    """T005: normalize_brew_log_row drops Calibration_ID when mapped to None."""
    result = normalize_brew_log_row(
        {"Calibration_ID": "CAL_01", "Date": "2025-01-01", "Shot_ID": "SH-001"},
        {"Calibration_ID": None, "Date": "Date", "Shot_ID": "Shot_ID"},
        {},
    )
    assert "Calibration_ID" not in result


def test_normalize_brew_log_row_discards_flavor_compass():
    """T006: normalize_brew_log_row drops Flavor_Compass when mapped to None."""
    result = normalize_brew_log_row(
        {"Flavor_Compass": "Fruity", "Date": "2025-01-01"},
        {"Flavor_Compass": None, "Date": "Date"},
        {},
    )
    assert "Flavor_Compass" not in result


def test_normalize_brew_log_row_date_format():
    """T007: MM/DD/YYYY date is normalized to YYYY-MM-DD."""
    result = normalize_brew_log_row(
        {"Date": "05/04/2025"},
        {"Date": "Date"},
        {},
    )
    assert result["Date"] == "2025-05-04"


def test_known_enum_maps_shot_eligibility():
    """T008: KNOWN_ENUM_MAPS maps legacy Shot_Eligibility values correctly."""
    assert KNOWN_ENUM_MAPS["Shot_Eligibility"]["OK with Milk"] == "Passable"
    assert KNOWN_ENUM_MAPS["Shot_Eligibility"]["Passable Espresso"] == "Passable"
    assert KNOWN_ENUM_MAPS["Shot_Eligibility"]["Good"] == "Good Espresso"


# ---------------------------------------------------------------------------
# T009–T016: enums, migration, repos, rollback
# ---------------------------------------------------------------------------


def test_known_enum_maps_taste_summary():
    """T009: KNOWN_ENUM_MAPS maps legacy Taste_Summary values correctly."""
    assert KNOWN_ENUM_MAPS["Taste_Summary"]["Weak and Sour"] == "Weak & Sour"
    assert KNOWN_ENUM_MAPS["Taste_Summary"]["Too acidic"] == "Acidic & Bright"
    assert KNOWN_ENUM_MAPS["Taste_Summary"]["Too bitter"] == "Harsh & Bitter"


def test_find_enum_divergences_unmapped_values():
    """T010: find_enum_divergences detects all 4 unmapped Taste_Summary values from fixture."""
    sections = parse_legacy_csv(FIXTURE_CSV)
    mapping = _identity_mapping(sections["Brew_Log"])
    result = find_enum_divergences(sections["Brew_Log"], mapping)

    assert "Taste_Summary" in result
    divergences = result["Taste_Summary"]
    # These 4 are NOT in KNOWN_ENUM_MAPS and NOT canonical
    assert "Balanced and Sour" in divergences
    assert "Balanced and Bitter" in divergences
    assert "Strong and Neutral" in divergences
    assert "Strong and Bitter" in divergences
    # These ARE in KNOWN_ENUM_MAPS — should NOT appear
    assert "Too acidic" not in divergences
    assert "Weak and Sour" not in divergences


def test_migrate_grinder_calibration_row():
    """T011: migrate_grinder_calibration_row converts CAL row to MNT Maintenance row."""
    result = migrate_grinder_calibration_row(
        {"Cal_ID": "CAL_01", "Grinder_ID": "G01", "Date": "2025-04-25", "Notes": "Initial"},
        1,
    )
    assert result == {
        "Maintenance_ID": "MNT001",
        "Hardware_ID": "G01",
        "Date": "2025-04-25",
        "Action_Type": "Re-zero",
        "Notes": "Initial",
    }


def test_migrate_all_three_cal_rows():
    """T012: All 3 Grinder_Calibration rows migrate to MNT001, MNT002, MNT003."""
    sections = parse_legacy_csv(FIXTURE_CSV)
    outputs = [
        migrate_grinder_calibration_row(row, i + 1)
        for i, row in enumerate(sections["Grinder_Calibration"])
    ]
    assert [r["Maintenance_ID"] for r in outputs] == ["MNT001", "MNT002", "MNT003"]


def test_normalize_catalog_roast_level():
    """T013: normalize_catalog_row maps Medium-Dark → Medium / Dark."""
    result = normalize_catalog_row(
        {
            "Catalog_ID": "CAT107",
            "Roast_Level": "Medium-Dark",
            "Roaster": "Olympia",
            "Bean_Name": "Redbird",
        },
        {
            "Catalog_ID": "Catalog_ID",
            "Roast_Level": "Roast_Level",
            "Roaster": "Roaster",
            "Bean_Name": "Bean_Name",
        },
        {},
    )
    assert result["Roast_Level"] == "Medium / Dark"


def test_normalize_inventory_row_roast_level():
    """T013b: normalize_inventory_row maps RoastLevel Medium-Dark → Medium / Dark."""
    result = normalize_inventory_row(
        {
            "Bag_ID": "Ol20250615M",
            "RoastLevel": "Medium-Dark",
            "Beans": "Olympia",
            "RoastDate": "2025-06-15",
            "Display_Name": "Olympia Morning Sun",
            "Catalog_ID": "CAT111",
            "Status": "Active",
        },
        {
            "Bag_ID": "Bag_ID",
            "RoastLevel": "RoastLevel",
            "Beans": "Beans",
            "RoastDate": "RoastDate",
            "Display_Name": "Display_Name",
            "Catalog_ID": "Catalog_ID",
            "Status": "Status",
        },
        {},
    )
    assert result["RoastLevel"] == "Medium / Dark"


def test_add_many_brew_log_atomic():
    """T014: add_many appends all rows in one append_rows call."""
    fake = FakeSheetsClient(initial={"Brew_Log": [{c: "x" for c in BrewLogRepo.COLUMNS}]})
    repo = BrewLogRepo(fake)
    repo.add_many([{c: "y" for c in BrewLogRepo.COLUMNS}])
    assert fake.append_rows_call_counts.get("Brew_Log", 0) == 1
    assert len(fake.get_all_records("Brew_Log")) == 2


def test_commit_rollback_on_error():
    """T015: On mid-batch API error, previously written tabs are rolled back."""
    import gspread.exceptions

    call_count = {"n": 0}

    class _FakeResponse:
        status_code = 500
        text = "Internal Server Error"

        def json(self) -> dict:
            return {}

    class ErrorOnThirdCallClient(FakeSheetsClient):
        def append_rows(self, tab: str, values: list[list]) -> None:
            call_count["n"] += 1
            if call_count["n"] >= 3:
                raise gspread.exceptions.APIError(response=_FakeResponse())
            super().append_rows(tab, values)

    fake = ErrorOnThirdCallClient()

    hw_repo = HardwareRepo(fake)
    cat_repo = CatalogRepo(fake)
    inv_repo = InventoryRepo(fake)
    bl_repo = BrewLogRepo(fake)
    mnt_repo = MaintenanceRepo(fake)

    dry_run = {
        "Hardware":    [{c: "v" for c in HardwareRepo.COLUMNS}],
        "Catalog":     [{c: "v" for c in CatalogRepo.COLUMNS}],
        "Inventory":   [{c: "v" for c in InventoryRepo.COLUMNS}],
        "Brew_Log":    [{c: "v" for c in BrewLogRepo.COLUMNS}],
        "Maintenance": [{c: "v" for c in MaintenanceRepo.COLUMNS}],
    }

    tab_repo_map = [
        ("Hardware", hw_repo),
        ("Catalog", cat_repo),
        ("Inventory", inv_repo),
        ("Brew_Log", bl_repo),
        ("Maintenance", mnt_repo),
    ]
    written_tabs: list[tuple[str, int, int]] = []

    try:
        for tab_name, repo in tab_repo_map:
            rows = dry_run.get(tab_name, [])
            if not rows:
                continue
            existing_count = len(repo._client.get_all_records(repo.TAB))
            start_row = existing_count + 2
            repo.add_many(rows)
            end_row = start_row + len(rows) - 1
            written_tabs.append((tab_name, start_row, end_row))
    except Exception:
        for tab_name, start, end in reversed(written_tabs):
            repo_for_tab = dict(tab_repo_map)[tab_name]
            try:
                repo_for_tab.delete_rows(start, end)
            except Exception:
                pass

    # Error occurs on 3rd append_rows call (Inventory), so Hardware and Catalog
    # were written then rolled back
    assert fake.get_all_records("Hardware") == []
    assert fake.get_all_records("Catalog") == []


def test_dry_run_matches_commit():
    """T016: Full fixture commit via FakeSheetsClient produces exact row counts."""
    sections = parse_legacy_csv(FIXTURE_CSV)

    column_mappings = {
        name: _identity_mapping(rows)
        for name, rows in sections.items()
        if name != "Grinder_Calibration"
    }

    normalize_map = {
        "Brew_Log":  normalize_brew_log_row,
        "Catalog":   normalize_catalog_row,
        "Hardware":  normalize_hardware_row,
        "Inventory": normalize_inventory_row,
    }
    dry_run: dict[str, list[dict]] = {}
    for section_name, rows in sections.items():
        if section_name == "Grinder_Calibration":
            continue
        norm_fn = normalize_map.get(section_name)
        if norm_fn is None:
            continue
        mapping = column_mappings.get(section_name, {})
        dry_run[section_name] = [norm_fn(row, mapping, {}) for row in rows]

    cal_rows = sections.get("Grinder_Calibration", [])
    if cal_rows:
        dry_run["Maintenance"] = [
            migrate_grinder_calibration_row(row, i + 1)
            for i, row in enumerate(cal_rows)
        ]

    fake = FakeSheetsClient()
    hw_repo = HardwareRepo(fake)
    cat_repo = CatalogRepo(fake)
    inv_repo = InventoryRepo(fake)
    bl_repo = BrewLogRepo(fake)
    mnt_repo = MaintenanceRepo(fake)

    tab_repo_map = [
        ("Hardware", hw_repo),
        ("Catalog", cat_repo),
        ("Inventory", inv_repo),
        ("Brew_Log", bl_repo),
        ("Maintenance", mnt_repo),
    ]

    for tab_name, repo in tab_repo_map:
        rows = dry_run.get(tab_name, [])
        if rows:
            repo.add_many(rows)

    assert len(fake.get_all_records("Hardware")) == 4
    assert len(fake.get_all_records("Catalog")) == 10
    assert len(fake.get_all_records("Inventory")) == 9
    assert len(fake.get_all_records("Brew_Log")) == 30
    assert len(fake.get_all_records("Maintenance")) == 3


# ---------------------------------------------------------------------------
# T009-extra through T011-extra (from F-003/F-010/F-011 analysis fixes)
# ---------------------------------------------------------------------------


def test_build_mapping_prompt_fits_1024_bytes():
    """T009-extra: build_mapping_prompt output is <=1024 bytes encoded (Hardware — 3 cols)."""
    sections = parse_legacy_csv(FIXTURE_CSV)
    hw_rows = sections["Hardware"]
    prompt = build_mapping_prompt(
        "Hardware",
        list(hw_rows[0].keys()),
        CANONICAL_COLUMNS["Hardware"],
        hw_rows[:3],
    )
    assert len(prompt.encode("utf-8")) <= 1024


def test_parse_mapping_response_invalid_json():
    """T010-extra: parse_mapping_response returns {} on malformed JSON."""
    assert parse_mapping_response("not json") == {}
    assert parse_mapping_response('{"wrong_key": {}}') == {}
    assert parse_mapping_response("") == {}


def test_build_batch_mapping_prompt_contains_all_sections():
    """Batch prompt includes all non-Grinder_Calibration sections."""
    sections = parse_legacy_csv(FIXTURE_CSV)
    prompt = build_batch_mapping_prompt(sections)
    for section in ("Catalog", "Inventory", "Hardware", "Brew_Log"):
        assert section in prompt
    assert "Grinder_Calibration" not in prompt


def test_parse_batch_mapping_response_valid():
    """parse_batch_mapping_response extracts per-section mappings from valid JSON."""
    sections = {"Catalog": [{"Roaster": "Blue Bottle", "Name": "Ethiopia"}]}
    llm_json = json.dumps({
        "sections": {
            "Catalog": {"mapping": {"Roaster": "Roaster", "Name": "Bean_Name"}}
        }
    })
    result = parse_batch_mapping_response(llm_json, sections)
    assert result["Catalog"] == {"Roaster": "Roaster", "Name": "Bean_Name"}


def test_parse_batch_mapping_response_fallback_on_bad_json():
    """parse_batch_mapping_response identity-maps on malformed JSON."""
    sections = {"Brew_Log": [{"Date": "2025-01-01", "Bag": "B01"}]}
    result = parse_batch_mapping_response("not json", sections)
    # Should fall back to identity mapping
    assert result["Brew_Log"] == {"Date": "Date", "Bag": "Bag"}


def test_parse_batch_mapping_response_missing_section_fallback():
    """parse_batch_mapping_response identity-maps sections absent from LLM response."""
    sections = {
        "Catalog": [{"Roaster": "Onyx", "Name": "Colombia"}],
        "Hardware": [{"ID": "M01", "Type": "Machine"}],
    }
    llm_json = json.dumps({
        "sections": {
            "Catalog": {"mapping": {"Roaster": "Roaster", "Name": "Bean_Name"}}
            # Hardware is missing from LLM response
        }
    })
    result = parse_batch_mapping_response(llm_json, sections)
    assert result["Catalog"]["Roaster"] == "Roaster"
    assert result["Hardware"] == {"ID": "ID", "Type": "Type"}  # identity fallback


def test_import_state_json_roundtrip():
    """T011-extra: ImportState survives JSON serialization round-trip."""
    s = ImportState(
        sections={"Brew_Log": [{"Date": "2025-01-01"}]},
        column_mappings={"Brew_Log": {"Date": "Date"}},
        enum_divergences={"Taste_Summary": ["Balanced and Sour"]},
        confirmed_enum_maps={"Taste_Summary": {"Balanced and Sour": "Acidic & Bright"}},
        dry_run_preview={"Brew_Log": [{"Date": "2025-01-01"}]},
    )
    serialized = json.dumps(asdict(s))
    s2 = ImportState(**json.loads(serialized))
    assert s2.sections == s.sections
    assert s2.column_mappings == s.column_mappings
    assert s2.enum_divergences == s.enum_divergences
    assert s2.confirmed_enum_maps == s.confirmed_enum_maps
    assert s2.dry_run_preview == s.dry_run_preview


# ── XLSX parser tests ────────────────────────────────────────────────────────

class TestParseXlsxToSections:
    """Unit tests for parse_xlsx_to_sections using the real fixture."""

    @pytest.fixture(scope="class")
    def xlsx_raw(self):
        p = Path(__file__).parent / "fixtures" / "legacy_sample.xlsx"
        return p.read_bytes()

    @pytest.fixture(scope="class")
    def sections(self, xlsx_raw):
        return parse_xlsx_to_sections(xlsx_raw)

    def test_all_expected_sheets_present(self, sections):
        assert set(sections) == {"Brew_Log", "Catalog", "Inventory", "Hardware", "Grinder_Calibration"}

    def test_brew_log_row_count(self, sections):
        assert len(sections["Brew_Log"]) == 60

    def test_catalog_row_count(self, sections):
        assert len(sections["Catalog"]) == 15

    def test_inventory_row_count(self, sections):
        assert len(sections["Inventory"]) == 16

    def test_hardware_row_count(self, sections):
        assert len(sections["Hardware"]) == 4

    def test_grinder_calibration_row_count(self, sections):
        assert len(sections["Grinder_Calibration"]) == 3

    def test_no_empty_column_keys(self, sections):
        """Trailing empty AppSheet columns must be stripped."""
        for name, rows in sections.items():
            for row in rows:
                assert "" not in row, f"Empty key in {name} row: {row}"

    def test_brew_log_float_normalised_to_int(self, sections):
        """Whole-number floats (17.0) must be normalised to integer strings ('17')."""
        row = sections["Brew_Log"][0]
        assert row["Dose_In_g"] == "17", f"Expected '17', got {row['Dose_In_g']!r}"
        assert row["Yield_Out_g"] == "43"
        assert row["Time_Sec"] == "32"

    def test_brew_log_decimal_preserved(self, sections):
        """Non-integer decimals must not be truncated (18.75 stays 18.75)."""
        row = sections["Brew_Log"][0]
        assert row["Grind_Setting"] == "18.75"

    def test_brew_log_has_canonical_adjacent_columns(self, sections):
        """Brew_Log should have Date, Bag_ID, Machine_ID at minimum."""
        row = sections["Brew_Log"][0]
        assert row["Date"] == "05/04/2025"
        assert row["Bag_ID"] == "En20250415L"
        assert row["Machine_ID"] == "M01"

    def test_catalog_local_image_path_is_legacy_appsheet_path(self, sections):
        """Local_Image_Path in the raw fixture is an AppSheet path (not a web URL)."""
        row = sections["Catalog"][0]
        assert row["Local_Image_Path"].startswith("Images/"), (
            f"Expected AppSheet local path, got: {row['Local_Image_Path']!r}"
        )

    def test_missing_brew_log_sheet_raises(self):
        """XLSX without Brew_Log sheet must raise ImportParseError."""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Catalog"
        ws.append(["Catalog_ID", "Roaster"])
        ws.append(["CAT100", "Verve"])
        buf = io.BytesIO()
        wb.save(buf)
        with pytest.raises(ImportParseError, match="Brew_Log"):
            parse_xlsx_to_sections(buf.getvalue())

    def test_empty_workbook_raises(self):
        """Empty/invalid XLSX bytes must raise ImportParseError."""
        with pytest.raises(ImportParseError):
            parse_xlsx_to_sections(b"")

    def test_xlsx_sections_match_csv_shape(self, sections):
        """XLSX Brew_Log rows must have the same keys as legacy CSV rows (modulo legacy-only cols)."""
        csv_fixture = Path(__file__).parent / "fixtures" / "legacy_sample.csv"
        csv_content = csv_fixture.read_text()
        csv_sections = parse_legacy_csv(csv_content)
        xlsx_brew_keys = set(sections["Brew_Log"][0].keys())
        csv_brew_keys = set(csv_sections["Brew_Log"][0].keys())
        core = {"Date", "Bag_ID", "Machine_ID", "Grinder_ID", "Dose_In_g", "Yield_Out_g", "Time_Sec"}
        assert core.issubset(xlsx_brew_keys), f"Missing core keys: {core - xlsx_brew_keys}"
        assert core.issubset(csv_brew_keys), f"CSV missing core keys: {core - csv_brew_keys}"


# ── image sourcer tests ──────────────────────────────────────────────────────

class TestSourceBeanImage:
    """Unit tests for AI image sourcing (all network calls mocked)."""

    @pytest.mark.asyncio
    async def test_og_image_returned_when_available(self):
        """Happy path: product URL returns page with og:image."""
        html = '<meta property="og:image" content="https://example.com/bag.jpg">'
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = html

        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(return_value="")

        with patch("app.services.image_sourcer.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await source_bean_image("Verve", "Seabright", "https://vervecoffee.com/seabright", mock_llm)

        assert result == "https://example.com/bag.jpg"
        mock_llm.complete.assert_not_called()

    @pytest.mark.asyncio
    async def test_llm_fallback_when_og_missing(self):
        """When OG image absent, LLM is called and its URL returned."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><title>No og tag</title></html>"

        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(return_value="https://cdn.vervecoffee.com/seabright.jpg")

        with patch("app.services.image_sourcer.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await source_bean_image("Verve", "Seabright", "https://vervecoffee.com/seabright", mock_llm)

        assert result == "https://cdn.vervecoffee.com/seabright.jpg"

    @pytest.mark.asyncio
    async def test_returns_empty_when_network_fails(self):
        """Network error must not raise — returns ''."""
        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(side_effect=Exception("LLM down"))

        with patch("app.services.image_sourcer.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=Exception("network fail"))
            mock_client_cls.return_value = mock_client

            result = await source_bean_image("Verve", "Seabright", "https://broken.com", mock_llm)

        assert result == ""

    @pytest.mark.asyncio
    async def test_llm_none_response_returns_empty(self):
        """LLM returning 'NONE' must yield ''."""
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(return_value="NONE")

        with patch("app.services.image_sourcer.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client_cls.return_value = mock_client

            result = await source_bean_image("Verve", "Seabright", "https://example.com", mock_llm)

        assert result == ""

    @pytest.mark.asyncio
    async def test_empty_product_url_skips_scrape(self):
        """Empty product_url skips the OG scrape step and goes straight to LLM."""
        mock_llm = MagicMock()
        mock_llm.complete = AsyncMock(return_value="https://cdn.example.com/coffee.png")

        with patch("app.services.image_sourcer.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=AssertionError("should not be called"))
            mock_client_cls.return_value = mock_client

            result = await source_bean_image("Verve", "Seabright", "", mock_llm)

        assert result == "https://cdn.example.com/coffee.png"


# ---------------------------------------------------------------------------
# New tests for PR #17 fixes
# ---------------------------------------------------------------------------


class TestHasFreshLocalImagePath:
    """Unit tests for _has_fresh_local_image_path."""

    def test_http_url_is_fresh(self):
        from app.routers.import_wizard import _has_fresh_local_image_path
        assert _has_fresh_local_image_path({"Local_Image_Path": "http://cdn.example.com/bag.jpg"}) is True

    def test_https_url_is_fresh(self):
        from app.routers.import_wizard import _has_fresh_local_image_path
        assert _has_fresh_local_image_path({"Local_Image_Path": "https://cdn.example.com/bag.jpg"}) is True

    def test_appsheet_path_is_stale(self):
        from app.routers.import_wizard import _has_fresh_local_image_path
        assert _has_fresh_local_image_path({"Local_Image_Path": "Images/CAT100.Local_Image_Path.035745.jpg"}) is False

    def test_empty_string_is_stale(self):
        from app.routers.import_wizard import _has_fresh_local_image_path
        assert _has_fresh_local_image_path({"Local_Image_Path": ""}) is False

    def test_none_value_is_stale(self):
        from app.routers.import_wizard import _has_fresh_local_image_path
        assert _has_fresh_local_image_path({"Local_Image_Path": None}) is False

    def test_missing_key_is_stale(self):
        from app.routers.import_wizard import _has_fresh_local_image_path
        assert _has_fresh_local_image_path({}) is False

    def test_whitespace_only_is_stale(self):
        from app.routers.import_wizard import _has_fresh_local_image_path
        assert _has_fresh_local_image_path({"Local_Image_Path": "   "}) is False


class TestIsSafeUrl:
    """Unit tests for _is_safe_url SSRF mitigation."""

    def test_public_https_url_is_safe(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("https://example.com/product") is True

    def test_public_http_url_is_safe(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://example.com/product") is True

    def test_localhost_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://localhost:8080/internal") is False

    def test_127_0_0_1_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://127.0.0.1/secret") is False

    def test_ipv6_loopback_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://[::1]/secret") is False

    def test_gcp_metadata_link_local_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://169.254.169.254/computeMetadata/v1/") is False

    def test_private_rfc1918_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://192.168.1.1/admin") is False

    def test_10_x_x_x_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://10.0.0.1/internal") is False

    def test_dotlocal_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("http://myservice.local/api") is False

    def test_non_http_scheme_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("ftp://example.com/file") is False

    def test_empty_string_is_blocked(self):
        from app.services.image_sourcer import _is_safe_url
        assert _is_safe_url("") is False


# ── missing images wizard step tests ────────────────────────────────────────

class TestMissingImagesStep:
    """Tests for the import wizard missing-images detection and upload step."""

    @pytest.mark.asyncio
    async def test_enrich_catalog_images_stores_bytes_in_tmp(self, tmp_path, monkeypatch):
        """_enrich_catalog_images stores downloaded bytes in tmp bin file."""
        from unittest.mock import AsyncMock, MagicMock, patch
        from app.routers.import_wizard import _enrich_catalog_images, _IMPORT_FILE_PREFIX

        import_id = "test-import-001"
        rows = [{
            "Catalog_ID": "CAT100",
            "Roaster": "Verve",
            "Bean_Name": "Seabright",
            "Product_URL": "",
            "Local_Image_Path": "",
        }]

        async def fake_source(*args, **kwargs):
            return "https://example.com/bag.jpg"

        async def fake_fetch(url):
            return (b"fakeimagedata", "image/jpeg")

        with patch("app.routers.import_wizard.source_bean_image", side_effect=fake_source), \
             patch("app.routers.import_wizard.fetch_image_bytes", side_effect=fake_fetch), \
             patch("app.routers.import_wizard._IMPORT_TMP_DIR", tmp_path):
            result = await _enrich_catalog_images(rows, MagicMock(), import_id)

        bin_path = tmp_path / f"{_IMPORT_FILE_PREFIX}{import_id}_img_CAT100.bin"
        assert bin_path.exists(), "Expected bin file to be written to tmp"
        assert bin_path.read_bytes() == b"fakeimagedata"

    @pytest.mark.asyncio
    async def test_enrich_catalog_images_no_download_on_existing_image(self, tmp_path):
        """_enrich_catalog_images skips rows that already have a valid image URL."""
        from unittest.mock import MagicMock, patch
        from app.routers.import_wizard import _enrich_catalog_images

        rows = [{
            "Catalog_ID": "CAT100",
            "Roaster": "Verve",
            "Bean_Name": "Seabright",
            "Product_URL": "",
            "Local_Image_Path": "https://example.com/already.jpg",
        }]

        with patch("app.routers.import_wizard.source_bean_image") as mock_source:
            result = await _enrich_catalog_images(rows, MagicMock(), "import-002")

        mock_source.assert_not_called()

    def test_fetch_image_bytes_exported_from_image_sourcer(self):
        """fetch_image_bytes is importable from image_sourcer."""
        from app.services.image_sourcer import fetch_image_bytes
        assert callable(fetch_image_bytes)

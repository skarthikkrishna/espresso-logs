"""In-memory Sheets client used when E2E_AUTH_BYPASS=1.

This module lives under app/ so that app/deps.py can import it without
depending on the test tree.  It must never be instantiated in production
(APP_ENV=production raises before this code is reached).

The FakeSheetsClient is also re-exported from tests/doubles.py so that
unit/integration tests continue to import from their canonical location.
"""

from __future__ import annotations


class FakeSheetsClient:
    """In-memory Sheets client.

    * ``get_all_records`` returns deep copies so mutations don't corrupt state.
    * ``call_counts`` / ``append_rows_call_counts`` are spy counters.
    """

    def __init__(self, initial: dict[str, list[dict]] | None = None) -> None:
        self._store: dict[str, list[dict]] = {
            k: [row.copy() for row in v] for k, v in (initial or {}).items()
        }
        self.call_counts: dict[str, int] = {}
        self.append_rows_call_counts: dict[str, int] = {}

    def get_all_records(self, tab: str) -> list[dict]:
        self.call_counts[tab] = self.call_counts.get(tab, 0) + 1
        return [row.copy() for row in self._store.get(tab, [])]

    def append_row(self, tab: str, row: dict, pk_col: str | None = None) -> None:
        if pk_col is not None:
            pk_val = row[pk_col]
            if any(r.get(pk_col) == pk_val for r in self._store.get(tab, [])):
                return
        self._store.setdefault(tab, []).append(row.copy())

    def update_row(self, tab: str, pk_col: str, pk_val: str, row: dict) -> None:
        rows = self._store.get(tab, [])
        headers = list(rows[0].keys()) if rows else list(row.keys())
        for i, r in enumerate(rows):
            if r.get(pk_col) == pk_val:
                rows[i] = {h: row.get(h, "") for h in headers}
                return
        raise KeyError(f"Row with {pk_col}={pk_val!r} not found in {tab}")

    def append_rows(self, tab: str, values: list[list]) -> None:
        self.append_rows_call_counts[tab] = self.append_rows_call_counts.get(tab, 0) + 1
        existing = self._store.get(tab, [])
        if existing:
            headers = list(existing[0].keys())
        else:
            headers = [str(i) for i in range(len(values[0]) if values else 0)]
        for val_row in values:
            row_dict = dict(zip(headers, val_row))
            self._store.setdefault(tab, []).append(row_dict)

    def delete_rows(self, tab: str, start_row: int, end_row: int) -> None:
        data_start = start_row - 2
        data_end = end_row - 2
        rows = self._store.get(tab, [])
        del rows[max(0, data_start) : data_end + 1]

    def seed(self, tab: str, rows: list[dict]) -> None:
        """Overwrite the in-memory store for *tab*."""
        self._store[tab] = [row.copy() for row in rows]

    def call_count(self, method_name: str) -> int:
        if method_name == "get_all_records":
            return sum(self.call_counts.values())
        return 0


# ---------------------------------------------------------------------------
# Seed data — realistic enough for Playwright E2E tests to render pages.
# All IDs use an "E2E_" prefix so any accidental prod leak is identifiable.
# ---------------------------------------------------------------------------

E2E_SEED: dict[str, list[dict]] = {
    "Catalog": [
        {
            "Catalog_ID": "E2E_CAT001",
            "Roaster": "E2E Test Roaster",
            "Bean_Name": "E2E Test Bean",
            "Origin": "Ethiopia",
            "Process": "Washed",
            "Roast_Level": "Medium",
            "Notes": "E2E seed — do not edit",
            "Image_URL": "",
            "Local_Image_Path": "",
        },
        {
            "Catalog_ID": "E2E_CAT002",
            "Roaster": "E2E Second Roaster",
            "Bean_Name": "E2E Decaf Bean",
            "Origin": "Colombia",
            "Process": "Natural",
            "Roast_Level": "Light",
            "Notes": "E2E seed — do not edit",
            "Image_URL": "",
            "Local_Image_Path": "",
        },
    ],
    "Inventory": [
        {
            "Bag_ID": "E2E_BAG001",
            "Catalog_ID": "E2E_CAT001",
            "Beans": "E2E Test Roaster — E2E Test Bean",
            "Roast_Date": "2026-01-01",
            "Roast_Level": "Medium",
            "Storage_Method": "Freezer",
            "Status": "Active",
            "Date_Finished": "",
        },
    ],
    "BrewLog": [
        {
            "Log_ID": "E2E_LOG001",
            "Date": "2026-01-02",
            "Bag_ID": "E2E_BAG001",
            "Beans": "E2E Test Roaster — E2E Test Bean",
            "Dose_g": "18",
            "Yield_g": "36",
            "Time_s": "28",
            "Rating": "4",
            "Notes": "E2E seed",
        },
    ],
    "Hardware": [
        {
            "Hardware_ID": "E2E_HW001",
            "Category": "Machine",
            "Name": "E2E Espresso Machine",
            "Product_URL": "",
            "Local_Image_Path": "",
        },
        {
            "Hardware_ID": "E2E_HW002",
            "Category": "Grinder",
            "Name": "E2E Grinder",
            "Product_URL": "",
            "Local_Image_Path": "",
        },
    ],
    "Maintenance": [],
}


def make_e2e_sheets_client() -> FakeSheetsClient:
    """Return a FakeSheetsClient pre-seeded with E2E test data."""
    return FakeSheetsClient(initial=E2E_SEED)

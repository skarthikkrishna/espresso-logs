"""Test doubles for the coffee_tracker test suite.

This module is the single home for all in-memory / fake implementations used in
tests.  Import test doubles from here rather than from production modules.
"""

from __future__ import annotations


class FakeSheetsClient:
    """In-memory Sheets client for unit tests.

    * ``get_all_records`` returns deep copies so test mutations don't corrupt state.
    * ``call_counts`` is a spy counter incremented on every ``get_all_records`` call.
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
        # Mirror RealSheetsClient: skip write when a row with the same PK already exists.
        if pk_col is not None:
            pk_val = row[pk_col]
            if any(r.get(pk_col) == pk_val for r in self._store.get(tab, [])):
                return
        self._store.setdefault(tab, []).append(row.copy())

    def update_row(self, tab: str, pk_col: str, pk_val: str, row: dict) -> None:
        rows = self._store.get(tab, [])
        # Derive sheet "headers" from the first existing row's keys — mirrors how
        # RealSheetsClient reads the actual header row before writing.  Columns
        # absent from headers are silently dropped (same as production behaviour).
        headers = list(rows[0].keys()) if rows else list(row.keys())
        for i, r in enumerate(rows):
            if r.get(pk_col) == pk_val:
                rows[i] = {h: row.get(h, "") for h in headers}
                return
        raise KeyError(f"Row with {pk_col}={pk_val!r} not found in {tab}")

    def append_rows(self, tab: str, values: list[list]) -> None:
        """Store raw value rows; materialise dicts using existing header order."""
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
        """Remove data rows at 1-indexed positions (row 1 = header, data from row 2)."""
        data_start = start_row - 2
        data_end = end_row - 2
        rows = self._store.get(tab, [])
        del rows[max(0, data_start) : data_end + 1]

    # ------------------------------------------------------------------ #
    # Test-convenience adapters (thin wrappers — do not change above API) #
    # ------------------------------------------------------------------ #

    def seed(self, tab: str, rows: list[dict]) -> None:
        """Overwrite the in-memory store for *tab* with a fresh copy of *rows*."""
        self._store[tab] = [row.copy() for row in rows]

    def call_count(self, method_name: str) -> int:
        """Return total ``get_all_records`` invocations across all tabs.

        Only ``'get_all_records'`` is tracked; any other *method_name* returns 0.
        """
        if method_name == "get_all_records":
            return sum(self.call_counts.values())
        return 0

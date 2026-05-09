"""
Sheets client: protocol, real ADC-authenticated client, and fake in-memory client for tests.

Only this module is allowed to import gspread.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Protocol, runtime_checkable

import gspread
import gspread.exceptions
import google.auth
from google.auth.transport.requests import Request  # noqa: F401 — keeps ADC refresh available

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class SheetsClientProtocol(Protocol):
    """Structural interface satisfied by both RealSheetsClient and FakeSheetsClient."""

    def get_all_records(self, tab: str) -> list[dict]: ...  # noqa: D102

    def append_row(self, tab: str, row: dict, pk_col: str | None = None) -> None: ...  # noqa: D102

    def update_row(self, tab: str, pk_col: str, pk_val: str, row: dict) -> None: ...  # noqa: D102

    def append_rows(self, tab: str, values: list[list]) -> None: ...  # noqa: D102

    def delete_rows(self, tab: str, start_row: int, end_row: int) -> None: ...  # noqa: D102


# ---------------------------------------------------------------------------
# Real client (ADC)
# ---------------------------------------------------------------------------


def _build_spreadsheet(spreadsheet_id: str) -> gspread.Spreadsheet:
    """Authenticate via ADC and open the spreadsheet by key."""
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    gc = gspread.Client(auth=credentials)
    return gc.open_by_key(spreadsheet_id)


_RETRIABLE_STATUSES = frozenset({429, 500, 502, 503, 504})


def _with_retry(fn, max_retries: int = 3):  # type: ignore[no-untyped-def]
    """Execute *fn* with exponential backoff on retriable Sheets API errors.

    Only retries on 429 (rate-limit) and 5xx (server) responses.
    Permanent client errors (400, 403, 404) are raised immediately.
    """
    for attempt in range(1, max_retries + 1):
        try:
            return fn()
        except gspread.exceptions.APIError as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            retriable = status in _RETRIABLE_STATUSES
            if attempt == max_retries or not retriable:
                raise
            logger.warning(
                "Sheets API %s on attempt %d/%d — retrying",
                status,
                attempt,
                max_retries,
            )
            time.sleep(2**attempt)
    return None  # unreachable; silences mypy


class RealSheetsClient:
    """Production Sheets client backed by ADC credentials."""

    def __init__(self, spreadsheet_id: str) -> None:
        self._spreadsheet_id = spreadsheet_id
        self._spreadsheet: gspread.Spreadsheet | None = None
        self._spreadsheet_lock = threading.Lock()
        self._tab_locks: dict[str, threading.Lock] = {}
        self._tab_locks_lock = threading.Lock()

    def _get_spreadsheet(self) -> gspread.Spreadsheet:
        if self._spreadsheet is None:
            with self._spreadsheet_lock:
                if self._spreadsheet is None:
                    self._spreadsheet = _build_spreadsheet(self._spreadsheet_id)
        return self._spreadsheet

    def _get_tab_lock(self, tab: str) -> threading.Lock:
        if tab not in self._tab_locks:
            with self._tab_locks_lock:
                if tab not in self._tab_locks:
                    self._tab_locks[tab] = threading.Lock()
        return self._tab_locks[tab]

    def _worksheet(self, tab: str) -> gspread.Worksheet:
        return _with_retry(lambda: self._get_spreadsheet().worksheet(tab))

    # ------------------------------------------------------------------
    # SheetsClientProtocol implementation
    # ------------------------------------------------------------------

    def get_all_records(self, tab: str) -> list[dict]:
        """Return all rows from *tab* as a list of dicts (header row is the key)."""
        ws = self._worksheet(tab)
        return _with_retry(lambda: ws.get_all_records())  # type: ignore[return-value]

    def append_row(self, tab: str, row: dict, pk_col: str | None = None) -> None:
        """Append *row* to *tab*, writing headers first if the sheet is empty.

        If *pk_col* is provided, retry attempts check whether a row with that
        PK value already exists before writing — skipping the write if found.
        The first attempt always writes; the check only fires on retries so the
        common (success) path pays no extra Sheets API call.  Only the PK column
        is fetched (not all records) to minimise latency and quota usage.

        This guard is appropriate for repos where append is the primary write
        path (e.g. BrewLog).  Simpler repos that only append rarely (Catalog,
        Hardware, Inventory) can pass pk_col=None and rely on their own
        idempotency controls.
        """
        ws = self._worksheet(tab)
        with self._get_tab_lock(tab):
            _first_call = [True]

            def _do_append() -> None:
                if pk_col is not None and not _first_call[0]:
                    # Only check on retries — first attempt writes unconditionally
                    pk_val = row[pk_col]
                    headers = ws.row_values(1)
                    if pk_col in headers:
                        pk_idx = headers.index(pk_col) + 1
                        existing_pks = ws.col_values(pk_idx)[1:]  # skip header
                        if pk_val in existing_pks:
                            logger.info(
                                "append_row: %s=%r already present — skipping duplicate write",
                                pk_col, pk_val,
                            )
                            return
                _first_call[0] = False
                if not ws.row_values(1):
                    ws.append_row(list(row.keys()), value_input_option="USER_ENTERED")
                ws.append_row(list(row.values()), value_input_option="USER_ENTERED")

            _with_retry(_do_append)

    def update_row(self, tab: str, pk_col: str, pk_val: str, row: dict) -> None:
        """Find the row where *pk_col* == *pk_val* and overwrite it with *row*.

        Uses ``get_all_values()`` (not ``get_all_records()``) so blank rows in
        the sheet do not shift the physical row index.  Values are written in
        sheet-header order so column position is always correct.
        """
        ws = self._worksheet(tab)
        headers = _with_retry(lambda: ws.row_values(1))
        if not headers:
            raise KeyError(f"Tab '{tab}' has no header row")

        all_values = _with_retry(lambda: ws.get_all_values())
        # all_values[0] is the header row; data rows start at index 1 → physical row 2
        for offset, raw_row in enumerate(all_values[1:], start=2):
            if not any(raw_row):  # skip blank rows — no PK to match
                continue
            # gspread trims trailing empty cells; pad to header length so zip is complete
            padded = raw_row + [""] * (len(headers) - len(raw_row))
            record = dict(zip(headers, padded))
            if record.get(pk_col) == pk_val:
                ordered_vals = [row.get(h, "") for h in headers]
                _with_retry(
                    lambda i=offset, v=ordered_vals: ws.update(  # type: ignore[misc]
                        f"A{i}",
                        [v],
                        value_input_option="USER_ENTERED",
                    )
                )
                return
        raise KeyError(f"Row with {pk_col}={pk_val!r} not found in tab '{tab}'")

    def append_rows(self, tab: str, values: list[list]) -> None:
        ws = self._worksheet(tab)
        _with_retry(lambda: ws.append_rows(values, value_input_option="RAW"))

    def delete_rows(self, tab: str, start_row: int, end_row: int) -> None:
        ws = self._worksheet(tab)
        _with_retry(lambda: ws.delete_rows(start_row, end_row))


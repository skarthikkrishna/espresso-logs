"""
BrewLogRepo — Sheets-backed repository for the Brew_Log tab.

Schema columns (in order):
  Shot_ID, Date, Bag_ID, Machine_ID, Grinder_ID, Basket_ID, Dose_In_g, Yield_Out_g,
  Time_Sec, Grind_Setting, Shot_Eligibility, Taste_Summary, User_Notes,
  AI_Feedback, Storage_Method
"""

from __future__ import annotations

from app.repos.base import BaseRepo, TTLCache
from app.repos.sheets_client import SheetsClientProtocol

_TAB = "Brew_Log"
_PK = "Shot_ID"
_CACHE_KEY_RECENT = "brew_log:recent"


class BrewLogRepo(BaseRepo):
    """Repository for the Brew_Log (shot history) tab."""

    TAB = _TAB
    COLUMNS = (
        "Shot_ID", "Date", "Bag_ID", "Machine_ID", "Grinder_ID", "Basket_ID",
        "Dose_In_g", "Yield_Out_g", "Time_Sec", "Grind_Setting",
        "Shot_Eligibility", "Taste_Summary", "User_Notes", "AI_Feedback", "Storage_Method",
    )

    def __init__(
        self,
        client: SheetsClientProtocol,
        cache: TTLCache | None = None,
    ) -> None:
        super().__init__(client, cache)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def add(self, row: dict) -> None:
        """Append a new shot row; invalidates the recent-shots cache.

        Normalises *row* against COLUMNS so the positional write to Sheets
        always matches the sheet header order, regardless of what keys the
        caller supplied.  Missing columns default to ``""``.
        """
        normalised = {col: row.get(col, "") for col in self.COLUMNS}
        self._client.append_row(_TAB, normalised, pk_col=_PK)
        self._cache.invalidate(_CACHE_KEY_RECENT)

    def add_many(self, rows: list[dict]) -> None:
        """Bulk-append multiple shot rows (bootstrapping)."""
        if not rows:
            return
        values = [[row.get(col, "") for col in self.COLUMNS] for row in rows]
        self._client.append_rows(self.TAB, values)

    def delete_rows(self, start_row: int, end_row: int) -> None:
        """Delete sheet rows by 1-indexed position (row 1 = header)."""
        self._client.delete_rows(self.TAB, start_row, end_row)

    def update_feedback(self, shot_id: str, ai_feedback: str) -> None:
        """Write *ai_feedback* back to an existing shot row (Phase 7 write-back).

        Fetches the current row, updates the ``AI_Feedback`` field, and writes
        it back.  Invalidates the recent cache.
        """
        row = self.get(shot_id)
        if row is None:
            raise KeyError(f"Shot_ID {shot_id!r} not found in Brew_Log")
        updated = dict(row)
        updated["AI_Feedback"] = ai_feedback
        self._client.update_row(_TAB, _PK, shot_id, updated)
        self._cache.invalidate(_CACHE_KEY_RECENT)

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get(self, shot_id: str) -> dict | None:
        """Return the shot with *shot_id*, or ``None``."""
        for row in self._fetch_cached(_CACHE_KEY_RECENT, _TAB):
            if row.get(_PK) == shot_id:
                return row
        return None

    def list(self) -> list[dict]:
        """Return all brew log entries (cached for 60s)."""
        return self._fetch_cached(_CACHE_KEY_RECENT, _TAB)

    def list_for_bag(self, bag_id: str) -> list[dict]:
        """Return all shots for *bag_id*, using the shared recent cache."""
        return [r for r in self._fetch_cached(_CACHE_KEY_RECENT, _TAB) if r.get("Bag_ID") == bag_id]

    def list_recent(self, n: int = 20) -> list[dict]:
        """Return the *n* most-recent shots across all bags, sorted by Date desc.

        Results are cached for 60s.
        """
        all_rows = self._fetch_cached(_CACHE_KEY_RECENT, _TAB)
        sorted_rows = sorted(all_rows, key=lambda r: (r.get("Date", ""), r.get("Shot_ID", "")), reverse=True)
        return sorted_rows[:n]

    def list_existing_ids(self) -> list[str]:
        """Return all Shot_IDs with a guaranteed-fresh read, bypassing the TTL cache.

        Used by the POST route to reduce stale-cache ID collisions.  Note: the
        read→compute→append sequence is not atomic, so truly concurrent requests
        can still generate the same ID; the PK guard in ``add()`` + the
        ``append_row`` retry check handle that residual race.
        """
        rows = self._client.get_all_records(_TAB)
        return [r[_PK] for r in rows if r.get(_PK)]

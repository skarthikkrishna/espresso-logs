"""
Parity tests: FakeSheetsClient must behave identically to RealSheetsClient
for the four failure modes that caused the production AI_Feedback bug.

Each test names the exact RealSheetsClient behaviour it mirrors so future
maintainers know WHY the fake behaves this way.
"""

from __future__ import annotations

import pytest

from tests.doubles import FakeSheetsClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _brew_row(shot_id: str, date: str = "2025-01-01", ai: str = "") -> dict:
    return {"Shot_ID": shot_id, "Date": date, "AI_Feedback": ai}


# ---------------------------------------------------------------------------
# 1. update_row: header-mapping — columns absent from headers are dropped
#
# RealSheetsClient: ordered_vals = [row.get(h, "") for h in headers]
# Any key in `row` that is NOT in the sheet's header row is silently ignored.
# ---------------------------------------------------------------------------


def test_update_row_drops_column_not_in_headers() -> None:
    """A column present in the update dict but NOT in the seed row's keys is
    silently dropped — mirrors production behaviour where the sheet header row
    determines which columns are writable."""
    client = FakeSheetsClient(
        {"Brew_Log": [{"Shot_ID": "S1", "Date": "2025-01-01"}]}  # no AI_Feedback header
    )
    client.update_row(
        "Brew_Log",
        "Shot_ID",
        "S1",
        {"Shot_ID": "S1", "Date": "2025-01-01", "AI_Feedback": "Great shot"},
    )
    stored = client._store["Brew_Log"][0]
    assert "AI_Feedback" not in stored, (
        "AI_Feedback must be silently dropped when it is not in the sheet headers; "
        "this is the exact production-only bug — the fake must reproduce it."
    )


def test_update_row_writes_ai_feedback_when_header_present() -> None:
    """AI_Feedback IS updated when the column already exists as a header.
    This is the happy path: sheet was created with AI_Feedback in the schema."""
    client = FakeSheetsClient({"Brew_Log": [_brew_row("S1")]})
    client.update_row(
        "Brew_Log",
        "Shot_ID",
        "S1",
        {"Shot_ID": "S1", "Date": "2025-01-01", "AI_Feedback": "Try finer grind."},
    )
    assert client._store["Brew_Log"][0]["AI_Feedback"] == "Try finer grind."


def test_update_row_header_absent_col_gets_empty_string() -> None:
    """Columns present in headers but omitted from the update dict receive an
    empty string — mirrors RealSheetsClient's `row.get(h, "")` fallback."""
    client = FakeSheetsClient({"Brew_Log": [_brew_row("S1", date="2025-01-01")]})
    # Update supplies Shot_ID and AI_Feedback but omits Date.
    client.update_row(
        "Brew_Log",
        "Shot_ID",
        "S1",
        {"Shot_ID": "S1", "AI_Feedback": "feedback"},
    )
    stored = client._store["Brew_Log"][0]
    assert stored["Date"] == "", "Omitted header column must default to empty string"
    assert stored["AI_Feedback"] == "feedback"


def test_update_row_missing_pk_raises() -> None:
    """update_row raises KeyError when no row matches pk_val."""
    client = FakeSheetsClient({"Brew_Log": [_brew_row("S1")]})
    with pytest.raises(KeyError):
        client.update_row("Brew_Log", "Shot_ID", "MISSING", {"Shot_ID": "MISSING"})


# ---------------------------------------------------------------------------
# 2. append_row: PK dedup — second call with same PK is a no-op
#
# RealSheetsClient: if pk_col is provided, checks get_all_records() first
# and returns early if a row with that PK already exists.
# ---------------------------------------------------------------------------


def test_append_row_pk_dedup_prevents_duplicate() -> None:
    """Calling append_row twice with the same pk_col value must NOT create a
    second row — mirrors RealSheetsClient's idempotency guard."""
    client = FakeSheetsClient()
    row = {"Shot_ID": "S1", "Date": "2025-01-01", "AI_Feedback": ""}
    client.append_row("Brew_Log", row, pk_col="Shot_ID")
    client.append_row("Brew_Log", row, pk_col="Shot_ID")  # duplicate — must be skipped
    assert len(client._store["Brew_Log"]) == 1, (
        "Second append with the same Shot_ID must be a no-op (dedup by pk_col)"
    )


def test_append_row_pk_dedup_first_write_succeeds() -> None:
    """The first call with a new PK must always be written."""
    client = FakeSheetsClient()
    client.append_row("Brew_Log", {"Shot_ID": "S1", "Date": "2025-01-01"}, pk_col="Shot_ID")
    assert len(client._store["Brew_Log"]) == 1


def test_append_row_without_pk_col_always_appends() -> None:
    """Without pk_col, append_row always writes (legacy behaviour preserved)."""
    client = FakeSheetsClient()
    row = {"Shot_ID": "S1", "Date": "2025-01-01"}
    client.append_row("Brew_Log", row)
    client.append_row("Brew_Log", row)
    assert len(client._store["Brew_Log"]) == 2


def test_append_row_different_pks_both_written() -> None:
    """Two rows with different pk_col values must both be stored."""
    client = FakeSheetsClient()
    client.append_row("Brew_Log", {"Shot_ID": "S1"}, pk_col="Shot_ID")
    client.append_row("Brew_Log", {"Shot_ID": "S2"}, pk_col="Shot_ID")
    assert len(client._store["Brew_Log"]) == 2


# ---------------------------------------------------------------------------
# 3. Column-shift scenario
#
# If the stored dict key order differs from the update dict key order,
# values must still land in the correct column — because update_row maps
# by header name, not by position.
# ---------------------------------------------------------------------------


def test_update_row_column_order_independent() -> None:
    """update_row must assign values by header name regardless of key insertion
    order in the supplied dict.  Prevents silent column-shift misalignment."""
    client = FakeSheetsClient(
        {"Brew_Log": [{"Shot_ID": "S1", "Date": "2025-01-01", "AI_Feedback": ""}]}
    )
    # Supply dict with reversed key order
    client.update_row(
        "Brew_Log",
        "Shot_ID",
        "S1",
        {"AI_Feedback": "great", "Date": "2025-06-01", "Shot_ID": "S1"},
    )
    stored = client._store["Brew_Log"][0]
    assert stored["Date"] == "2025-06-01"
    assert stored["AI_Feedback"] == "great"
    assert stored["Shot_ID"] == "S1"


# ---------------------------------------------------------------------------
# 4. Row-index drift scenario (blank-row guard)
#
# RealSheetsClient uses enumerate(records, start=2) to compute the sheet row
# index for `ws.update(f"A{idx}", ...)`.  gspread's get_all_records() SKIPS
# blank rows, so if a blank row exists at position N the index arithmetic
# drifts and the update lands on the wrong row.
#
# FakeSheetsClient cannot replicate gspread's blank-row skipping (it stores
# only real dicts), so we instead assert FakeSheetsClient's contract: every
# row in the store is addressable — no blank-row drift is possible.
#
# This test serves as a living documentation that the drift risk exists only
# in production and should be caught by integration / E2E tests against the
# real sheet, not by unit tests against the fake.
# ---------------------------------------------------------------------------


def test_update_row_no_blank_row_drift_in_fake() -> None:
    """FakeSheetsClient stores no blank rows, so row-index drift cannot occur
    here.  This test documents the contract and prevents regressions if someone
    adds blank-row support to the fake in future."""
    rows = [
        {"Shot_ID": "S1", "Date": "2025-01-01", "AI_Feedback": ""},
        {"Shot_ID": "S2", "Date": "2025-01-02", "AI_Feedback": ""},
        {"Shot_ID": "S3", "Date": "2025-01-03", "AI_Feedback": ""},
    ]
    client = FakeSheetsClient({"Brew_Log": rows})
    # Update the middle row
    client.update_row(
        "Brew_Log",
        "Shot_ID",
        "S2",
        {"Shot_ID": "S2", "Date": "2025-01-02", "AI_Feedback": "updated"},
    )
    # S1 and S3 must be untouched — no index drift
    assert client._store["Brew_Log"][0]["AI_Feedback"] == ""
    assert client._store["Brew_Log"][1]["AI_Feedback"] == "updated"
    assert client._store["Brew_Log"][2]["AI_Feedback"] == ""

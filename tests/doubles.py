"""Test doubles for the coffee_tracker test suite.

FakeSheetsClient is defined in app/testing/fake_sheets.py (canonical location)
so app/deps.py can import it for E2E_AUTH_BYPASS mode without depending on the
test tree. It is re-exported here for backward compatibility — all existing
tests that do `from tests.doubles import FakeSheetsClient` continue to work.
"""

from __future__ import annotations

from app.testing.fake_sheets import FakeSheetsClient  # noqa: F401 — re-export

__all__ = ["FakeSheetsClient"]

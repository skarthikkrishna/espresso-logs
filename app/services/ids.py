"""
Deterministic ID generators for Inventory, Maintenance, and Brew_Log entities.

All functions are pure (no I/O).  Repos call them before writing new rows.
"""

from __future__ import annotations

import re
from datetime import date

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ROAST_LEVEL_MAP: dict[str, str] = {
    "Light": "L",
    "Light / Medium": "LM",
    "Medium": "M",
    "Medium / Dark": "MD",
    "Dark": "D",
}


def roaster_code(roaster: str) -> str:
    """Return a 2-character roaster code from the first word of *roaster*.

    Example: ``"Verve Coffee"`` → ``"Ve"``.

    Raises ``ValueError`` if *roaster* is blank or whitespace-only.
    """
    roaster = roaster.strip()
    if not roaster:
        raise ValueError("Roaster name must not be blank.")
    first_word = roaster.split()[0]
    return first_word[:2].title()


def roast_level_code(level: str) -> str:
    """Return the canonical single/two-letter roast-level code.

    Valid inputs (case-sensitive, use `` / `` as separator with spaces):
    ``Light``, ``Light / Medium``, ``Medium``, ``Medium / Dark``, ``Dark``.

    Raises ``ValueError`` for unrecognised values.
    """
    try:
        return _ROAST_LEVEL_MAP[level]
    except KeyError:
        valid = ", ".join(f"'{k}'" for k in _ROAST_LEVEL_MAP)
        raise ValueError(f"Unknown roast level {level!r}. Valid values: {valid}") from None


# ---------------------------------------------------------------------------
# Shot ID
# ---------------------------------------------------------------------------


def make_shot_id(shot_date: date, bag_id: str, existing_ids: list[str]) -> str:
    """Generate the next Shot_ID for *bag_id* on *shot_date*.

    Format: ``SH-{YYYYMMDD}-{NN}`` where NN is a zero-padded 2-digit daily
    sequence per bag (01, 02, …).  The sequence is derived by scanning
    *existing_ids* — no database calls are made.

    Args:
        shot_date: The date the shot was pulled.
        bag_id: The Bag_ID the shot belongs to (unused in format, but the
            sequence is intentionally global per day for uniqueness).
        existing_ids: All Shot_IDs already present in the Brew_Log tab.
    """
    date_str = shot_date.strftime("%Y%m%d")
    prefix = f"SH-{date_str}-"
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
    existing_seqs = [
        int(m.group(1)) for sid in existing_ids if (m := pattern.match(sid)) is not None
    ]
    seq = max(existing_seqs, default=0) + 1
    return f"{prefix}{seq:02d}"


# ---------------------------------------------------------------------------
# Inventory ID
# ---------------------------------------------------------------------------


def make_inventory_id(
    roaster: str,
    roast_date: date,
    roast_level: str,
    existing_ids: list[str],
) -> str:
    """Generate a Bag_ID.

    Format: ``{RoasterCode}{YYYYMMDD}{RoastLevelCode}`` with a ``-N``
    collision suffix (``-2``, ``-3``, …) if the base ID is already taken.

    Example: ``"Verve"``, ``2025-02-01``, ``"Medium"`` → ``"Ve20250201M"``.
    """
    base = f"{roaster_code(roaster)}{roast_date.strftime('%Y%m%d')}{roast_level_code(roast_level)}"
    if base not in existing_ids:
        return base
    n = 2
    while True:
        candidate = f"{base}-{n}"
        if candidate not in existing_ids:
            return candidate
        n += 1


# ---------------------------------------------------------------------------
# Maintenance ID
# ---------------------------------------------------------------------------

_MNT_PATTERN = re.compile(r"MNT(\d+)")


def make_maintenance_id(existing_ids: list[str]) -> str:
    """Generate the next Maintenance_ID.

    Format: ``MNT{NNN}`` (zero-padded to 3 digits, e.g. ``MNT001``).

    Malformed IDs (those that don't match ``MNT\\d+``) are silently ignored.
    Starts at ``MNT001`` if no existing valid IDs are present.
    """
    highest = 0
    for mid in existing_ids:
        m = _MNT_PATTERN.fullmatch(mid)
        if m:
            highest = max(highest, int(m.group(1)))
    next_num = highest + 1
    return f"MNT{next_num:03d}"

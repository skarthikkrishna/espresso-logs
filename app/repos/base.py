"""
Shared repo abstractions: TTLCache and BaseRepo.
"""

from __future__ import annotations

import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.repos.sheets_client import SheetsClientProtocol

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

_DEFAULT_TTL = 60.0  # seconds


@dataclass
class CacheEntry:
    """One cached result set."""

    data: list[dict[str, Any]]
    fetched_at: float = field(default_factory=time.monotonic)


class TTLCache:
    """Simple monotonic-clock TTL cache keyed by tab name (or any string key)."""

    def __init__(self, ttl: float = _DEFAULT_TTL) -> None:
        self._ttl = ttl
        self._store: dict[str, CacheEntry] = {}

    def get(self, key: str) -> list[dict[str, Any]] | None:
        """Return a shallow copy of cached data if fresh, else ``None``."""
        entry = self._store.get(key)
        if entry is None or (time.monotonic() - entry.fetched_at) > self._ttl:
            return None
        return [row.copy() for row in entry.data]

    def set(self, key: str, data: list[dict[str, Any]]) -> None:
        """Store a copy of *data* under *key*."""
        self._store[key] = CacheEntry(data=[row.copy() for row in data])

    def invalidate(self, key: str) -> None:
        """Remove *key* from the cache (no-op if not present)."""
        self._store.pop(key, None)


# ---------------------------------------------------------------------------
# Process-level singleton cache (shared across all repo instances in production)
# ---------------------------------------------------------------------------

_process_cache: TTLCache | None = None
_process_cache_lock = threading.Lock()


def get_process_cache() -> TTLCache:
    """Return (or lazily create) the process-level TTLCache singleton."""
    global _process_cache
    if _process_cache is None:
        with _process_cache_lock:
            if _process_cache is None:
                _process_cache = TTLCache()
    return _process_cache


# ---------------------------------------------------------------------------
# Base repository
# ---------------------------------------------------------------------------


class BaseRepo(ABC):
    """Abstract base class for all Sheets-backed repositories."""

    TAB: str = ""  # subclasses must override

    def __init__(
        self,
        client: SheetsClientProtocol,
        cache: TTLCache | None = None,
    ) -> None:
        self._client = client
        self._cache = cache if cache is not None else get_process_cache()

    def _fetch_all(self, tab: str | None = None) -> list[dict[str, Any]]:
        """Return all rows for *tab* (defaulting to ``self.TAB``), bypassing cache."""
        return self._client.get_all_records(tab or self.TAB)

    def _fetch_cached(self, cache_key: str, tab: str | None = None) -> list[dict[str, Any]]:
        """Return rows from cache if fresh, otherwise fetch and populate cache."""
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached
        data = self._fetch_all(tab)
        self._cache.set(cache_key, data)
        return data

    @abstractmethod
    def delete_rows(self, start_row: int, end_row: int) -> None:
        """Delete spreadsheet rows from *start_row* to *end_row* (inclusive, 1-indexed)."""

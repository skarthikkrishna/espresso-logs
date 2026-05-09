"""Per-process in-memory idempotency store for POST /api/brew-log.

NOTE: This cache is process-local. It is NOT shared across server instances or
processes. In a horizontally-scaled deployment (e.g. Cloud Run with > 1 instance),
duplicate requests routed to different instances will NOT be deduplicated by this
store. Cross-instance deduplication via a shared external cache (Redis, etc.) is
explicitly out of scope for this version.

TTL
---
Default TTL: 300 s (5 minutes), defined by ``_DEFAULT_TTL_SECONDS``.
Eviction is passive — expired entries are swept on each ``check_and_set_sentinel``
call (under lock). No background task is needed.

See Also
--------
* FR-011 in ``specs/018-brew-log-double-submit-dedup/spec.md``
* ``app/deps.py`` — ``get_idempotency_store()`` singleton factory
* ``app/routers/api_brew_log.py`` — usage point
"""
from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from typing import Any

_DEFAULT_TTL_SECONDS: float = 300.0


class IdempotencyStore:
    """Per-process in-memory idempotency cache for POST /api/brew-log.

    Each cache entry is a plain dict with shape::

        {"response": dict, "ts": float, "in_flight": bool}

    ``response`` is ``None`` while the entry is a sentinel (``in_flight=True``)
    and is replaced with the real payload once the Sheets write succeeds.

    TTL eviction is passive: expired entries are swept on each
    ``check_and_set_sentinel`` call (under lock), so no background task is needed.
    """

    def __init__(
        self,
        ttl: float = _DEFAULT_TTL_SECONDS,
        now: Callable[[], float] = time.monotonic,
    ) -> None:
        self.ttl = ttl
        self._now = now
        self._cache: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def check_and_set_sentinel(self, key: str) -> dict[str, Any] | None:
        """Acquire lock, evict expired entries, then check cache.

        Returns:
            The cached response dict if a complete (non-in-flight, non-expired)
            entry exists.  Returns ``None`` in all other cases (miss, in-flight,
            or expired); the caller should proceed with the normal write path.

        Side-effect on cache miss:
            Stores an in-flight sentinel so that a concurrent duplicate request
            with the same key can detect the in-progress write.
        """
        async with self._lock:
            self._evict_expired()
            entry = self._cache.get(key)
            if entry is not None and not entry["in_flight"]:
                # Complete cache hit — return stored response
                return entry["response"]  # type: ignore[no-any-return]
            if entry is not None and entry["in_flight"]:
                # In-flight sentinel present; caller proceeds to add().
                # PK guard in FakeSheetsClient / RealSheetsClient is the backstop.
                return None
            # Cache miss — store in-flight sentinel, caller proceeds to add()
            self._cache[key] = {"response": None, "ts": self._now(), "in_flight": True}
            return None

    async def store(self, key: str, response: dict[str, Any]) -> None:
        """Replace the in-flight sentinel (or any existing entry) with the final response.

        Preserves the original ``ts`` timestamp so that TTL is measured from
        first receipt, not from write completion.
        """
        async with self._lock:
            existing = self._cache.get(key)
            ts = existing["ts"] if existing is not None else self._now()
            self._cache[key] = {"response": response, "ts": ts, "in_flight": False}

    def clear(self) -> None:
        """Flush all entries and reinitialise the lock (synchronous).

        Reinitialising ``self._lock`` ensures that a test which raised while
        the lock was held does not permanently block subsequent tests.
        """
        self._cache.clear()
        self._lock = asyncio.Lock()

    reset = clear  # alias — both names are valid per FR-005

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _evict_expired(self) -> None:
        """Remove entries older than TTL. Must be called while holding ``self._lock``."""
        cutoff = self._now() - self.ttl
        expired = [k for k, e in self._cache.items() if e["ts"] < cutoff]
        for k in expired:
            del self._cache[k]

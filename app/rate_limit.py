"""Shared slowapi rate limiter instance.

Defined in a dedicated module to avoid circular imports between app.main
and app.routers.api_auth (both need the limiter reference).
"""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

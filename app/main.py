import logging
import os
import pathlib
import re
import sys
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.auth import router as auth_router
from app.config import settings
from app.deps import _E2E_AUTH_BYPASS, get_sheets_client
from app.models.base import get_session_factory
from app.models.inventory import InventoryBag
from app.models.maintenance import MaintenanceLog
from app.rate_limit import limiter
from app.repos.base import TTLCache
from app.repos.inventory import InventoryRepo
from app.repos.maintenance import MaintenanceRepo
from app.repos.sheets_client import SheetsClientProtocol
from app.repos.sql.inventory import SqlInventoryRepo
from app.repos.sql.maintenance import SqlMaintenanceRepo
from app.routers import defaults as defaults_router, health, import_wizard
from app.routers import (
    api_auth,
    api_brew_log,
    api_catalog,
    api_dashboard,
    api_defaults,
    api_hardware,
    api_households,
    api_inventory,
    api_maintenance,
)


class JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON for structured log ingestion."""

    def format(self, record: logging.LogRecord) -> str:
        import json

        return json.dumps(
            {
                "time": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "name": record.name,
                "message": record.getMessage(),
            }
        )


class _RedactApiKey(logging.Filter):
    """Redact ?key= / &key= query params so API keys never appear in logs."""

    _pattern = re.compile(r"((?:\?|&)key=)[^&\s\"']+")

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = self._pattern.sub(r"\1REDACTED", str(record.msg))
        return True


def _configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    # Idempotent: skip if a JsonFormatter handler is already present (guards against
    # duplicate handlers when the module is imported more than once, e.g. in tests).
    if not any(isinstance(h.formatter, JsonFormatter) for h in root.handlers):
        root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
        root.addHandler(handler)
    logging.getLogger("httpx").addFilter(_RedactApiKey())


_configure_logging()
logger = logging.getLogger(__name__)


async def _backfill_maintenance_logs(
    db: AsyncSession,
    sheets_client: SheetsClientProtocol,
) -> None:
    """Backfill sheets_hardware_id on maintenance_log rows written before migration 0005.

    Idempotency guard: skips the Sheets read entirely when no rows have a NULL
    sheets_hardware_id.  After the first successful run this query returns 0 and
    subsequent cold starts are cheap.
    """
    result = await db.execute(
        select(func.count())
        .select_from(MaintenanceLog)
        .where(MaintenanceLog.sheets_hardware_id.is_(None))
    )
    null_count: int = result.scalar_one()
    if null_count == 0:
        logger.info("Backfill: maintenance_log has 0 rows with sheets_hardware_id=NULL — skipping")
        return
    logger.info(
        "Backfill: found %d maintenance rows with sheets_hardware_id=NULL, starting upsert",
        null_count,
    )
    sheets_repo = MaintenanceRepo(sheets_client, TTLCache())
    sql_repo = SqlMaintenanceRepo(db=db)
    for row in sheets_repo.list():
        await sql_repo.upsert(row)


async def _backfill_inventory_bags(
    db: AsyncSession,
    sheets_client: SheetsClientProtocol,
) -> None:
    """Backfill sheets_catalog_id on inventory_bags rows written before migration 0006.

    Passes status=None to InventoryRepo.list() so that depleted/archived bags are
    included — omitting them would leave historical brew-log entries unresolvable.

    Idempotency guard: skips the Sheets read entirely when no rows have a NULL
    sheets_catalog_id.  Per-row logic mirrors SqlMaintenanceRepo.upsert():
    - Row absent from Postgres → INSERT via SqlInventoryRepo.upsert().
    - Row present with NULL sheets_catalog_id → UPDATE only that field.
    - Row present with non-NULL sheets_catalog_id → no-op.
    """
    result = await db.execute(
        select(func.count())
        .select_from(InventoryBag)
        .where(InventoryBag.sheets_catalog_id.is_(None))
    )
    null_count: int = result.scalar_one()
    if null_count == 0:
        logger.info("Backfill: inventory_bags has 0 rows with sheets_catalog_id=NULL — skipping")
        return
    logger.info(
        "Backfill: found %d inventory bags with sheets_catalog_id=NULL, starting upsert",
        null_count,
    )
    sheets_repo = InventoryRepo(sheets_client, TTLCache())
    sql_repo = SqlInventoryRepo(db=db)
    for row in sheets_repo.list(status=None):
        bag_id = row.get("Bag_ID")
        if not bag_id:
            continue
        bag_result = await db.execute(select(InventoryBag).where(InventoryBag.sheets_id == bag_id))
        existing: InventoryBag | None = bag_result.scalar_one_or_none()
        if existing is None:
            # Bag absent from Postgres — full insert via repo
            await sql_repo.upsert(row)
        elif existing.sheets_catalog_id is None:
            # Only fill in the missing field; leave all other columns untouched
            existing.sheets_catalog_id = row.get("Catalog_ID")
            await db.commit()
        # else: sheets_catalog_id already set → no-op


async def run_startup_backfill() -> None:
    """Idempotent startup backfill for pre-migration missing Postgres fields.

    Gated on settings.use_postgres — returns immediately when False so no
    database connection is opened.  All exceptions are caught and logged at
    WARNING level; the app always continues to start.
    """
    if not settings.use_postgres:
        return
    try:
        async with get_session_factory()() as db:
            sheets_client = get_sheets_client()
            await _backfill_maintenance_logs(db, sheets_client)
            await _backfill_inventory_bags(db, sheets_client)
    except Exception as exc:
        logger.warning("Startup backfill failed — will retry on next cold start: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:  # noqa: ARG001
    logger.info("Coffee Tracker starting up (env=%s)", settings.app_env)
    if _E2E_AUTH_BYPASS:
        logger.warning("⚠️  E2E_AUTH_BYPASS is ACTIVE — authentication is bypassed for all requests")
    if settings.allowlist_emails:
        logger.warning(
            "ALLOWLIST_EMAILS is set but is no longer enforced in M5. "
            "Remove this environment variable — the new access gate is household membership."
        )
    if settings.use_postgres and settings.database_url:
        from app.models.base import _is_cloud_sql_url, init_async_engine

        if _is_cloud_sql_url(settings.database_url):
            await init_async_engine(settings.database_url)
            logger.info("Cloud SQL Connector initialized (async, bound to uvicorn event loop)")
    await run_startup_backfill()
    yield
    if settings.use_postgres:
        from app.models.base import close_engine

        await close_engine()
        logger.info("Database engine and Cloud SQL Connector closed")


app = FastAPI(title="Coffee Tracker", lifespan=lifespan)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "0"
        return response


app.add_middleware(SecurityHeadersMiddleware)

if settings.app_env != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# slowapi rate limiter (AC-016, AC-025, AC-034)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]


@app.exception_handler(403)
async def forbidden_handler(request: Request, exc: Exception) -> HTMLResponse:
    return HTMLResponse(
        """<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Access Denied — Coffee Tracker</title>
<style>body{font-family:sans-serif;text-align:center;padding:4rem;background:#1a1209;color:#f5e6d3}
h1{font-size:6rem;margin:0;color:#dc2626}a{color:#d97706}</style></head>
<body><h1>403</h1><h2>Access Denied</h2>
<p>Your Google account isn't on the access list for this app.</p>
<a href="/auth/login">Sign in with a different account</a></body></html>""",
        status_code=403,
    )


# Mount static files only when the directory exists (the static/ dir is
# populated during the Docker build step via Tailwind/asset compilation).
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/static", StaticFiles(directory=_static_dir), name="static")

    # Serve manifest.webmanifest at root path with correct MIME type for PWA.
    _manifest_path = os.path.join(_static_dir, "manifest.webmanifest")
    _manifest_content: str = ""
    if os.path.isfile(_manifest_path):
        with open(_manifest_path) as f:
            _manifest_content = f.read()

    @app.get("/manifest.webmanifest", include_in_schema=False)
    async def serve_manifest() -> HTMLResponse:
        return HTMLResponse(
            content=_manifest_content,
            media_type="application/manifest+json",
        )

    # Serve sw.js at root path so its scope '/' is within the allowed max-scope.
    # Browsers restrict a SW's scope to paths at or below the script URL; serving
    # from /static/sw.js would cap the scope at /static/.
    _sw_path = os.path.join(_static_dir, "sw.js")
    _sw_content: bytes = b""
    if os.path.isfile(_sw_path):
        with open(_sw_path, "rb") as _f:
            _sw_content = _f.read()

    @app.get("/sw.js", include_in_schema=False)
    async def serve_sw() -> HTMLResponse:
        return HTMLResponse(
            content=_sw_content.decode(),
            media_type="application/javascript",
            headers={"Service-Worker-Allowed": "/"},
        )


app.include_router(auth_router)
app.include_router(health.router)
app.include_router(api_auth.router)
app.include_router(api_households.router, prefix="/households")
app.include_router(api_dashboard.router)
app.include_router(api_catalog.router)
app.include_router(api_hardware.router)
app.include_router(api_brew_log.router)
app.include_router(api_inventory.router)
app.include_router(api_maintenance.router)
app.include_router(api_defaults.router)
app.include_router(defaults_router.router)
app.include_router(import_wizard.router)

# E2E-only cleanup endpoint — only mounted when auth bypass is active (never in production)
if _E2E_AUTH_BYPASS:
    from app.routers import api_e2e

    app.include_router(api_e2e.router)

_spa_index = pathlib.Path(__file__).parent / "static" / "spa" / "index.html"


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str) -> HTMLResponse:  # noqa: ARG001
    """Serve the SPA for all unmatched routes; auth is enforced client-side."""
    if _spa_index.exists():
        return HTMLResponse(_spa_index.read_text())
    return HTMLResponse(
        "<html><body><p>SPA not built. Run: cd frontend && npm run build</p></body></html>"
    )

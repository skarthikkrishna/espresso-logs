import logging
import os
import pathlib
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.auth import router as auth_router
from app.config import settings
from app.deps import CurrentUser, _RequiresLogin
from app.routers import defaults as defaults_router, health, import_wizard
from app.routers import (
    api_auth,
    api_brew_log,
    api_catalog,
    api_dashboard,
    api_defaults,
    api_hardware,
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
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    logging.getLogger("httpx").addFilter(_RedactApiKey())


_configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:  # noqa: ARG001
    logger.info("Coffee Tracker starting up (env=%s)", settings.app_env)
    yield


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
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie="session",
    https_only=settings.app_env == "production",
    same_site="lax",
)

if settings.app_env != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


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


@app.exception_handler(_RequiresLogin)
async def requires_login_handler(request: Request, exc: _RequiresLogin) -> RedirectResponse:
    return RedirectResponse(url="/auth/login", status_code=302)


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
app.include_router(api_dashboard.router)
app.include_router(api_catalog.router)
app.include_router(api_hardware.router)
app.include_router(api_brew_log.router)
app.include_router(api_inventory.router)
app.include_router(api_maintenance.router)
app.include_router(api_defaults.router)
app.include_router(defaults_router.router)
app.include_router(import_wizard.router)

_spa_index = pathlib.Path(__file__).parent / "static" / "spa" / "index.html"


@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch_all(full_path: str, _user: CurrentUser) -> HTMLResponse:
    if _spa_index.exists():
        return HTMLResponse(_spa_index.read_text())
    return HTMLResponse(
        "<html><body><p>SPA not built. Run: cd frontend && npm run build</p></body></html>"
    )

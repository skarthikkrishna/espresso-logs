from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import settings
from app.models.base import get_session_factory
from app.repos.sql.tenant import assert_runtime_rls

router = APIRouter()


@router.get("/livez")
async def livez() -> JSONResponse:
    """Liveness probe — returns ``{"status": "ok"}`` as long as the process is running."""
    return JSONResponse({"status": "ok"})


@router.get("/readyz")
async def readyz() -> JSONResponse:
    """Readiness probe — verifies Postgres runtime role/RLS safety when enabled."""
    if settings.use_postgres:
        async with get_session_factory()() as db:
            await assert_runtime_rls(db)
    return JSONResponse({"status": "ok"})


@router.get("/health")
async def health() -> JSONResponse:
    """Cloud Run startup probe target — unauthenticated, returns ``{"status": "ok"}``."""
    return JSONResponse({"status": "ok"})

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/livez")
async def livez() -> JSONResponse:
    """Liveness probe — returns ``{"status": "ok"}`` as long as the process is running."""
    return JSONResponse({"status": "ok"})


@router.get("/readyz")
async def readyz() -> JSONResponse:
    """Readiness probe — returns ``{"status": "ok"}``; extend here when startup checks are added."""
    return JSONResponse({"status": "ok"})


@router.get("/health")
async def health() -> JSONResponse:
    """Cloud Run startup probe target — unauthenticated, returns ``{"status": "ok"}``."""
    return JSONResponse({"status": "ok"})

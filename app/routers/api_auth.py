"""JSON auth endpoints — session user info and logout."""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.deps import CurrentUser
from app.models.api import CurrentUserOut

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/me", response_model=CurrentUserOut)
async def get_me(user: CurrentUser) -> CurrentUserOut:
    return CurrentUserOut(
        email=user.get("email", ""),
        name=user.get("name"),
        picture=user.get("picture"),
    )


@router.post("/logout")
async def api_logout(request: Request) -> JSONResponse:
    request.session.clear()
    return JSONResponse({"ok": True})

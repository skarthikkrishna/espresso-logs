import logging
from typing import Any

from authlib.integrations.starlette_client import OAuth  # type: ignore[import-untyped]
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.config import settings

logger = logging.getLogger(__name__)

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_oauth_client_id,
    client_secret=settings.google_oauth_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def _load_allowlist() -> frozenset[str]:
    raw = settings.allowlist_emails or ""
    return frozenset(
        e.lower().strip()
        for part in raw.replace(",", "\n").splitlines()
        if (e := part.strip())
    )


ALLOWLIST: frozenset[str] = _load_allowlist()
logger.info("Allowlist loaded: %d email(s)", len(ALLOWLIST))

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/login")
async def login(request: Request) -> Any:
    """Initiate Google OAuth flow; redirects the browser to Google's consent screen."""
    # Use an explicit URI when set (required on Cloud Run to ensure https:// scheme).
    # Falls back to Starlette's url_for for local development.
    redirect_uri = settings.oauth_redirect_uri or str(request.url_for("auth_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback", name="auth_callback")
async def auth_callback(request: Request) -> RedirectResponse:
    """Handle Google OAuth callback; sets session cookie on success or redirects on failure.

    Validates the returned token, checks the email against ``ALLOWLIST``, and
    stores user info in the session.  Returns HTTP 403 if the email is not
    allowlisted.  Redirects back to ``/auth/login`` on any OAuth error.
    """
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        logger.warning("OAuth callback error", exc_info=True)
        return RedirectResponse(url="/auth/login", status_code=302)
    userinfo = token.get("userinfo") or {}
    email = (userinfo.get("email") or "").lower()
    if email not in ALLOWLIST:
        logger.debug("allowlist miss for email domain (value redacted in prod)")
        raise HTTPException(status_code=403)
    request.session["user"] = {
        "email": email,
        "name": userinfo.get("name", ""),
        "picture": userinfo.get("picture", ""),
    }
    return RedirectResponse(url="/", status_code=302)


@router.get("/logout")
async def logout(request: Request) -> RedirectResponse:
    """Clear the user session and redirect to the login page."""
    request.session.clear()
    return RedirectResponse(url="/auth/login", status_code=302)

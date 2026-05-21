import json
import logging
import urllib.request  # noqa: F401  # needed: tests patch app.config.urllib.request.urlopen
from typing import Any, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

_GCP_METADATA_PROJECT_URL = "http://metadata.google.internal/computeMetadata/v1/project/project-id"


def _fetch_gcp_project_id() -> str:
    """Query the GCP metadata server for the current project ID.

    Returns an empty string when not running on GCP (e.g. local dev).
    Uses a short timeout so startup is not penalised in non-GCP environments.
    Only catches urllib.error.URLError (covers timeouts and connection failures);
    unexpected exceptions propagate so coding bugs are not silently swallowed.
    """
    import urllib.error

    try:
        req = urllib.request.Request(
            _GCP_METADATA_PROJECT_URL,
            headers={"Metadata-Flavor": "Google"},
        )
        with urllib.request.urlopen(req, timeout=0.5) as resp:  # nosec B310  # URL is hardcoded GCP metadata endpoint, not user-supplied
            return resp.read().decode().strip()  # type: ignore[no-any-return]
    except urllib.error.URLError:
        logger.debug("GCP metadata server unreachable — not running on GCP or network not ready")
        return ""


class Settings(BaseSettings):
    """Application settings loaded from environment variables or APP_SECRETS JSON blob.

    Two modes of secret injection are supported:

    * **Individual env vars** (local development via ``.env``): set each variable
      directly (``SESSION_SECRET``, ``GOOGLE_OAUTH_CLIENT_ID``, etc.).
    * **APP_SECRETS JSON blob** (Cloud Run via Secret Manager): a single
      ``APP_SECRETS`` env var containing a JSON object whose keys are the
      uppercase field names.  Individual vars always take precedence.
    """

    app_env: str = "development"
    log_level: str = "INFO"
    gcp_project_id: str = ""

    # Phase 5 — Sheets data layer
    spreadsheet_id: str  # required — raises ValidationError if SPREADSHEET_ID env var unset

    # Phase 4 — OAuth + session secrets
    session_secret: str = ""
    google_oauth_client_id: Optional[str] = None
    google_oauth_client_secret: Optional[str] = None
    allowlist_emails: Optional[str] = None
    # Explicit redirect URI for OAuth callback. Set to the full HTTPS URL on Cloud Run
    # to avoid http:// vs https:// mismatch when Starlette builds URLs behind a proxy.
    oauth_redirect_uri: Optional[str] = None

    # M5 — JWT auth
    # JWT_SECRET must be at least 32 characters (256-bit key for HS256).
    # Source from APP_SECRETS blob in production — never set as a standalone Cloud Run env var.
    jwt_secret: str = ""
    access_token_expire_seconds: int = 900

    # Phase 7 — AI inference
    # Anthropic is primary; Gemini is fallback. Both keys present = automatic failover.
    # To remove Gemini entirely, leave LLM_API_KEY unset.
    anthropic_api_key: Optional[str] = None  # ANTHROPIC_API_KEY secret in Secret Manager
    llm_api_key: Optional[str] = None  # LLM_API_KEY secret — Gemini fallback key

    # Phase M1 — Postgres data layer (future M4+)
    database_url: Optional[str] = None  # DATABASE_URL — only used when use_postgres=True
    # In production, sourced from the APP_SECRETS Secret Manager blob (key: "USE_POSTGRES").
    # Do NOT set USE_POSTGRES as a standalone Cloud Run env var — env vars take precedence
    # over blob values, so a stale standalone var would silently override the blob entry.
    # Secrets (DATABASE_URL, USE_POSTGRES, API keys) live in the blob; infra config
    # (APP_ENV, OAUTH_REDIRECT_URI) stays as standalone Cloud Run env vars.
    # For local dev, set USE_POSTGRES in .env directly.
    use_postgres: bool = False
    # BREW_LOG_SYNC_ALERT: set True to show a user-facing sync gap banner on the Brew Log list.
    # Clear after confirming zero drift via scripts/brew_log_reconcile.py.
    brew_log_sync_alert: bool = False

    # APP_SECRETS JSON blob (Cloud Run): single Secret Manager secret containing all
    # secret values as a JSON object. config.py parses it at startup via _load_app_secrets.
    app_secrets: Optional[str] = None

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @field_validator("jwt_secret")
    @classmethod
    def _validate_jwt_secret(cls, v: str) -> str:
        """Enforce minimum 32-character JWT secret (256-bit key for HS256)."""
        if v and len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return v

    @field_validator("allowlist_emails", mode="after")
    @classmethod
    def _warn_allowlist_emails_deprecated(cls, v: Optional[str]) -> Optional[str]:
        """Emit a deprecation warning when ALLOWLIST_EMAILS is set (M5+)."""
        if v:
            logging.getLogger("app.config").warning(
                "ALLOWLIST_EMAILS is set but deprecated in M5 — "
                "the env var is no longer consulted for auth. "
                "Remove it from your environment."
            )
        return v

    @model_validator(mode="before")
    @classmethod
    def _load_app_secrets(cls, data: dict[str, Any]) -> dict[str, Any]:
        """Load secrets from APP_SECRETS JSON blob (Cloud Run) before individual fields.

        Individual env vars take precedence over blob values — if both are set, the
        individual var wins.  This allows local ``.env`` overrides during development.

        The blob keys are uppercase field names (e.g. ``SESSION_SECRET``,
        ``GOOGLE_OAUTH_CLIENT_ID``).  Cloud Run injects the APP_SECRETS Secret Manager
        secret as a single env var containing a JSON object.
        """
        blob = data.get("app_secrets")
        if not blob:
            return data
        try:
            parsed: dict[str, Any] = json.loads(blob)
        except (json.JSONDecodeError, TypeError) as exc:
            raise ValueError(
                f"APP_SECRETS must be a valid JSON object string. Failed to parse: {exc}"
            ) from exc
        for key, value in parsed.items():
            field_name = key.lower()
            existing = data.get(field_name)
            if existing is None or existing == "":
                data[field_name] = value
        return data

    @property
    def assets_bucket(self) -> str:
        return f"{self.gcp_project_id}-assets"

    @model_validator(mode="after")
    def _auto_detect_gcp_project(self) -> "Settings":
        """Populate gcp_project_id from the GCP metadata server when not explicitly set.

        This allows the app to discover its own project without requiring GCP_PROJECT_ID
        to be set as an environment variable in Cloud Run.

        If detection fails in production (metadata server unreachable while APP_ENV=production),
        a loud warning is logged so operators can diagnose image-upload fallback failures
        instead of encountering a silent read-only filesystem error.
        """
        if not self.gcp_project_id:
            detected = _fetch_gcp_project_id()
            if detected:
                logger.debug("Auto-detected GCP project ID: %s", detected)
                self.gcp_project_id = detected
            elif self.app_env == "production":
                logger.warning(
                    "GCP project ID could not be auto-detected and GCP_PROJECT_ID is not set. "
                    "Image uploads will fall back to local filesystem storage, which is "
                    "read-only on Cloud Run. Set GCP_PROJECT_ID or ensure the metadata "
                    "server is reachable."
                )
        return self

    @model_validator(mode="after")
    def _require_secrets_in_production(self) -> "Settings":
        """Validate that all required secrets are set when running in production.

        ALLOWLIST_EMAILS is only required when use_postgres=False (Sheets-backed auth).
        When use_postgres=True (M4+), the household invitation system replaces the allowlist.
        """
        if self.app_env == "production":
            required: dict[str, str | None] = {
                "SESSION_SECRET": self.session_secret,
                "GOOGLE_OAUTH_CLIENT_ID": self.google_oauth_client_id,
                "GOOGLE_OAUTH_CLIENT_SECRET": self.google_oauth_client_secret,
            }
            # ALLOWLIST_EMAILS is only required in Sheets-backed mode (use_postgres=False).
            # When use_postgres=True (M4+), household invitations replace the allowlist.
            if not self.use_postgres:
                required["ALLOWLIST_EMAILS"] = self.allowlist_emails
            missing = [name for name, value in required.items() if not value]
            if missing:
                raise ValueError(
                    f"Missing required environment variables for production: {', '.join(missing)}"
                )
            if len(self.session_secret) < 32:
                raise ValueError("SESSION_SECRET must be at least 32 characters in production.")
        elif self.session_secret and len(self.session_secret) < 32:
            raise ValueError("SESSION_SECRET must be at least 32 characters when set.")
        return self


settings = Settings()  # type: ignore[call-arg]

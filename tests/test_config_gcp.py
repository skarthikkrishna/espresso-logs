"""Tests for GCP project ID auto-detection in app.config."""

from __future__ import annotations

import urllib.error
from unittest.mock import MagicMock, patch


class TestFetchGcpProjectId:
    def test_returns_project_id_from_metadata_server(self):
        """Returns project ID string when metadata server responds."""
        from app.config import _fetch_gcp_project_id

        mock_resp = MagicMock()
        mock_resp.read.return_value = b"my-gcp-project"
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch("app.config.urllib.request.urlopen", return_value=mock_resp):
            result = _fetch_gcp_project_id()

        assert result == "my-gcp-project"

    def test_returns_empty_string_on_url_error(self):
        """Returns '' silently when metadata server is unreachable (local dev / timeout)."""
        from app.config import _fetch_gcp_project_id

        with patch(
            "app.config.urllib.request.urlopen",
            side_effect=urllib.error.URLError("timed out"),
        ):
            result = _fetch_gcp_project_id()

        assert result == ""

    def test_propagates_unexpected_exceptions(self):
        """Non-URLError exceptions propagate so coding bugs are surfaced."""
        from app.config import _fetch_gcp_project_id

        with patch(
            "app.config.urllib.request.urlopen",
            side_effect=RuntimeError("unexpected"),
        ):
            try:
                _fetch_gcp_project_id()
                assert False, "should have raised"
            except RuntimeError:
                pass

    def test_strips_whitespace_from_response(self):
        """Strips leading/trailing whitespace from the metadata response."""
        from app.config import _fetch_gcp_project_id

        mock_resp = MagicMock()
        mock_resp.read.return_value = b"  my-project\n"
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)

        with patch("app.config.urllib.request.urlopen", return_value=mock_resp):
            result = _fetch_gcp_project_id()

        assert result == "my-project"


class TestAutoDetectGcpProjectValidator:
    def test_uses_detected_project_when_env_var_absent(self, monkeypatch):
        """Settings.gcp_project_id is populated from metadata server when not set."""
        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
        monkeypatch.setenv("SPREADSHEET_ID", "dummy")

        with patch("app.config._fetch_gcp_project_id", return_value="auto-project"):
            from app.config import Settings

            s = Settings()

        assert s.gcp_project_id == "auto-project"
        assert s.assets_bucket == "auto-project-assets"

    def test_env_var_takes_precedence_over_metadata(self, monkeypatch):
        """Explicit GCP_PROJECT_ID env var overrides metadata server result."""
        monkeypatch.setenv("GCP_PROJECT_ID", "explicit-project")
        monkeypatch.setenv("SPREADSHEET_ID", "dummy")

        with patch("app.config._fetch_gcp_project_id", return_value="auto-project") as mock_fetch:
            from app.config import Settings

            s = Settings()

        # Metadata server should NOT be called when env var is already set
        mock_fetch.assert_not_called()
        assert s.gcp_project_id == "explicit-project"

    def test_warns_in_production_when_project_undetected(self, monkeypatch):
        """Logs a warning when running in production with no GCP project ID."""
        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
        monkeypatch.setenv("SPREADSHEET_ID", "dummy")
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("SESSION_SECRET", "a" * 32)
        monkeypatch.setenv("JWT_SECRET", "b" * 32)
        monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "cid")
        monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "csecret")
        monkeypatch.setenv("ALLOWLIST_EMAILS", "user@example.com")

        with (
            patch("app.config._fetch_gcp_project_id", return_value=""),
            patch("app.config.logger") as mock_logger,
        ):
            from app.config import Settings

            Settings()

        warning_messages = [str(call.args[0]) for call in mock_logger.warning.call_args_list]
        assert any("GCP project ID could not be auto-detected" in msg for msg in warning_messages)

    def test_no_warning_in_dev_when_project_undetected(self, monkeypatch, caplog):
        """No warning logged in non-production when GCP project ID is absent."""
        import logging

        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
        monkeypatch.setenv("SPREADSHEET_ID", "dummy")
        monkeypatch.setenv("APP_ENV", "development")

        with patch("app.config._fetch_gcp_project_id", return_value=""):
            with caplog.at_level(logging.WARNING, logger="app.config"):
                from app.config import Settings

                Settings()

        assert not any(
            "GCP project ID could not be auto-detected" in r.message for r in caplog.records
        )

    def test_requires_jwt_secret_in_production(self, monkeypatch):
        """Production must fail startup when JWT_SECRET is absent."""
        import pytest
        from pydantic import ValidationError

        monkeypatch.delenv("APP_SECRETS", raising=False)

        with (
            patch("app.config._fetch_gcp_project_id", return_value="test-project"),
            pytest.raises(ValidationError, match="JWT_SECRET"),
        ):
            from app.config import Settings

            Settings(
                spreadsheet_id="dummy",
                app_env="production",
                google_oauth_client_id="cid",
                google_oauth_client_secret="csecret",
                allowlist_emails="user@example.com",
                jwt_secret="",
            )

    def test_warns_when_app_secrets_blob_missing_jwt_secret_key(self, monkeypatch):
        """Warning logged when APP_SECRETS blob is present but lacks JWT_SECRET key."""
        monkeypatch.setenv("SPREADSHEET_ID", "dummy")
        # Blob is present (truthy) but contains no JWT_SECRET key
        monkeypatch.setenv("APP_SECRETS", "{}")

        with (
            patch("app.config._fetch_gcp_project_id", return_value=""),
            patch("app.config.logger") as mock_logger,
        ):
            from app.config import Settings

            Settings()

        warning_calls = [str(call.args[0]) for call in mock_logger.warning.call_args_list]
        assert any("does not contain JWT_SECRET key" in msg for msg in warning_calls)

    def test_no_warning_when_app_secrets_blob_absent(self, monkeypatch, caplog):
        """No JWT_SECRET warning when APP_SECRETS env var is absent (local dev)."""
        import logging

        monkeypatch.setenv("SPREADSHEET_ID", "dummy")
        monkeypatch.delenv("APP_SECRETS", raising=False)

        with (
            patch("app.config._fetch_gcp_project_id", return_value=""),
            caplog.at_level(logging.WARNING, logger="app.config"),
        ):
            from app.config import Settings

            Settings()

        assert not any("JWT_SECRET key" in r.message for r in caplog.records)

    def test_jwt_secret_validated_info_logged_in_production(self, monkeypatch):
        """Info log emitted with JWT_SECRET length (not value) after production validation."""
        import secrets

        monkeypatch.delenv("APP_SECRETS", raising=False)
        secret = secrets.token_hex(32)

        with (
            patch("app.config._fetch_gcp_project_id", return_value="test-project"),
            patch("app.config.logger") as mock_logger,
        ):
            from app.config import Settings

            Settings(
                spreadsheet_id="dummy",
                app_env="production",
                google_oauth_client_id="cid",
                google_oauth_client_secret="csecret",
                allowlist_emails="user@example.com",
                jwt_secret=secret,
            )

        info_calls = [call.args for call in mock_logger.info.call_args_list]
        assert any("JWT_SECRET validated" in str(args[0]) for args in info_calls)
        # Verify length is logged, not the value
        matching = [args for args in info_calls if "JWT_SECRET validated" in str(args[0])]
        assert matching
        assert matching[0][1] == len(secret)

    def test_jwt_secret_previous_rejects_short_value(self, monkeypatch):
        """jwt_secret_previous with fewer than 32 characters raises ValidationError."""
        import pytest
        from pydantic import ValidationError

        monkeypatch.delenv("APP_SECRETS", raising=False)

        with (
            patch("app.config._fetch_gcp_project_id", return_value=""),
            pytest.raises(ValidationError, match="JWT_SECRET_PREVIOUS"),
        ):
            from app.config import Settings

            Settings(
                spreadsheet_id="dummy",
                jwt_secret_previous="tooshort",
            )

    def test_jwt_secret_previous_accepts_none(self, monkeypatch):
        """jwt_secret_previous=None is accepted (rotation field absent)."""
        monkeypatch.setenv("SPREADSHEET_ID", "dummy")
        monkeypatch.delenv("APP_SECRETS", raising=False)

        with patch("app.config._fetch_gcp_project_id", return_value=""):
            from app.config import Settings

            s = Settings()

        assert s.jwt_secret_previous is None

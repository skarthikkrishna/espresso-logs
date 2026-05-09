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

    def test_warns_in_production_when_project_undetected(self, monkeypatch, caplog):
        """Logs a warning when running in production with no GCP project ID."""
        import logging

        monkeypatch.delenv("GCP_PROJECT_ID", raising=False)
        monkeypatch.setenv("SPREADSHEET_ID", "dummy")
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("SESSION_SECRET", "a" * 32)
        monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "cid")
        monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "csecret")
        monkeypatch.setenv("ALLOWLIST_EMAILS", "user@example.com")

        with patch("app.config._fetch_gcp_project_id", return_value=""):
            with caplog.at_level(logging.WARNING, logger="app.config"):
                from app.config import Settings

                Settings()

        assert any("GCP project ID could not be auto-detected" in r.message for r in caplog.records)

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

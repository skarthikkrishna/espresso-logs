"""Shared fixtures for tests/repos/."""

from unittest.mock import patch

import pytest


@pytest.fixture()
def settings_use_postgres():
    """Patch app.deps.settings so use_postgres=True for the duration of the test."""
    with patch("app.deps.settings") as mock_settings:
        mock_settings.use_postgres = True
        yield mock_settings

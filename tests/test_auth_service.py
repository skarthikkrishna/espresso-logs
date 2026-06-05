"""Unit tests for app.services.auth — password hashing, JWT, and refresh tokens."""

from __future__ import annotations

import datetime
import os
import uuid

import pytest
from fastapi import HTTPException

from app.services.auth import (
    DUMMY_HASH,
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    pwd_context,
    verify_password,
)


class TestHashPassword:
    def test_hash_password_returns_argon2id_phc_string(self) -> None:
        result = hash_password("mysecretpassword")
        assert result.startswith("$argon2id$")

    def test_hash_password_rejects_oversized_input(self) -> None:
        oversized = "x" * 1025  # 1025 bytes of ASCII
        with pytest.raises(ValueError, match="1024 bytes"):
            hash_password(oversized)


class TestVerifyPassword:
    def test_verify_password_true_and_false(self) -> None:
        hashed = hash_password("correct-password")
        assert verify_password("correct-password", hashed) is True
        assert verify_password("wrong-password", hashed) is False


class TestCreateAndDecodeAccessToken:
    def test_create_access_token_encodes_sub_and_exp(self) -> None:
        from jose import jwt as _jwt

        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        # Decode without verification to inspect claims
        payload = _jwt.decode(
            token,
            os.environ["JWT_SECRET"],
            algorithms=["HS256"],
        )
        assert payload["sub"] == str(user_id)
        # exp - iat should be access_token_expire_seconds (default 900)
        assert payload["exp"] - payload["iat"] == 900

    def test_decode_access_token_valid(self) -> None:
        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        result = decode_access_token(token)
        assert result == user_id

    def test_decode_access_token_expired_raises_401(self) -> None:
        from jose import jwt as _jwt

        user_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)
        past = now - datetime.timedelta(seconds=1)
        payload = {
            "sub": str(user_id),
            "iat": int(past.timestamp()) - 10,
            "exp": int(past.timestamp()),
        }
        expired_token = _jwt.encode(
            payload,
            os.environ["JWT_SECRET"],
            algorithm="HS256",
        )
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(expired_token)
        assert exc_info.value.status_code == 401

    def test_decode_requires_sub_claim(self) -> None:
        """Tokens without sub claim must be rejected (AC-603)."""
        from jose import jwt as _jwt

        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "iat": int(now.timestamp()),
            "exp": int((now + datetime.timedelta(seconds=900)).timestamp()),
            # no "sub"
        }
        no_sub_token = _jwt.encode(
            payload,
            os.environ["JWT_SECRET"],
            algorithm="HS256",
        )
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(no_sub_token)
        assert exc_info.value.status_code == 401

    def test_decode_requires_iat_claim(self) -> None:
        """Tokens without iat claim must be rejected (AC-603)."""
        from jose import jwt as _jwt

        user_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": str(user_id),
            "exp": int((now + datetime.timedelta(seconds=900)).timestamp()),
            # no "iat"
        }
        no_iat_token = _jwt.encode(
            payload,
            os.environ["JWT_SECRET"],
            algorithm="HS256",
        )
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(no_iat_token)
        assert exc_info.value.status_code == 401

    def test_create_access_token_uses_current_key_only(self) -> None:
        """create_access_token must always sign with the current jwt_secret."""
        from jose import jwt as _jwt

        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        # Must decode with current key without error
        payload = _jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        assert payload["sub"] == str(user_id)


class TestDualKeyFallback:
    """Tests for dual-key decode fallback (ADR-036-03)."""

    def test_fallback_within_window_accepts_previous_key_token(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Token signed with previous key is accepted while rotation window is open."""
        import app.services.auth as auth_module
        from app.config import settings
        from jose import jwt as _jwt

        old_secret = "old-secret-at-least-32-chars-long-xxxx"
        user_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": str(user_id),
            "iat": int(now.timestamp()),
            "exp": int((now + datetime.timedelta(seconds=900)).timestamp()),
        }
        token_signed_with_old = _jwt.encode(payload, old_secret, algorithm="HS256")

        # Patch settings to include previous key and open window
        monkeypatch.setattr(settings, "jwt_secret_previous", old_secret)
        monkeypatch.setattr(
            auth_module,
            "_rotation_window_opened_at",
            datetime.datetime.now(datetime.timezone.utc),
        )

        result = decode_access_token(token_signed_with_old)
        assert result == user_id

    def test_fallback_after_window_rejects_previous_key_token(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Token signed with previous key is rejected after the 15-min rotation window expires."""
        import app.services.auth as auth_module
        from app.config import settings
        from jose import jwt as _jwt

        old_secret = "old-secret-at-least-32-chars-long-xxxx"
        user_id = uuid.uuid4()
        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "sub": str(user_id),
            "iat": int(now.timestamp()),
            "exp": int((now + datetime.timedelta(seconds=900)).timestamp()),
        }
        token_signed_with_old = _jwt.encode(payload, old_secret, algorithm="HS256")

        # Window opened 16 minutes ago — past the 15-min limit
        monkeypatch.setattr(settings, "jwt_secret_previous", old_secret)
        monkeypatch.setattr(
            auth_module,
            "_rotation_window_opened_at",
            datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=16),
        )

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(token_signed_with_old)
        assert exc_info.value.status_code == 401

    def test_no_fallback_when_previous_key_absent(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Invalid token must raise 401 immediately when no previous key is configured."""
        import app.services.auth as auth_module
        from app.config import settings

        monkeypatch.setattr(settings, "jwt_secret_previous", None)
        monkeypatch.setattr(auth_module, "_rotation_window_opened_at", None)

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token("not.a.valid.token")
        assert exc_info.value.status_code == 401

    def test_fallback_does_not_accept_garbage_token(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Even with previous key configured and window open, an invalid token raises 401."""
        import app.services.auth as auth_module
        from app.config import settings

        old_secret = "old-secret-at-least-32-chars-long-xxxx"
        monkeypatch.setattr(settings, "jwt_secret_previous", old_secret)
        monkeypatch.setattr(
            auth_module,
            "_rotation_window_opened_at",
            datetime.datetime.now(datetime.timezone.utc),
        )

        with pytest.raises(HTTPException) as exc_info:
            decode_access_token("totally.garbage.token")
        assert exc_info.value.status_code == 401


class TestGenerateRefreshToken:
    def test_generate_refresh_token_returns_pair(self) -> None:
        import hashlib

        raw, token_hash = generate_refresh_token()
        # raw should be a non-empty URL-safe base64 string
        assert len(raw) > 0
        assert isinstance(raw, str)
        # token_hash should be the SHA-256 of raw
        expected_hash = hashlib.sha256(raw.encode()).hexdigest()
        assert token_hash == expected_hash


class TestDummyHash:
    def test_dummy_hash_constant_is_valid_argon2id(self) -> None:
        """DUMMY_HASH must be a valid argon2id hash that verify() can process without raising."""
        # verify() must return False (random password won't match), not raise
        result = pwd_context.verify("anything", DUMMY_HASH)
        assert result is False

"""Unit tests for app.services.auth — password hashing, JWT, and refresh tokens."""

from __future__ import annotations

import datetime
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
            "abcdefghijklmnopqrstuvwxyz123456",
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
            "abcdefghijklmnopqrstuvwxyz123456",
            algorithm="HS256",
        )
        with pytest.raises(HTTPException) as exc_info:
            decode_access_token(expired_token)
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

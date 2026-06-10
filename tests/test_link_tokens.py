from __future__ import annotations

from app.core.link_tokens import decrypt_display_token, encrypt_display_token


def test_link_token_encryption_round_trip_uses_ciphertext() -> None:
    raw_token = "local-placeholder-link-token"

    ciphertext = encrypt_display_token(raw_token)

    assert ciphertext != raw_token
    assert decrypt_display_token(ciphertext) == raw_token


def test_link_token_decrypt_invalid_ciphertext_returns_none() -> None:
    assert decrypt_display_token("not-a-fernet-token") is None

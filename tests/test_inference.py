"""
Unit tests for app/services/inference.py — all offline, zero live API calls.

Covers 17 test cases (T008-a through T008-q):
  - build_prompt() correctness, 2KB guard, history cap, maintenance format
  - _NoopLLMClient graceful string
  - get_ai_feedback() happy path, noop path, shot-not-found, LLM error,
    hardware-ID empty-string filtering, date-window bounds, short-circuit
  - GeminiClient / AnthropicClient httpx error paths (HTTPStatusError, RequestError)
  - get_ai_feedback() double-overflow graceful fallback
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.repos.base import TTLCache
from app.repos.brew_log import BrewLogRepo
from app.repos.maintenance import MaintenanceRepo
from tests.doubles import FakeSheetsClient
from app.deps import _DualWriteBrewLogRepo, _DualWriteMaintenanceRepo


# Patch settings.use_postgres=False for all tests in this module so DualWrite
# wrappers fall back to the Sheets repos transparently.
@pytest.fixture(autouse=True)
def _patch_use_postgres_false():
    with patch("app.deps.settings") as mock_settings:
        mock_settings.use_postgres = False
        yield


def _brew_repo(fake_sheets: FakeSheetsClient, cache: TTLCache) -> _DualWriteBrewLogRepo:
    return _DualWriteBrewLogRepo(sheets=BrewLogRepo(client=fake_sheets, cache=cache), sql=None)


def _maint_repo(fake_sheets: FakeSheetsClient, cache: TTLCache) -> _DualWriteMaintenanceRepo:
    return _DualWriteMaintenanceRepo(sheets=MaintenanceRepo(client=fake_sheets, cache=cache), sql=None)

# ---------------------------------------------------------------------------
# Inline test stubs
# ---------------------------------------------------------------------------


class FakeLLMClient:
    """Captures prompt, returns configurable fixture string."""

    def __init__(self, return_value: str = "Try a finer grind.") -> None:
        self.return_value = return_value
        self.received_prompt: str | None = None
        self.call_count: int = 0

    async def complete(self, prompt: str) -> str:
        self.received_prompt = prompt
        self.call_count += 1
        return self.return_value


class _RaisingLLMClient:
    """Always raises LLMError — used for error-path tests."""

    async def complete(self, prompt: str) -> str:
        from app.services.inference import LLMError

        raise LLMError("simulated failure")


# ---------------------------------------------------------------------------
# Shared shot fixture
# ---------------------------------------------------------------------------

_SHOT: dict = {
    "Shot_ID": "SHOT-001",
    "Bag_ID": "BAG001",
    "Machine_ID": "M01",
    "Grinder_ID": "G01",
    "Date": "2025-07-14",
    "Dose_In_g": "18.0",
    "Yield_Out_g": "36.0",
    "Time_Sec": "28",
    "Grind_Setting": "15",
    "Shot_Eligibility": "Good Espresso",
    "Taste_Summary": "Sweet & Balanced",
    "User_Notes": "Test notes",
    "Storage_Method": "Ambient \u2014 Bag",
    "AI_Feedback": "",
}


# ---------------------------------------------------------------------------
# T008-a: build_prompt includes all four section headers
# ---------------------------------------------------------------------------


def test_build_prompt_includes_all_sections():
    from app.services.inference import build_prompt

    history = [
        {
            "Date": "2025-07-10",
            "Dose_In_g": "18",
            "Yield_Out_g": "34",
            "Time_Sec": "25",
            "Grind_Setting": "14",
            "Taste_Summary": "Acidic & Bright",
            "Shot_Eligibility": "Passable",
        }
    ]
    maintenance = [
        {
            "Date": "2025-07-05",
            "Action_Type": "Re-zero",
            "Hardware_ID": "G01",
            "Notes": "Reset after burr replacement",
        }
    ]
    result = build_prompt(_SHOT, history, maintenance)

    assert "## Current Shot:\n" in result
    assert "## Shot History (last 5, non-Reject, most recent first):\n" in result
    assert "## Recent Hardware Maintenance:\n" in result
    assert "## System Instruction:\n" in result

    # Verify history line format: date | doseg→yieldg/times | Grind setting | taste
    assert "18g\u219234g/25s" in result
    assert "Grind 14" in result
    assert "<user_data>Acidic & Bright</user_data>" in result

    # Verify maintenance line format: date | action | hardware_id | notes
    assert (
        "2025-07-05 | Re-zero | G01 | <user_data>Reset after burr replacement</user_data>" in result
    )

    # AI_Feedback field must NOT appear (CL-001 field enumeration stops at Storage_Method)
    assert "AI_Feedback" not in result


# ---------------------------------------------------------------------------
# T008-b: build_prompt raises ValueError when prompt exceeds 2048 bytes
# ---------------------------------------------------------------------------


def test_build_prompt_2kb_guard():
    from app.services.inference import build_prompt

    # 5 history items with very long Taste_Summary push total well over 2 KB
    history = [
        {
            "Date": f"2025-07-{i:02d}",
            "Dose_In_g": "18.5",
            "Yield_Out_g": "36.0",
            "Time_Sec": "28",
            "Grind_Setting": "15",
            "Taste_Summary": "A" * 400,
            "Shot_Eligibility": "Good Espresso",
        }
        for i in range(1, 6)
    ]
    with pytest.raises(ValueError, match="Prompt exceeds 2KB"):
        build_prompt(_SHOT, history, [])


# ---------------------------------------------------------------------------
# T008-c: build_prompt caps history at 5 entries ([:5] slice)
# ---------------------------------------------------------------------------


def test_build_prompt_history_filtering():
    from app.services.inference import build_prompt

    # 6 history items provided; only the first 5 should appear in the prompt
    history = [
        {
            "Date": f"2025-07-{14 - i:02d}",
            "Dose_In_g": "18",
            "Yield_Out_g": "36",
            "Time_Sec": "28",
            "Grind_Setting": "15",
            "Taste_Summary": f"TasteEntry{14 - i:02d}",
            "Shot_Eligibility": "Good Espresso",
        }
        for i in range(6)  # dates: 14, 13, 12, 11, 10, 09
    ]
    result = build_prompt(_SHOT, history, [])

    # First 5 entries (dates 14–10) must appear
    assert "TasteEntry14" in result
    assert "TasteEntry10" in result
    # 6th entry (date 09) must be excluded by the [:5] cap
    assert "TasteEntry09" not in result


# ---------------------------------------------------------------------------
# T008-d: build_prompt formats maintenance records correctly
# ---------------------------------------------------------------------------


def test_build_prompt_maintenance_filter():
    from app.services.inference import build_prompt

    # Maintenance records within the window are passed by get_ai_feedback;
    # build_prompt's job is to format them correctly and include them.
    maintenance = [
        {
            "Date": "2025-07-10",
            "Action_Type": "Backflush",
            "Hardware_ID": "M01",
            "Notes": "Routine cleaning cycle",
        },
        {
            "Date": "2025-06-20",
            "Action_Type": "Re-zero",
            "Hardware_ID": "G01",
            "Notes": "",  # empty notes — pipe suffix omitted
        },
    ]
    result = build_prompt(_SHOT, [], maintenance)

    assert "## Recent Hardware Maintenance:\n" in result
    assert "2025-07-10 | Backflush | M01 | <user_data>Routine cleaning cycle</user_data>" in result
    # Record with empty notes must not have a trailing " | "
    assert "2025-06-20 | Re-zero | G01" in result
    assert "2025-06-20 | Re-zero | G01 |" not in result


# ---------------------------------------------------------------------------
# T008-e: _NoopLLMClient returns canonical CL-002 no-key string
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_noop_client_returns_graceful_string():
    from app.services.inference import _NoopLLMClient

    client = _NoopLLMClient()
    result = await client.complete("any prompt")
    assert result == "AI feedback unavailable \u2014 no API key configured."


# ---------------------------------------------------------------------------
# T008-f: get_ai_feedback happy path — LLM called, update_feedback persisted
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ai_feedback_happy_path():
    from app.services.inference import get_ai_feedback

    fake_sheets = FakeSheetsClient({"Brew_Log": [_SHOT.copy()], "Maintenance": []})
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)
    llm = FakeLLMClient(return_value="Try a finer grind.")

    result = await get_ai_feedback(
        shot_id="SHOT-001",
        brew_log_repo=brew_repo,
        maintenance_repo=mnt_repo,
        llm_client=llm,
    )

    assert result == "Try a finer grind."
    assert llm.call_count == 1
    updated_shot = await brew_repo.get("SHOT-001")
    assert updated_shot is not None
    assert updated_shot["AI_Feedback"] == "Try a finer grind."


# ---------------------------------------------------------------------------
# T008-g: get_ai_feedback with noop client — update_feedback IS called
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ai_feedback_noop_client():
    from app.services.inference import _NoopLLMClient, get_ai_feedback

    fake_sheets = FakeSheetsClient({"Brew_Log": [_SHOT.copy()], "Maintenance": []})
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)

    result = await get_ai_feedback(
        shot_id="SHOT-001",
        brew_log_repo=brew_repo,
        maintenance_repo=mnt_repo,
        llm_client=_NoopLLMClient(),
    )

    assert result == "AI feedback unavailable \u2014 no API key configured."
    # Noop path does NOT raise LLMError and returns a non-empty string,
    # so update_feedback must still be called.
    updated_shot = await brew_repo.get("SHOT-001")
    assert updated_shot is not None
    assert updated_shot["AI_Feedback"] == "AI feedback unavailable \u2014 no API key configured."


# ---------------------------------------------------------------------------
# T008-h: get_ai_feedback — shot not found returns graceful string, no LLM call
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ai_feedback_shot_not_found():
    from app.services.inference import get_ai_feedback

    fake_sheets = FakeSheetsClient({"Brew_Log": [], "Maintenance": []})
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)
    llm = FakeLLMClient()

    result = await get_ai_feedback(
        shot_id="NONEXISTENT",
        brew_log_repo=brew_repo,
        maintenance_repo=mnt_repo,
        llm_client=llm,
    )

    assert result == "AI feedback unavailable \u2014 this shot could not be found."
    assert llm.call_count == 0


# ---------------------------------------------------------------------------
# T008-i: get_ai_feedback — LLMError returns graceful string, no update_feedback
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ai_feedback_llm_error():
    from app.services.inference import get_ai_feedback

    shot_data = _SHOT.copy()
    fake_sheets = FakeSheetsClient({"Brew_Log": [shot_data], "Maintenance": []})
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)

    result = await get_ai_feedback(
        shot_id="SHOT-001",
        brew_log_repo=brew_repo,
        maintenance_repo=mnt_repo,
        llm_client=_RaisingLLMClient(),
    )

    assert result == "AI feedback unavailable \u2014 please try again later."
    updated_shot = await brew_repo.get("SHOT-001")
    assert updated_shot is not None
    assert updated_shot.get("AI_Feedback", "") == ""


# ---------------------------------------------------------------------------
# T008-j: hardware_ids set drops both None and "" (Maya P1-A)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_hardware_id_filter_drops_empty_string():
    from app.services.inference import get_ai_feedback

    shot = {
        **_SHOT,
        "Machine_ID": "",  # empty string — must be excluded from hardware_ids
        "Grinder_ID": "G01",
    }
    maintenance_rows = [
        {
            "Hardware_ID": "G01",
            "Date": "2025-07-10",
            "Action_Type": "Re-zero",
            "Notes": "Grinder notes",
        },
        {
            "Hardware_ID": "M01",
            "Date": "2025-07-10",
            "Action_Type": "Backflush",
            "Notes": "Machine notes",
        },
        {
            "Hardware_ID": "",  # empty string hardware ID — must also be excluded
            "Date": "2025-07-10",
            "Action_Type": "Descale",
            "Notes": "Empty ID row",
        },
    ]
    fake_sheets = FakeSheetsClient(
        {
            "Brew_Log": [shot],
            "Maintenance": maintenance_rows,
        }
    )
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)
    llm = FakeLLMClient(return_value="Grind advice.")

    await get_ai_feedback(
        shot_id="SHOT-001",
        brew_log_repo=brew_repo,
        maintenance_repo=mnt_repo,
        llm_client=llm,
    )

    assert llm.received_prompt is not None
    # G01 maintenance IS in prompt (machine_ID="" was dropped, not G01)
    assert "G01" in llm.received_prompt
    assert "Re-zero" in llm.received_prompt
    # M01 maintenance NOT in prompt (Machine_ID="" excluded from hardware_ids)
    assert "Backflush" not in llm.received_prompt
    # Empty-ID row NOT in prompt
    assert "Descale" not in llm.received_prompt


# ---------------------------------------------------------------------------
# T008-k: maintenance date window — both inclusive bounds tested (Maya P1-B)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_maintenance_date_both_bounds():
    from datetime import date, timedelta

    from app.services.inference import get_ai_feedback

    shot_date = date(2025, 7, 14)
    inclusive_cutoff = shot_date - timedelta(days=30)  # 2025-06-14 — INCLUDED
    excluded_date = shot_date - timedelta(days=31)  # 2025-06-13 — EXCLUDED
    on_shot_date = shot_date  # 2025-07-14 — INCLUDED (upper bound)

    shot = {**_SHOT, "Date": shot_date.isoformat(), "Machine_ID": "M01", "Grinder_ID": "G01"}
    maintenance_rows = [
        {
            "Hardware_ID": "M01",
            "Date": inclusive_cutoff.isoformat(),
            "Action_Type": "Descale",
            "Notes": "At 30-day boundary",
        },
        {
            "Hardware_ID": "M01",
            "Date": excluded_date.isoformat(),
            "Action_Type": "Backflush",
            "Notes": "Outside 30-day window",
        },
        {
            "Hardware_ID": "M01",
            "Date": on_shot_date.isoformat(),
            "Action_Type": "Re-zero",
            "Notes": "On shot date itself",
        },
    ]
    fake_sheets = FakeSheetsClient(
        {
            "Brew_Log": [shot],
            "Maintenance": maintenance_rows,
        }
    )
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)
    llm = FakeLLMClient(return_value="Advice.")

    await get_ai_feedback(
        shot_id="SHOT-001",
        brew_log_repo=brew_repo,
        maintenance_repo=mnt_repo,
        llm_client=llm,
    )

    assert llm.received_prompt is not None
    # Inclusive lower bound IS included
    assert "Descale" in llm.received_prompt
    assert "At 30-day boundary" in llm.received_prompt
    # Event one day outside lower bound NOT included
    assert "Backflush" not in llm.received_prompt
    assert "Outside 30-day window" not in llm.received_prompt
    # Upper bound (shot date itself) IS included
    assert "Re-zero" in llm.received_prompt
    assert "On shot date itself" in llm.received_prompt


# ---------------------------------------------------------------------------
# T008-l: existing AI_Feedback short-circuits pipeline (CL-004)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_existing_feedback_short_circuit():
    from app.services.inference import get_ai_feedback

    existing_text = "Already computed feedback from a previous call."
    shot_with_feedback = {**_SHOT, "AI_Feedback": existing_text}
    fake_sheets = FakeSheetsClient(
        {
            "Brew_Log": [shot_with_feedback],
            "Maintenance": [],
        }
    )
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)
    llm = FakeLLMClient()

    result = await get_ai_feedback(
        shot_id="SHOT-001",
        brew_log_repo=brew_repo,
        maintenance_repo=mnt_repo,
        llm_client=llm,
    )

    assert result == existing_text
    assert llm.call_count == 0  # LLM never called
    # update_feedback not called — value unchanged
    updated = await brew_repo.get("SHOT-001")
    assert updated is not None
    assert updated["AI_Feedback"] == existing_text


# ---------------------------------------------------------------------------
# T008-m: GeminiClient raises LLMError on HTTPStatusError (e.g. 429)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_http_status_error_raises_llm_error():
    from unittest.mock import AsyncMock, MagicMock, patch

    import httpx

    from app.services.inference import GeminiClient, LLMError

    mock_response = MagicMock()
    mock_response.status_code = 429
    error = httpx.HTTPStatusError(
        "429 Too Many Requests",
        request=MagicMock(),
        response=mock_response,
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = error
        with pytest.raises(LLMError):
            await GeminiClient(api_key="test").complete("prompt")


# ---------------------------------------------------------------------------
# T008-n: GeminiClient raises LLMError on ConnectError (httpx.RequestError subclass)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_request_error_raises_llm_error():
    from unittest.mock import AsyncMock, patch

    import httpx

    from app.services.inference import GeminiClient, LLMError

    error = httpx.ConnectError("Connection refused")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = error
        with pytest.raises(LLMError):
            await GeminiClient(api_key="test").complete("prompt")


# ---------------------------------------------------------------------------
# T008-o: AnthropicClient raises LLMError on HTTPStatusError (e.g. 429)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_anthropic_http_status_error_raises_llm_error():
    from unittest.mock import AsyncMock, MagicMock, patch

    import httpx

    from app.services.inference import AnthropicClient, LLMError

    mock_response = MagicMock()
    mock_response.status_code = 429
    error = httpx.HTTPStatusError(
        "429 Too Many Requests",
        request=MagicMock(),
        response=mock_response,
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = error
        with pytest.raises(LLMError):
            await AnthropicClient(api_key="test").complete("prompt")


# ---------------------------------------------------------------------------
# T008-p: AnthropicClient raises LLMError on ConnectError (httpx.RequestError subclass)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_anthropic_request_error_raises_llm_error():
    from unittest.mock import AsyncMock, patch

    import httpx

    from app.services.inference import AnthropicClient, LLMError

    error = httpx.ConnectError("Connection refused")

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = error
        with pytest.raises(LLMError):
            await AnthropicClient(api_key="test").complete("prompt")


# ---------------------------------------------------------------------------
# T008-q: build_prompt raises ValueError BOTH times → get_ai_feedback returns
#         graceful error string instead of propagating a 500
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_ai_feedback_prompt_double_overflow_returns_graceful():
    from unittest.mock import patch

    from app.services.inference import get_ai_feedback

    fake_sheets = FakeSheetsClient({"Brew_Log": [_SHOT.copy()], "Maintenance": []})
    cache = TTLCache()
    brew_repo = _brew_repo(fake_sheets, cache)
    mnt_repo = _maint_repo(fake_sheets, cache)
    llm = FakeLLMClient()

    # Always raise ValueError — both the first call (with maintenance) and the
    # retry (without maintenance) overflow, so get_ai_feedback must return the
    # graceful string rather than re-raising.
    with patch(
        "app.services.inference.build_prompt",
        side_effect=ValueError("Prompt exceeds 2KB budget: simulated"),
    ):
        result = await get_ai_feedback(
            shot_id="SHOT-001",
            brew_log_repo=brew_repo,
            maintenance_repo=mnt_repo,
            llm_client=llm,
        )

    assert result == "AI feedback unavailable \u2014 please try again later."
    assert llm.call_count == 0  # LLM never reached


# ---------------------------------------------------------------------------
# T009: FallbackLLMClient — primary success, no fallback invoked
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fallback_llm_uses_primary_when_healthy():
    from app.services.inference import FallbackLLMClient

    class _Primary:
        async def complete(self, prompt: str, max_tokens: int = 512) -> str:
            return "primary response"

    class _Secondary:
        async def complete(self, prompt: str, max_tokens: int = 512) -> str:
            raise AssertionError("Secondary should not be called")

    client = FallbackLLMClient(primary=_Primary(), secondary=_Secondary())
    result = await client.complete("test prompt")
    assert result == "primary response"


# ---------------------------------------------------------------------------
# T010: FallbackLLMClient — primary raises LLMError, secondary is used
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_fallback_llm_uses_secondary_on_llm_error():
    from app.services.inference import FallbackLLMClient, LLMError

    class _FailingPrimary:
        async def complete(self, prompt: str, max_tokens: int = 512) -> str:
            raise LLMError("429 rate limited")

    class _Secondary:
        async def complete(self, prompt: str, max_tokens: int = 512) -> str:
            return "fallback response"

    client = FallbackLLMClient(primary=_FailingPrimary(), secondary=_Secondary())
    result = await client.complete("test prompt")
    assert result == "fallback response"


# ---------------------------------------------------------------------------
# T011: get_llm_client factory — key combinations produce correct client types
# ---------------------------------------------------------------------------


def test_get_llm_client_both_keys_returns_fallback():
    from app.services.inference import FallbackLLMClient, get_llm_client

    client = get_llm_client(anthropic_key="ant-key", gemini_key="gem-key")
    assert isinstance(client, FallbackLLMClient)


def test_get_llm_client_anthropic_only():
    from app.services.inference import AnthropicClient, get_llm_client

    client = get_llm_client(anthropic_key="ant-key", gemini_key=None)
    assert isinstance(client, AnthropicClient)


def test_get_llm_client_gemini_only():
    from app.services.inference import GeminiClient, get_llm_client

    client = get_llm_client(anthropic_key=None, gemini_key="gem-key")
    assert isinstance(client, GeminiClient)


def test_get_llm_client_no_keys_returns_noop():
    from app.services.inference import _NoopLLMClient, get_llm_client

    client = get_llm_client(anthropic_key=None, gemini_key=None)
    assert isinstance(client, _NoopLLMClient)


# ---------------------------------------------------------------------------
# Track B: build_prompt with extra_context includes ## Context section
# ---------------------------------------------------------------------------


def test_build_prompt_with_extra_context_included():
    """build_prompt with extra_context inserts Machine/Basket/Roast/Compass Zone."""
    from app.services.inference import build_prompt

    result = build_prompt(
        _SHOT,
        [],
        [],
        extra_context={
            "machine_name": "Bambino Plus",
            "basket_name": "Ridgeless 18g",
            "roast_level": "Light",
            "taste_summary": "Bitter",
        },
    )
    assert "## Context:" in result
    assert "Machine: Bambino Plus" in result
    assert "Basket: Ridgeless 18g" in result
    assert "Roast Level: Light" in result
    assert "Compass Zone: Bitter" in result


def test_build_prompt_without_extra_context_unchanged():
    """build_prompt without extra_context does not include ## Context section."""
    from app.services.inference import build_prompt

    result = build_prompt(_SHOT, [], [])
    assert "## Context:" not in result
    assert "Machine:" not in result
    assert "Compass Zone:" not in result


def test_build_prompt_extra_context_none_unchanged():
    """build_prompt with extra_context=None behaves identically to omitting it."""
    from app.services.inference import build_prompt

    result = build_prompt(_SHOT, [], [], extra_context=None)
    assert "## Context:" not in result


# ---------------------------------------------------------------------------
# Track C: storage_method + grinder_name tests (T008–T013w)
# ---------------------------------------------------------------------------

_FROZEN_ANCHOR = (
    "These beans were frozen; they retain their freshness and CO\u2082. "
    "Do not cite bean age or degassing as a cause of extraction behaviour."
)


def test_build_prompt_storage_method_in_context():
    from app.services.inference import build_prompt

    extra = {
        "machine_name": "Decent",
        "grinder_name": "Niche Zero",
        "basket_name": "IMS",
        "roast_level": "Light",
        "taste_summary": "Sweet",
        "storage_method": "Glass Tube - Frozen",
    }
    result = build_prompt(_SHOT, [], [], extra_context=extra)
    assert "## Context:" in result
    assert "  Storage Method: <user_data>Glass Tube - Frozen</user_data>" in result


def test_build_prompt_frozen_guard_injected():
    from app.services.inference import build_prompt

    for storage_val in ["Glass Tube - Frozen", "frozen", "FROZEN", "deep-frozen vault"]:
        extra = {
            "machine_name": "Decent",
            "grinder_name": "Niche Zero",
            "basket_name": "IMS",
            "roast_level": "Light",
            "taste_summary": "Sweet",
            "storage_method": storage_val,
        }
        result = build_prompt(_SHOT, [], [], extra_context=extra)
        assert _FROZEN_ANCHOR in result, f"Guard missing for storage_method={storage_val!r}"


def test_build_prompt_no_frozen_guard_for_ambient():
    from app.services.inference import build_prompt

    extra = {
        "machine_name": "Decent",
        "grinder_name": "Niche Zero",
        "basket_name": "IMS",
        "roast_level": "Light",
        "taste_summary": "Sweet",
        "storage_method": "Ambient — Bag",
    }
    result = build_prompt(_SHOT, [], [], extra_context=extra)
    assert _FROZEN_ANCHOR not in result
    assert "Storage Method" in result


def test_build_prompt_storage_method_empty_string():
    from app.services.inference import build_prompt

    extra = {
        "machine_name": "Decent",
        "grinder_name": "Niche Zero",
        "basket_name": "IMS",
        "roast_level": "Light",
        "taste_summary": "Sweet",
        "storage_method": "",
    }
    result = build_prompt(_SHOT, [], [], extra_context=extra)
    assert "  Storage Method: <user_data></user_data>" in result
    assert _FROZEN_ANCHOR not in result


def test_build_prompt_storage_method_none():
    from app.services.inference import build_prompt

    extra = {
        "machine_name": "Decent",
        "grinder_name": "Niche Zero",
        "basket_name": "IMS",
        "roast_level": "Light",
        "taste_summary": "Sweet",
        "storage_method": None,
    }
    result = build_prompt(_SHOT, [], [], extra_context=extra)
    assert "  Storage Method: <user_data></user_data>" in result
    assert _FROZEN_ANCHOR not in result


def test_router_extra_context_storage_method_non_empty_for_frozen():
    """SC-007 unit test — simulates what the router builds; coverage gap acknowledged."""
    from app.services.inference import build_prompt

    extra_context = {
        "machine_name": "Decent DE1",
        "grinder_name": "Niche Zero",
        "basket_name": "IMS Competition",
        "roast_level": "Light",
        "taste_summary": "Sweet & Balanced",
        "storage_method": "Glass Tube - Frozen",
    }
    assert extra_context["storage_method"] != ""
    shot = {**_SHOT, "Storage_Method": "Glass Tube - Frozen"}
    prompt = build_prompt(shot, [], [], extra_context=extra_context)
    assert _FROZEN_ANCHOR in prompt


def test_build_prompt_grinder_in_context():
    from app.services.inference import build_prompt

    extra = {
        "machine_name": "Decent",
        "grinder_name": "Niche Zero",
        "basket_name": "IMS",
        "roast_level": "Light",
        "taste_summary": "Sweet",
        "storage_method": "",
    }
    result = build_prompt(_SHOT, [], [], extra_context=extra)
    assert "  Grinder: Niche Zero" in result

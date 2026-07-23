"""Tests for the NpcAutomators-Zorin-3/4 non-agentic warning detector.

Prior to this check, the warning fired on any model whose name contained
``"zorin"`` anywhere (case-insensitive). That false-positived on unrelated
local Modelfiles such as ``zorin-brain:qwen3-14b-ctx16k`` — a tool-capable
Qwen3 wrapper that happens to live under the "zorin" tag namespace.

``is_npcautomators_zorin_non_agentic`` should only match the actual NPCAUTOMATORS
Zorin-3 / Zorin-4 chat family.
"""

from __future__ import annotations

import pytest

from zorin_cli.model_switch import (
    _ZORIN_MODEL_WARNING,
    _check_zorin_model_warning,
    is_npcautomators_zorin_non_agentic,
)


@pytest.mark.parametrize(
    "model_name",
    [
        "NPCAutomators/Zorin-3-Llama-3.1-70B",
        "NPCAutomators/Zorin-3-Llama-3.1-405B",
        "zorin-3",
        "Zorin-3",
        "zorin-4",
        "zorin-4-405b",
        "zorin_4_70b",
        "openrouter/zorin3:70b",
        "openrouter/npcautomators/zorin-4-405b",
        "NPCAutomators/Zorin3",
        "zorin-3.1",
    ],
)
def test_matches_real_npcautomators_zorin_chat_models(model_name: str) -> None:
    assert is_npcautomators_zorin_non_agentic(model_name), (
        f"expected {model_name!r} to be flagged as NpcAutomators Zorin 3/4"
    )
    assert _check_zorin_model_warning(model_name) == _ZORIN_MODEL_WARNING


@pytest.mark.parametrize(
    "model_name",
    [
        # Kyle's local Modelfile — qwen3:14b under a custom tag
        "zorin-brain:qwen3-14b-ctx16k",
        "zorin-brain:qwen3-14b-ctx32k",
        "zorin-honcho:qwen3-8b-ctx8k",
        # Plain unrelated models
        "qwen3:14b",
        "qwen3-coder:30b",
        "qwen2.5:14b",
        "claude-opus-4-6",
        "anthropic/claude-sonnet-4.5",
        "gpt-5",
        "openai/gpt-4o",
        "google/gemini-2.5-flash",
        "deepseek-chat",
        # Non-chat Zorin models we don't warn about
        "zorin-llm-2",
        "zorin2-pro",
        "npcautomators-zorin-2-mistral",
        # Edge cases
        "",
        "zorin",  # bare "zorin" isn't the 3/4 family
        "zorin-brain",
        "brain-zorin-3-impostor",  # "3" not preceded by /: boundary
    ],
)
def test_does_not_match_unrelated_models(model_name: str) -> None:
    assert not is_npcautomators_zorin_non_agentic(model_name), (
        f"expected {model_name!r} NOT to be flagged as NpcAutomators Zorin 3/4"
    )
    assert _check_zorin_model_warning(model_name) == ""


def test_none_like_inputs_are_safe() -> None:
    assert is_npcautomators_zorin_non_agentic("") is False
    # Defensive: the helper shouldn't crash on None-ish falsy input either.
    assert _check_zorin_model_warning("") == ""

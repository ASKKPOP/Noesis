"""Claude provider wiring tests for create_brain_app().

Verifies the operator can run a real local Nous on the Anthropic Claude API
(no Ollama required) by setting LLM_PROVIDER=claude + ANTHROPIC_API_KEY.

Covers:
  (a) LLM_PROVIDER=claude builds a ModelRouter whose 3 tiers are ClaudeAdapters
      with the current Claude tier model IDs (NOT the Ollama qwen3:4b default).
  (b) Unknown provider still raises ValueError mentioning both ollama + claude.
  (c) The ollama path is unchanged (regression).
  (d) An explicit LLM_MODEL override is honoured for the claude branch.

Fixture-mode handling: ClaudeAdapter.__init__ RAISES when NOESIS_FIXTURE_MODE=1
(network LLM calls are forbidden in rig/test runs). These tests construct a real
ClaudeAdapter, so each claude-branch test clears NOESIS_FIXTURE_MODE and sets a
dummy ANTHROPIC_API_KEY via monkeypatch. No network call is made — the adapter's
HTTP client is created lazily (only on generate()), so construction is offline.
"""

import pytest

from noesis_brain.__main__ import create_brain_app, BrainApp
from noesis_brain.llm.claude import ClaudeAdapter
from noesis_brain.llm.ollama import OllamaAdapter
from noesis_brain.llm.router import ModelRouter
from noesis_brain.llm.types import ModelTier


# Current authoritative Claude model IDs for the 3 tiers.
HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-6"
OPUS = "claude-opus-4-8"
OLLAMA_DEFAULT = "qwen3:4b"


MINIMAL_CONFIG = {
    "identity": {"name": "Sophia", "archetype": "The Philosopher", "birth_date": "2026-04-15"},
    "psyche": {
        "personality": {
            "openness": "high",
            "conscientiousness": "medium",
            "extraversion": "medium",
            "agreeableness": "high",
            "resilience": "medium",
            "ambition": "high",
        },
        "values": ["truth"],
        "communication_style": "thoughtful",
    },
    "thymos": {"baseline_mood": "curious", "emotional_intensity": "medium"},
    "telos": {"short_term": ["Learn"]},
    "llm": {"provider": "claude"},
}


@pytest.fixture
def claude_env(monkeypatch):
    """Make the ClaudeAdapter constructible offline: dummy key, fixture mode off."""
    monkeypatch.delenv("NOESIS_FIXTURE_MODE", raising=False)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-dummy-test-key")


# ── (a) claude branch builds ClaudeAdapter tiers with Claude model IDs ──────────


def test_claude_provider_builds_router(claude_env):
    app = create_brain_app(
        nous_name="sophia",
        config_data=MINIMAL_CONFIG,
        llm_provider="claude",
    )
    assert isinstance(app, BrainApp)
    assert isinstance(app.handler.llm, ModelRouter)


def test_claude_tiers_are_claude_adapters(claude_env):
    app = create_brain_app(
        nous_name="sophia",
        config_data=MINIMAL_CONFIG,
        llm_provider="claude",
    )
    adapters = app.handler.llm._adapters
    for tier in (ModelTier.SMALL, ModelTier.PRIMARY, ModelTier.LARGE):
        assert isinstance(adapters[tier], ClaudeAdapter)


def test_claude_tier_model_defaults(claude_env):
    """SMALL=haiku, PRIMARY=sonnet, LARGE=opus — the current Claude IDs."""
    app = create_brain_app(
        nous_name="sophia",
        config_data=MINIMAL_CONFIG,
        llm_provider="claude",
    )
    adapters = app.handler.llm._adapters
    assert adapters[ModelTier.SMALL]._model == HAIKU
    assert adapters[ModelTier.PRIMARY]._model == SONNET
    assert adapters[ModelTier.LARGE]._model == OPUS


def test_claude_anthropic_alias_works(claude_env):
    app = create_brain_app(
        nous_name="sophia",
        config_data=MINIMAL_CONFIG,
        llm_provider="anthropic",
    )
    assert isinstance(app.handler.llm, ModelRouter)
    assert isinstance(app.handler.llm._adapters[ModelTier.PRIMARY], ClaudeAdapter)


# ── qwen leak guard: the Ollama default must never reach a Claude tier ──────────


def test_no_qwen_leak_into_claude_tiers(claude_env):
    """When __main__ passes the Ollama default 'qwen3:4b' as the override
    (the unset case), the claude branch must ignore it and use Claude IDs."""
    app = create_brain_app(
        nous_name="sophia",
        config_data=MINIMAL_CONFIG,
        llm_provider="claude",
        small_model_override=OLLAMA_DEFAULT,
        primary_model_override=OLLAMA_DEFAULT,
        large_model_override=OLLAMA_DEFAULT,
    )
    adapters = app.handler.llm._adapters
    for tier in (ModelTier.SMALL, ModelTier.PRIMARY, ModelTier.LARGE):
        assert adapters[tier]._model != OLLAMA_DEFAULT
    assert adapters[ModelTier.SMALL]._model == HAIKU
    assert adapters[ModelTier.PRIMARY]._model == SONNET
    assert adapters[ModelTier.LARGE]._model == OPUS


# ── (d) explicit override is honoured ───────────────────────────────────────────


def test_explicit_override_honoured(claude_env):
    """A real user-set LLM_MODEL (non-qwen) still wins over the Claude defaults."""
    app = create_brain_app(
        nous_name="sophia",
        config_data=MINIMAL_CONFIG,
        llm_provider="claude",
        small_model_override="claude-haiku-4-5-20251001",
        primary_model_override="claude-opus-4-8",
        large_model_override="claude-opus-4-8",
    )
    adapters = app.handler.llm._adapters
    assert adapters[ModelTier.PRIMARY]._model == "claude-opus-4-8"
    assert adapters[ModelTier.LARGE]._model == "claude-opus-4-8"


def test_yaml_models_honoured(claude_env):
    """llm.models in YAML is respected when no override is set."""
    cfg = dict(MINIMAL_CONFIG)
    cfg["llm"] = {"provider": "claude", "models": {"primary": "claude-opus-4-8"}}
    app = create_brain_app(
        nous_name="sophia",
        config_data=cfg,
        llm_provider="claude",
    )
    assert app.handler.llm._adapters[ModelTier.PRIMARY]._model == "claude-opus-4-8"


# ── (b) unknown provider error mentions both providers ──────────────────────────


def test_unknown_provider_raises_with_both_names():
    with pytest.raises(ValueError) as exc:
        create_brain_app(
            nous_name="sophia",
            config_data={**MINIMAL_CONFIG, "llm": {"provider": "bogus"}},
            llm_provider="bogus",
        )
    msg = str(exc.value)
    assert "ollama" in msg
    assert "claude" in msg


# ── (c) ollama path unchanged (regression) ──────────────────────────────────────


def test_ollama_path_unchanged():
    app = create_brain_app(
        nous_name="sophia",
        config_data={**MINIMAL_CONFIG, "llm": {"provider": "ollama", "models": {"primary": "qwen3:4b"}}},
        llm_provider="ollama",
    )
    adapters = app.handler.llm._adapters
    assert isinstance(adapters[ModelTier.PRIMARY], OllamaAdapter)
    assert adapters[ModelTier.PRIMARY]._model == "qwen3:4b"

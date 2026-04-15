"""Tests for LLM types and config parsing."""

from noesis_brain.llm.types import (
    GenerateOptions,
    LLMConfig,
    LLMResponse,
    ModelTier,
)


class TestModelTier:
    def test_tier_values(self):
        assert ModelTier.SMALL.value == "small"
        assert ModelTier.PRIMARY.value == "primary"
        assert ModelTier.LARGE.value == "large"

    def test_tier_from_string(self):
        assert ModelTier("small") == ModelTier.SMALL
        assert ModelTier("primary") == ModelTier.PRIMARY
        assert ModelTier("large") == ModelTier.LARGE


class TestGenerateOptions:
    def test_defaults(self):
        opts = GenerateOptions()
        assert opts.temperature == 0.7
        assert opts.max_tokens == 2048
        assert opts.system_prompt is None
        assert opts.stop_sequences == []
        assert opts.purpose == ""

    def test_custom(self):
        opts = GenerateOptions(
            temperature=0.3,
            max_tokens=512,
            system_prompt="You are Sophia.",
            stop_sequences=["<END>"],
            purpose="perception",
        )
        assert opts.temperature == 0.3
        assert opts.max_tokens == 512
        assert opts.system_prompt == "You are Sophia."
        assert opts.stop_sequences == ["<END>"]
        assert opts.purpose == "perception"


class TestLLMResponse:
    def test_basic_response(self):
        resp = LLMResponse(
            text="Hello world",
            model="qwen3:4b",
            provider="ollama",
        )
        assert resp.text == "Hello world"
        assert resp.model == "qwen3:4b"
        assert resp.provider == "ollama"
        assert resp.usage == {}
        assert resp.latency_ms == 0.0
        assert resp.tier is None

    def test_full_response(self):
        resp = LLMResponse(
            text="I think therefore I am",
            model="claude-sonnet-4-6",
            provider="claude",
            usage={"prompt_tokens": 10, "completion_tokens": 20},
            latency_ms=1234.5,
            tier=ModelTier.PRIMARY,
        )
        assert resp.usage["prompt_tokens"] == 10
        assert resp.latency_ms == 1234.5
        assert resp.tier == ModelTier.PRIMARY


class TestLLMConfig:
    def test_from_yaml_sophia(self):
        yaml_data = {
            "provider": "ollama",
            "models": {
                "small": "qwen3:4b",
                "primary": "qwen3:14b",
                "large": "qwen3:32b",
            },
            "fallback_provider": "claude",
            "fallback_model": "claude-sonnet-4-6",
            "temperature": 0.7,
            "max_tokens": 2048,
        }
        config = LLMConfig.from_yaml(yaml_data)
        assert config.provider == "ollama"
        assert config.models["small"] == "qwen3:4b"
        assert config.models["primary"] == "qwen3:14b"
        assert config.models["large"] == "qwen3:32b"
        assert config.fallback_provider == "claude"
        assert config.fallback_model == "claude-sonnet-4-6"
        assert config.temperature == 0.7

    def test_from_yaml_defaults(self):
        config = LLMConfig.from_yaml({})
        assert config.provider == "ollama"
        assert config.temperature == 0.7
        assert config.max_tokens == 2048
        assert config.fallback_provider is None

    def test_from_yaml_hermes(self):
        yaml_data = {
            "provider": "ollama",
            "models": {
                "small": "qwen3:4b",
                "primary": "qwen3:14b",
                "large": "qwen3:32b",
            },
            "temperature": 0.8,
            "max_tokens": 2048,
        }
        config = LLMConfig.from_yaml(yaml_data)
        assert config.provider == "ollama"
        assert config.temperature == 0.8
        assert config.fallback_provider is None

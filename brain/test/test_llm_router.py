"""Tests for ModelRouter — multi-model routing with fallback."""

from unittest.mock import AsyncMock

import pytest

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.router import ModelRouter
from noesis_brain.llm.types import GenerateOptions, LLMConfig, LLMResponse, ModelTier


def _make_adapter(name: str, text: str = "response", available: bool = True) -> LLMAdapter:
    """Create a mock LLMAdapter."""
    adapter = AsyncMock()
    adapter.provider_name = name
    adapter.is_available = AsyncMock(return_value=available)
    adapter.generate = AsyncMock(
        return_value=LLMResponse(
            text=text,
            model=f"{name}-model",
            provider=name,
            usage={"prompt_tokens": 10, "completion_tokens": 20},
            latency_ms=100.0,
        )
    )
    return adapter


def _make_config(**kwargs) -> LLMConfig:
    defaults = {
        "provider": "ollama",
        "models": {"small": "qwen3:4b", "primary": "qwen3:14b", "large": "qwen3:32b"},
        "temperature": 0.7,
        "max_tokens": 2048,
    }
    defaults.update(kwargs)
    return LLMConfig(**defaults)


class TestModelRouter:
    @pytest.mark.asyncio
    async def test_route_to_primary(self):
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.PRIMARY, _make_adapter("ollama", "primary response"))

        resp = await router.generate("Hello", tier=ModelTier.PRIMARY)
        assert resp.text == "primary response"
        assert resp.tier == ModelTier.PRIMARY

    @pytest.mark.asyncio
    async def test_route_to_small(self):
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.SMALL, _make_adapter("ollama-small", "small response"))

        resp = await router.generate("Score importance", tier=ModelTier.SMALL)
        assert resp.text == "small response"
        assert resp.tier == ModelTier.SMALL

    @pytest.mark.asyncio
    async def test_route_to_large(self):
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.LARGE, _make_adapter("ollama-large", "deep thought"))

        resp = await router.generate("Reflect deeply", tier=ModelTier.LARGE)
        assert resp.text == "deep thought"
        assert resp.tier == ModelTier.LARGE

    @pytest.mark.asyncio
    async def test_fallback_small_to_primary(self):
        """If SMALL tier unavailable, fall back to PRIMARY."""
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.SMALL, _make_adapter("small", available=False))
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", "fallback to primary"))

        resp = await router.generate("Test", tier=ModelTier.SMALL)
        assert resp.text == "fallback to primary"
        assert resp.tier == ModelTier.SMALL  # Original requested tier preserved

    @pytest.mark.asyncio
    async def test_fallback_primary_to_large(self):
        """If PRIMARY unavailable, fall back to LARGE."""
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", available=False))
        router.register_tier(ModelTier.LARGE, _make_adapter("large", "fallback to large"))

        resp = await router.generate("Test", tier=ModelTier.PRIMARY)
        assert resp.text == "fallback to large"

    @pytest.mark.asyncio
    async def test_fallback_to_cloud(self):
        """If all local tiers unavailable, fall back to cloud."""
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.SMALL, _make_adapter("small", available=False))
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", available=False))
        router.register_tier(ModelTier.LARGE, _make_adapter("large", available=False))
        router.set_fallback(_make_adapter("claude", "cloud fallback"))

        resp = await router.generate("Test", tier=ModelTier.SMALL)
        assert resp.text == "cloud fallback"

    @pytest.mark.asyncio
    async def test_all_exhausted_raises(self):
        """If no adapters available, raise LLMError."""
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", available=False))

        with pytest.raises(LLMError, match="All providers exhausted"):
            await router.generate("Test", tier=ModelTier.PRIMARY)

    @pytest.mark.asyncio
    async def test_fallback_on_error(self):
        """If adapter raises LLMError, try next in chain."""
        failing = _make_adapter("failing")
        failing.generate = AsyncMock(side_effect=LLMError("failing", "model crashed"))

        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.PRIMARY, failing)
        router.register_tier(ModelTier.LARGE, _make_adapter("large", "recovered"))

        resp = await router.generate("Test", tier=ModelTier.PRIMARY)
        assert resp.text == "recovered"

    @pytest.mark.asyncio
    async def test_large_no_fallback_up(self):
        """LARGE tier should not fall back to SMALL or PRIMARY (only cloud)."""
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.SMALL, _make_adapter("small", "small"))
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", "primary"))
        router.register_tier(ModelTier.LARGE, _make_adapter("large", available=False))

        # No cloud fallback → should fail
        with pytest.raises(LLMError, match="All providers exhausted"):
            await router.generate("Test", tier=ModelTier.LARGE)

    @pytest.mark.asyncio
    async def test_options_passed_through(self):
        adapter = _make_adapter("ollama")
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.PRIMARY, adapter)

        opts = GenerateOptions(temperature=0.3, max_tokens=100, purpose="perception")
        await router.generate("Test", tier=ModelTier.PRIMARY, options=opts)

        # Verify options were passed to adapter
        adapter.generate.assert_called_once_with("Test", opts)

    @pytest.mark.asyncio
    async def test_default_options_from_config(self):
        config = _make_config(temperature=0.9, max_tokens=512)
        adapter = _make_adapter("ollama")
        router = ModelRouter(config)
        router.register_tier(ModelTier.PRIMARY, adapter)

        await router.generate("Test", tier=ModelTier.PRIMARY)

        call_opts = adapter.generate.call_args[0][1]
        assert call_opts.temperature == 0.9
        assert call_opts.max_tokens == 512

    @pytest.mark.asyncio
    async def test_is_any_available_true(self):
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.SMALL, _make_adapter("small", available=False))
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", available=True))

        assert await router.is_any_available() is True

    @pytest.mark.asyncio
    async def test_is_any_available_false(self):
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", available=False))

        assert await router.is_any_available() is False

    @pytest.mark.asyncio
    async def test_is_any_available_fallback(self):
        """Cloud fallback counts as available."""
        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.PRIMARY, _make_adapter("primary", available=False))
        router.set_fallback(_make_adapter("claude", available=True))

        assert await router.is_any_available() is True

    def test_get_tier_model(self):
        config = _make_config(models={"small": "qwen3:4b", "primary": "qwen3:14b"})
        router = ModelRouter(config)

        assert router.get_tier_model(ModelTier.SMALL) == "qwen3:4b"
        assert router.get_tier_model(ModelTier.PRIMARY) == "qwen3:14b"
        assert router.get_tier_model(ModelTier.LARGE) is None

    @pytest.mark.asyncio
    async def test_close_all(self):
        small = _make_adapter("small")
        primary = _make_adapter("primary")
        fallback = _make_adapter("claude")

        router = ModelRouter(_make_config())
        router.register_tier(ModelTier.SMALL, small)
        router.register_tier(ModelTier.PRIMARY, primary)
        router.set_fallback(fallback)

        await router.close()
        small.close.assert_called_once()
        primary.close.assert_called_once()
        fallback.close.assert_called_once()


class TestRouterIntegration:
    """Integration-style tests simulating real Nous routing scenarios."""

    @pytest.mark.asyncio
    async def test_sophia_config_routing(self):
        """Sophia's config: Ollama small/primary/large + Claude fallback."""
        config = LLMConfig.from_yaml({
            "provider": "ollama",
            "models": {"small": "qwen3:4b", "primary": "qwen3:14b", "large": "qwen3:32b"},
            "fallback_provider": "claude",
            "fallback_model": "claude-sonnet-4-6",
            "temperature": 0.7,
        })
        router = ModelRouter(config)
        router.register_tier(ModelTier.SMALL, _make_adapter("ollama", "perception result"))
        router.register_tier(ModelTier.PRIMARY, _make_adapter("ollama", "planning result"))
        router.register_tier(ModelTier.LARGE, _make_adapter("ollama", "reflection result"))
        router.set_fallback(_make_adapter("claude", "cloud result"))

        # Perception → small model
        r1 = await router.generate("Score importance", tier=ModelTier.SMALL)
        assert r1.text == "perception result"
        assert r1.tier == ModelTier.SMALL

        # Planning → primary model
        r2 = await router.generate("Plan next action", tier=ModelTier.PRIMARY)
        assert r2.text == "planning result"
        assert r2.tier == ModelTier.PRIMARY

        # Reflection → large model
        r3 = await router.generate("Reflect on today", tier=ModelTier.LARGE)
        assert r3.text == "reflection result"
        assert r3.tier == ModelTier.LARGE

        await router.close()

    @pytest.mark.asyncio
    async def test_hermes_no_cloud_fallback(self):
        """Hermes has no cloud fallback — fails if all local down."""
        config = LLMConfig.from_yaml({
            "provider": "ollama",
            "models": {"small": "qwen3:4b", "primary": "qwen3:14b", "large": "qwen3:32b"},
            "temperature": 0.8,
        })
        router = ModelRouter(config)
        router.register_tier(ModelTier.SMALL, _make_adapter("ollama", available=False))
        router.register_tier(ModelTier.PRIMARY, _make_adapter("ollama", available=False))
        router.register_tier(ModelTier.LARGE, _make_adapter("ollama", available=False))

        with pytest.raises(LLMError, match="All providers exhausted"):
            await router.generate("Test", tier=ModelTier.SMALL)

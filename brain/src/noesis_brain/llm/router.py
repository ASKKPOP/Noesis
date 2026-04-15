"""Multi-model router — routes requests to the right model tier
with automatic fallback to cloud providers."""

from __future__ import annotations

import logging

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions, LLMConfig, LLMResponse, ModelTier

log = logging.getLogger(__name__)


class ModelRouter:
    """Routes LLM requests to the appropriate model tier.

    Tier routing:
        SMALL   → fast/cheap model (perception, importance scoring)
        PRIMARY → balanced model (planning, conversation, action)
        LARGE   → deep model (reflection, complex reasoning)

    Fallback chain: requested tier → next larger tier → cloud fallback → error
    """

    def __init__(self, config: LLMConfig) -> None:
        self._config = config
        self._adapters: dict[ModelTier, LLMAdapter] = {}
        self._fallback: LLMAdapter | None = None

    def register_tier(self, tier: ModelTier, adapter: LLMAdapter) -> None:
        """Register an adapter for a specific model tier."""
        self._adapters[tier] = adapter

    def set_fallback(self, adapter: LLMAdapter) -> None:
        """Set the cloud fallback adapter."""
        self._fallback = adapter

    async def generate(
        self,
        prompt: str,
        tier: ModelTier = ModelTier.PRIMARY,
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        """Generate using the specified tier with automatic fallback.

        Fallback order:
            1. Requested tier
            2. Next larger tier (SMALL → PRIMARY → LARGE)
            3. Cloud fallback adapter
            4. Raise LLMError
        """
        opts = options or GenerateOptions(
            temperature=self._config.temperature,
            max_tokens=self._config.max_tokens,
        )

        # Build fallback chain
        chain = self._build_fallback_chain(tier)

        last_error: Exception | None = None
        for adapter in chain:
            try:
                if not await adapter.is_available():
                    log.warning(
                        "Provider %s not available, trying next",
                        adapter.provider_name,
                    )
                    continue
                response = await adapter.generate(prompt, opts)
                return LLMResponse(
                    text=response.text,
                    model=response.model,
                    provider=response.provider,
                    usage=response.usage,
                    latency_ms=response.latency_ms,
                    tier=tier,
                )
            except LLMError as e:
                log.warning("Provider %s failed: %s", adapter.provider_name, e)
                last_error = e
                continue

        raise LLMError(
            "router",
            f"All providers exhausted for tier={tier.value}. "
            f"Last error: {last_error}",
        )

    def _build_fallback_chain(self, tier: ModelTier) -> list[LLMAdapter]:
        """Build ordered list of adapters to try."""
        tier_order = [ModelTier.SMALL, ModelTier.PRIMARY, ModelTier.LARGE]
        start_idx = tier_order.index(tier)

        chain: list[LLMAdapter] = []
        # Add requested tier + larger tiers
        for t in tier_order[start_idx:]:
            if t in self._adapters:
                chain.append(self._adapters[t])

        # Add cloud fallback last
        if self._fallback:
            chain.append(self._fallback)

        return chain

    async def is_any_available(self) -> bool:
        """Check if at least one adapter is available."""
        for adapter in self._adapters.values():
            if await adapter.is_available():
                return True
        if self._fallback and await self._fallback.is_available():
            return True
        return False

    def get_tier_model(self, tier: ModelTier) -> str | None:
        """Get the model name configured for a tier."""
        return self._config.models.get(tier.value)

    async def close(self) -> None:
        """Close all adapters."""
        for adapter in self._adapters.values():
            if hasattr(adapter, "close"):
                await adapter.close()
        if self._fallback and hasattr(self._fallback, "close"):
            await self._fallback.close()

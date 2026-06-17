"""Multi-model router — routes requests to the right model tier
with automatic fallback to cloud providers."""

from __future__ import annotations

import logging

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions, LLMConfig, LLMResponse, ModelTier, ToolSpec

log = logging.getLogger(__name__)


class ModelRouter(LLMAdapter):
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
        # Phase 40 D-40-05: fallback state tracking for structured availability events.
        # True when Ollama PRIMARY is unavailable and cloud fallback is active.
        self._in_fallback_mode: bool = False

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
                # Phase 40 D-40-05: emit local_ai_unavailable on first cloud fallback activation.
                if adapter is self._fallback and not self._in_fallback_mode:
                    self._in_fallback_mode = True
                    primary_adapter = self._adapters.get(ModelTier.PRIMARY)
                    model_name = getattr(primary_adapter, "_model", "unknown") if primary_adapter else "unknown"
                    fallback_name = getattr(self._fallback, "provider_name", "unknown")
                    log.warning(
                        "{event: 'local_ai_unavailable', provider: 'ollama', model: '%s', fallback: '%s'}",
                        model_name,
                        fallback_name,
                    )
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

    @property
    def supports_tools(self) -> bool:
        """True if any registered tier or the fallback supports tool use (Phase 72b)."""
        candidates = list(self._adapters.values())
        if self._fallback is not None:
            candidates.append(self._fallback)
        return any(getattr(a, "supports_tools", False) for a in candidates)

    async def generate_with_tools(
        self,
        messages: list[dict],
        tools: list[ToolSpec],
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        """Route a tool-use request to the first tool-capable, available provider
        in the PRIMARY fallback chain (local Ollama first, then cloud)."""
        opts = options or GenerateOptions(
            temperature=self._config.temperature, max_tokens=self._config.max_tokens
        )
        last_error: Exception | None = None
        for adapter in self._build_fallback_chain(ModelTier.PRIMARY):
            if not getattr(adapter, "supports_tools", False):
                continue
            try:
                if not await adapter.is_available():
                    continue
                return await adapter.generate_with_tools(messages, tools, opts)
            except LLMError as e:
                log.warning("Tool provider %s failed: %s", adapter.provider_name, e)
                last_error = e
                continue
        raise LLMError("router", f"no tool-capable provider available. Last error: {last_error}")

    # ── LLMAdapter protocol implementation (for BrainHandler compatibility) ────────

    @property
    def provider_name(self) -> str:
        """Return provider name of the PRIMARY tier adapter, or 'model_router' if unregistered."""
        primary = self._adapters.get(ModelTier.PRIMARY)
        if primary is not None:
            return primary.provider_name
        return "model_router"

    async def list_models(self) -> list[str]:
        """List models from the PRIMARY tier adapter. Returns [] if PRIMARY not registered."""
        primary = self._adapters.get(ModelTier.PRIMARY)
        if primary is None:
            return []
        return await primary.list_models()

    async def is_available(self) -> bool:
        """Check availability of the PRIMARY tier adapter. Returns False if unregistered."""
        primary = self._adapters.get(ModelTier.PRIMARY)
        if primary is None:
            return False
        return await primary.is_available()

    async def check_recovery(self) -> bool:
        """Poll PRIMARY tier Ollama availability. Call once per tick while in fallback mode (D-40-07).

        Returns True if recovery was detected (switches back to local mode).
        Emits 'local_ai_recovered' log event on first True after False.
        No-op if not in fallback mode.
        """
        if not self._in_fallback_mode:
            return False

        primary = self._adapters.get(ModelTier.PRIMARY)
        if primary is None:
            return False

        available = await primary.is_available()
        if available:
            self._in_fallback_mode = False
            model_name = getattr(primary, "_model", "unknown")
            log.info(
                "{event: 'local_ai_recovered', provider: 'ollama', model: '%s'}",
                model_name,
            )
            return True
        return False

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

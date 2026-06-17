"""Base LLM adapter interface — all providers implement this."""

from __future__ import annotations

from abc import ABC, abstractmethod

from noesis_brain.llm.types import GenerateOptions, LLMResponse, ToolSpec


class LLMAdapter(ABC):
    """Abstract base class for LLM provider adapters."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider identifier (e.g., 'ollama', 'claude')."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        """Generate a completion from the model.

        Args:
            prompt: The user/input prompt text.
            options: Generation parameters (temperature, max_tokens, etc.).

        Returns:
            LLMResponse with generated text and metadata.

        Raises:
            LLMError: If the provider is unavailable or returns an error.
        """

    @property
    def supports_tools(self) -> bool:
        """True if this adapter implements ``generate_with_tools`` (Phase 72b gate)."""
        return False

    async def generate_with_tools(
        self,
        messages: list[dict],
        tools: list[ToolSpec],
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        """Multi-turn generation that may emit ``tool_use`` blocks (Phase 72).

        ``messages`` is an Anthropic-style message list. Additive: providers that
        do not support tool use inherit this default and raise. ``generate()`` is
        untouched.

        Args:
            messages: Conversation turns ([{"role", "content"}, ...]).
            tools: Tool definitions the model may call.
            options: Generation parameters.

        Returns:
            LLMResponse; ``tool_calls`` populated when ``stop_reason == "tool_use"``.

        Raises:
            LLMError: If the provider does not support tool use.
        """
        raise LLMError(self.provider_name, "tool use not supported by this adapter")

    @abstractmethod
    async def list_models(self) -> list[str]:
        """List available models from this provider.

        Returns:
            List of model identifier strings.
        """

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is reachable and ready.

        Returns:
            True if the provider can accept requests.
        """


class LLMError(Exception):
    """Raised when an LLM provider fails."""

    def __init__(self, provider: str, message: str) -> None:
        self.provider = provider
        super().__init__(f"[{provider}] {message}")

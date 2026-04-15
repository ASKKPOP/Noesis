"""Base LLM adapter interface — all providers implement this."""

from __future__ import annotations

from abc import ABC, abstractmethod

from noesis_brain.llm.types import GenerateOptions, LLMResponse


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

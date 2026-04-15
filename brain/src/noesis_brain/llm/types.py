"""LLM adapter types and data classes."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ModelTier(str, Enum):
    """Model size tier for routing decisions."""

    SMALL = "small"  # Fast, cheap — perception, importance scoring
    PRIMARY = "primary"  # Balanced — planning, conversation, action
    LARGE = "large"  # Deep — reflection, complex reasoning


@dataclass(frozen=True)
class GenerateOptions:
    """Options for a single generation call."""

    temperature: float = 0.7
    max_tokens: int = 2048
    system_prompt: str | None = None
    stop_sequences: list[str] = field(default_factory=list)
    purpose: str = ""  # For logging: "perception", "planning", "reflection", etc.


@dataclass(frozen=True)
class LLMResponse:
    """Response from an LLM generation call."""

    text: str
    model: str
    provider: str
    usage: dict[str, int] = field(default_factory=dict)  # prompt_tokens, completion_tokens
    latency_ms: float = 0.0
    tier: ModelTier | None = None


@dataclass
class LLMConfig:
    """Configuration for an LLM provider + model set."""

    provider: str  # "ollama", "claude", "openai", "lmstudio"
    models: dict[str, str] = field(default_factory=dict)  # tier → model name
    fallback_provider: str | None = None
    fallback_model: str | None = None
    temperature: float = 0.7
    max_tokens: int = 2048
    base_url: str | None = None  # Override for custom endpoints
    api_key: str | None = None  # For cloud providers
    extra: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_yaml(cls, data: dict[str, Any]) -> LLMConfig:
        """Create LLMConfig from a Nous YAML llm section."""
        return cls(
            provider=data.get("provider", "ollama"),
            models=data.get("models", {}),
            fallback_provider=data.get("fallback_provider"),
            fallback_model=data.get("fallback_model"),
            temperature=data.get("temperature", 0.7),
            max_tokens=data.get("max_tokens", 2048),
            base_url=data.get("base_url"),
            api_key=data.get("api_key"),
        )

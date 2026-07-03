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
    # When True, the decision is a small structured JSON object (a plan, an
    # action choice). Reasoning models (qwen3) otherwise burn the whole token
    # budget on hidden <think> and return empty content; providers that support
    # constrained decoding (Ollama format=json + think=false) emit clean JSON
    # directly. Prose calls (reflection, conversation) leave this False.
    json_mode: bool = False
    # Reasoning toggle for models that support it (qwen3). None → provider
    # default (Ollama adapter defaults to False so the answer lands in content
    # instead of being consumed as hidden reasoning). Set True only when visible
    # chain-of-thought in the output is genuinely wanted.
    think: bool | None = None


@dataclass(frozen=True)
class ToolSpec:
    """A tool the model may call. Maps 1:1 to an Anthropic tool definition."""

    name: str
    description: str
    input_schema: dict[str, Any]

    def to_anthropic(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


@dataclass(frozen=True)
class ToolCall:
    """A model-requested tool invocation (Anthropic ``tool_use`` block)."""

    id: str
    name: str
    input: dict[str, Any]


@dataclass(frozen=True)
class LLMResponse:
    """Response from an LLM generation call."""

    text: str
    model: str
    provider: str
    usage: dict[str, int] = field(default_factory=dict)  # prompt_tokens, completion_tokens
    latency_ms: float = 0.0
    tier: ModelTier | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)  # Phase 72 — tool-use blocks
    stop_reason: str | None = None  # Phase 72 — "tool_use" | "end_turn" | ...


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

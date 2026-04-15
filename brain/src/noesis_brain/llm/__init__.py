"""Noēsis LLM Adapter Layer — unified interface for multiple LLM providers."""

from noesis_brain.llm.types import (
    LLMConfig,
    LLMResponse,
    ModelTier,
    GenerateOptions,
)
from noesis_brain.llm.base import LLMAdapter
from noesis_brain.llm.ollama import OllamaAdapter
from noesis_brain.llm.claude import ClaudeAdapter
from noesis_brain.llm.openai_compat import OpenAICompatAdapter
from noesis_brain.llm.router import ModelRouter

__all__ = [
    "LLMAdapter",
    "LLMConfig",
    "LLMResponse",
    "ModelTier",
    "GenerateOptions",
    "OllamaAdapter",
    "ClaudeAdapter",
    "OpenAICompatAdapter",
    "ModelRouter",
]

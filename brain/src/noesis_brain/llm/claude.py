"""Claude adapter — Anthropic cloud API."""

from __future__ import annotations

import os
import time

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions, LLMResponse

_FIXTURE_MODE_VAR = "NOESIS_FIXTURE_MODE"


class ClaudeAdapter(LLMAdapter):
    """Adapter for Anthropic Claude API."""

    def __init__(
        self,
        model: str = "claude-sonnet-4-6",
        api_key: str | None = None,
    ) -> None:
        if os.environ.get(_FIXTURE_MODE_VAR) == "1":
            raise RuntimeError(
                f"ClaudeAdapter: network LLM calls forbidden — {_FIXTURE_MODE_VAR}=1 is set. "
                "Use FixtureBrainAdapter for rig runs (Phase 14 D-14-06)."
            )
        self._model = model
        self._api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        if not self._api_key:
            raise LLMError("claude", "No API key: set ANTHROPIC_API_KEY or pass api_key")
        self._client: "anthropic.AsyncAnthropic | None" = None

    def _get_client(self) -> "anthropic.AsyncAnthropic":
        if self._client is None:
            import anthropic

            self._client = anthropic.AsyncAnthropic(api_key=self._api_key)
        return self._client

    @property
    def provider_name(self) -> str:
        return "claude"

    async def generate(
        self,
        prompt: str,
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        opts = options or GenerateOptions()
        start = time.monotonic()
        client = self._get_client()

        kwargs: dict = {
            "model": self._model,
            "max_tokens": opts.max_tokens,
            "temperature": opts.temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
        if opts.system_prompt:
            kwargs["system"] = opts.system_prompt
        if opts.stop_sequences:
            kwargs["stop_sequences"] = opts.stop_sequences

        try:
            response = await client.messages.create(**kwargs)
        except Exception as e:
            raise LLMError("claude", f"API error: {e}") from e

        elapsed = (time.monotonic() - start) * 1000
        text = response.content[0].text if response.content else ""
        usage = {}
        if response.usage:
            usage["prompt_tokens"] = response.usage.input_tokens
            usage["completion_tokens"] = response.usage.output_tokens

        return LLMResponse(
            text=text,
            model=self._model,
            provider="claude",
            usage=usage,
            latency_ms=elapsed,
        )

    async def list_models(self) -> list[str]:
        return [
            "claude-opus-4-6",
            "claude-sonnet-4-6",
            "claude-haiku-4-5-20251001",
        ]

    async def is_available(self) -> bool:
        try:
            client = self._get_client()
            # Quick health check with minimal tokens
            await client.messages.create(
                model=self._model,
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return True
        except Exception:
            return False

    async def close(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None

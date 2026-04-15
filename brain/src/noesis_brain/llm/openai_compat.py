"""OpenAI-compatible adapter — works with LM Studio, OpenAI, and any
server implementing the OpenAI chat completions API."""

from __future__ import annotations

import os
import time

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions, LLMResponse


class OpenAICompatAdapter(LLMAdapter):
    """Adapter for any OpenAI-compatible API (LM Studio, OpenAI, vLLM, etc.)."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        base_url: str | None = None,
        api_key: str | None = None,
        provider_label: str = "openai",
    ) -> None:
        self._model = model
        self._base_url = base_url  # None → OpenAI default; "http://localhost:1234/v1" for LM Studio
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._provider_label = provider_label
        self._client: "openai.AsyncOpenAI | None" = None

    def _get_client(self) -> "openai.AsyncOpenAI":
        if self._client is None:
            import openai

            kwargs: dict = {"api_key": self._api_key or "not-needed"}
            if self._base_url:
                kwargs["base_url"] = self._base_url
            self._client = openai.AsyncOpenAI(**kwargs)
        return self._client

    @property
    def provider_name(self) -> str:
        return self._provider_label

    async def generate(
        self,
        prompt: str,
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        opts = options or GenerateOptions()
        start = time.monotonic()
        client = self._get_client()

        messages: list[dict] = []
        if opts.system_prompt:
            messages.append({"role": "system", "content": opts.system_prompt})
        messages.append({"role": "user", "content": prompt})

        kwargs: dict = {
            "model": self._model,
            "messages": messages,
            "temperature": opts.temperature,
            "max_tokens": opts.max_tokens,
        }
        if opts.stop_sequences:
            kwargs["stop"] = opts.stop_sequences

        try:
            response = await client.chat.completions.create(**kwargs)
        except Exception as e:
            raise LLMError(self._provider_label, f"API error: {e}") from e

        elapsed = (time.monotonic() - start) * 1000
        text = response.choices[0].message.content or "" if response.choices else ""
        usage = {}
        if response.usage:
            usage["prompt_tokens"] = response.usage.prompt_tokens or 0
            usage["completion_tokens"] = response.usage.completion_tokens or 0

        return LLMResponse(
            text=text,
            model=self._model,
            provider=self._provider_label,
            usage=usage,
            latency_ms=elapsed,
        )

    async def list_models(self) -> list[str]:
        try:
            client = self._get_client()
            models = await client.models.list()
            return [m.id for m in models.data]
        except Exception as e:
            raise LLMError(self._provider_label, f"Cannot list models: {e}") from e

    async def is_available(self) -> bool:
        try:
            client = self._get_client()
            await client.models.list()
            return True
        except Exception:
            return False

    async def close(self) -> None:
        if self._client:
            await self._client.close()
            self._client = None

"""Ollama adapter — local LLM via HTTP API (localhost:11434)."""

from __future__ import annotations

import os
import time

import httpx

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions, LLMResponse

_FIXTURE_MODE_VAR = "NOESIS_FIXTURE_MODE"


class OllamaAdapter(LLMAdapter):
    """Adapter for Ollama local LLM server."""

    def __init__(
        self,
        model: str = "qwen3:4b",
        base_url: str = "http://localhost:11434",
        timeout: float = 120.0,
    ) -> None:
        if os.environ.get(_FIXTURE_MODE_VAR) == "1":
            raise RuntimeError(
                f"OllamaAdapter: network LLM calls forbidden — {_FIXTURE_MODE_VAR}=1 is set. "
                "Use FixtureBrainAdapter for rig runs (Phase 14 D-14-06)."
            )
        self._model = model
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(self._timeout),
        )

    @property
    def provider_name(self) -> str:
        return "ollama"

    async def generate(
        self,
        prompt: str,
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        opts = options or GenerateOptions()
        start = time.monotonic()

        messages = []
        if opts.system_prompt:
            messages.append({"role": "system", "content": opts.system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: dict = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": opts.temperature,
                "num_predict": opts.max_tokens,
            },
        }
        if opts.stop_sequences:
            payload["options"]["stop"] = opts.stop_sequences

        try:
            resp = await self._client.post("/api/chat", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise LLMError("ollama", f"HTTP error: {e}") from e

        data = resp.json()
        elapsed = (time.monotonic() - start) * 1000

        text = data.get("message", {}).get("content", "")
        usage = {}
        if "prompt_eval_count" in data:
            usage["prompt_tokens"] = data["prompt_eval_count"]
        if "eval_count" in data:
            usage["completion_tokens"] = data["eval_count"]

        return LLMResponse(
            text=text,
            model=self._model,
            provider="ollama",
            usage=usage,
            latency_ms=elapsed,
        )

    async def list_models(self) -> list[str]:
        try:
            resp = await self._client.get("/api/tags")
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise LLMError("ollama", f"Cannot list models: {e}") from e

        data = resp.json()
        return [m["name"] for m in data.get("models", [])]

    async def is_available(self) -> bool:
        try:
            resp = await self._client.get("/api/tags")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    async def close(self) -> None:
        await self._client.aclose()

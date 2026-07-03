"""Ollama adapter — local LLM via HTTP API (localhost:11434)."""

from __future__ import annotations

import json
import os
import time

import httpx

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions, LLMResponse, ToolCall, ToolSpec

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

    @property
    def supports_tools(self) -> bool:
        return True

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
        # Structured-decision calls: constrain output to a JSON object and turn
        # OFF reasoning. qwen3 (the default model) otherwise spends the whole
        # num_predict budget inside a hidden <think> block, leaving message
        # content EMPTY — which silently no-ops the mind/society loop. Verified
        # against qwen3:4b: think=false + format=json yields clean parseable JSON
        # within 256 tokens. (Prose calls leave json_mode False → model default.)
        if opts.json_mode:
            payload["format"] = "json"
            payload["think"] = False

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

    @staticmethod
    def _to_ollama_messages(messages: list[dict], system_prompt: str | None) -> list[dict]:
        """Translate the loop's Anthropic-style messages to Ollama /api/chat format.

        tool_use blocks → assistant message with tool_calls; tool_result blocks →
        role='tool' messages (Ollama's tool-result convention).
        """
        out: list[dict] = []
        if system_prompt:
            out.append({"role": "system", "content": system_prompt})
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if isinstance(content, str):
                out.append({"role": role, "content": content})
                continue
            # block list (Anthropic content blocks)
            if role == "assistant":
                tcs = [
                    {"function": {"name": b["name"], "arguments": b.get("input", {})}}
                    for b in content
                    if b.get("type") == "tool_use"
                ]
                text = "".join(b.get("text", "") for b in content if b.get("type") == "text")
                out.append({"role": "assistant", "content": text, "tool_calls": tcs})
            else:
                for b in content:
                    if b.get("type") == "tool_result":
                        out.append({"role": "tool", "content": str(b.get("content", ""))})
                    elif b.get("type") == "text":
                        out.append({"role": "user", "content": b.get("text", "")})
        return out

    async def generate_with_tools(
        self,
        messages: list[dict],
        tools: list[ToolSpec],
        options: GenerateOptions | None = None,
    ) -> LLMResponse:
        opts = options or GenerateOptions()
        start = time.monotonic()
        payload: dict = {
            "model": self._model,
            "messages": self._to_ollama_messages(messages, opts.system_prompt),
            "tools": [
                {"type": "function", "function": {
                    "name": t.name, "description": t.description, "parameters": t.input_schema,
                }}
                for t in tools
            ],
            "stream": False,
            "options": {"temperature": opts.temperature, "num_predict": opts.max_tokens},
        }
        try:
            resp = await self._client.post("/api/chat", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise LLMError("ollama", f"HTTP error: {e}") from e

        data = resp.json()
        elapsed = (time.monotonic() - start) * 1000
        msg = data.get("message", {})

        tool_calls: list[ToolCall] = []
        for i, c in enumerate(msg.get("tool_calls") or [], start=1):
            fn = c.get("function", {})
            args = fn.get("arguments", {})
            if isinstance(args, str):
                try:
                    args = json.loads(args or "{}")
                except json.JSONDecodeError:
                    args = {}
            tool_calls.append(ToolCall(id=f"call_{i}", name=fn.get("name", ""), input=args))

        usage = {}
        if "prompt_eval_count" in data:
            usage["prompt_tokens"] = data["prompt_eval_count"]
        if "eval_count" in data:
            usage["completion_tokens"] = data["eval_count"]

        return LLMResponse(
            text=msg.get("content", ""),
            model=self._model,
            provider="ollama",
            usage=usage,
            latency_ms=elapsed,
            tool_calls=tool_calls,
            stop_reason="tool_use" if tool_calls else "end_turn",
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

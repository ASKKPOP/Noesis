"""Tests for OllamaAdapter — uses httpx mock transport."""

import json
from unittest.mock import AsyncMock

import httpx
import pytest

from noesis_brain.llm.base import LLMError
from noesis_brain.llm.ollama import OllamaAdapter
from noesis_brain.llm.types import GenerateOptions


def _mock_transport(handler):
    """Create an httpx mock transport from an async handler."""
    return httpx.MockTransport(handler)


def _ollama_chat_response(content: str, model: str = "qwen3:4b") -> dict:
    return {
        "model": model,
        "message": {"role": "assistant", "content": content},
        "done": True,
        "prompt_eval_count": 15,
        "eval_count": 25,
    }


def _ollama_tags_response(models: list[str]) -> dict:
    return {"models": [{"name": m} for m in models]}


class TestOllamaAdapter:
    @pytest.mark.asyncio
    async def test_generate_basic(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/chat"
            body = json.loads(request.content)
            assert body["model"] == "qwen3:4b"
            assert body["messages"][-1]["content"] == "Who are you?"
            assert body["stream"] is False
            return httpx.Response(200, json=_ollama_chat_response("I am Sophia."))

        adapter = OllamaAdapter(model="qwen3:4b")
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        resp = await adapter.generate("Who are you?")
        assert resp.text == "I am Sophia."
        assert resp.model == "qwen3:4b"
        assert resp.provider == "ollama"
        assert resp.usage["prompt_tokens"] == 15
        assert resp.usage["completion_tokens"] == 25
        assert resp.latency_ms > 0
        await adapter.close()

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            assert body["messages"][0]["role"] == "system"
            assert body["messages"][0]["content"] == "You are Sophia."
            assert body["messages"][1]["role"] == "user"
            return httpx.Response(200, json=_ollama_chat_response("Hello!"))

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        opts = GenerateOptions(system_prompt="You are Sophia.")
        resp = await adapter.generate("Hi", opts)
        assert resp.text == "Hello!"
        await adapter.close()

    @pytest.mark.asyncio
    async def test_generate_with_options(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            assert body["options"]["temperature"] == 0.3
            assert body["options"]["num_predict"] == 512
            assert body["options"]["stop"] == ["<END>"]
            return httpx.Response(200, json=_ollama_chat_response("Done."))

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        opts = GenerateOptions(temperature=0.3, max_tokens=512, stop_sequences=["<END>"])
        resp = await adapter.generate("Test", opts)
        assert resp.text == "Done."
        await adapter.close()

    @pytest.mark.asyncio
    async def test_json_mode_constrains_output_and_disables_thinking(self):
        """The liveness fix: structured-decision calls must set Ollama
        format=json + think=false, or qwen3 (default model) burns the token
        budget on hidden <think> and returns empty content — silently no-oping
        the whole mind/society loop."""
        seen = {}

        async def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            seen["format"] = body.get("format")
            seen["think"] = body.get("think")
            return httpx.Response(200, json=_ollama_chat_response('{"action":"rest"}'))

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        # json_mode ON → constrained + no reasoning
        await adapter.generate("Decide", GenerateOptions(json_mode=True, purpose="decision"))
        assert seen["format"] == "json"
        assert seen["think"] is False

        # json_mode OFF (default) → neither key sent (prose calls keep model default)
        seen.clear()
        await adapter.generate("Reflect", GenerateOptions(purpose="reflection"))
        assert seen["format"] is None
        assert seen["think"] is None
        await adapter.close()

    @pytest.mark.asyncio
    async def test_generate_http_error(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(500, text="Internal Server Error")

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        with pytest.raises(LLMError, match="ollama.*HTTP error"):
            await adapter.generate("fail")
        await adapter.close()

    @pytest.mark.asyncio
    async def test_list_models(self):
        models = ["qwen3:4b", "qwen3:14b", "llama3:8b"]

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/api/tags"
            return httpx.Response(200, json=_ollama_tags_response(models))

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        result = await adapter.list_models()
        assert result == models
        await adapter.close()

    @pytest.mark.asyncio
    async def test_is_available_true(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=_ollama_tags_response([]))

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        assert await adapter.is_available() is True
        await adapter.close()

    @pytest.mark.asyncio
    async def test_is_available_false(self):
        async def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("Connection refused")

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))

        assert await adapter.is_available() is False
        await adapter.close()

    def test_provider_name(self):
        adapter = OllamaAdapter()
        assert adapter.provider_name == "ollama"


class TestOllamaToolUse:
    @pytest.mark.asyncio
    async def test_parses_tool_calls(self):
        from noesis_brain.llm.types import ToolSpec

        async def handler(request):
            body = json.loads(request.content)
            assert body["tools"][0]["function"]["name"] == "web_search"
            assert body["messages"][-1]["content"] == "search x"
            return httpx.Response(200, json={
                "model": "qwen3:4b",
                "message": {"role": "assistant", "content": "", "tool_calls": [
                    {"function": {"name": "web_search", "arguments": {"query": "x"}}}
                ]},
                "done": True,
            })

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))
        tools = [ToolSpec("web_search", "search", {"type": "object", "properties": {}})]
        resp = await adapter.generate_with_tools([{"role": "user", "content": "search x"}], tools)
        assert resp.stop_reason == "tool_use"
        assert resp.tool_calls[0].name == "web_search"
        assert resp.tool_calls[0].input == {"query": "x"}

    @pytest.mark.asyncio
    async def test_final_text_when_no_tool_calls(self):
        async def handler(request):
            return httpx.Response(200, json={
                "model": "qwen3:4b", "message": {"role": "assistant", "content": "done"}, "done": True,
            })

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))
        resp = await adapter.generate_with_tools([{"role": "user", "content": "hi"}], [])
        assert resp.stop_reason == "end_turn"
        assert resp.text == "done"

    @pytest.mark.asyncio
    async def test_translates_tool_result_to_role_tool(self):
        captured: dict = {}

        async def handler(request):
            captured["body"] = json.loads(request.content)
            return httpx.Response(200, json={
                "model": "qwen3:4b", "message": {"role": "assistant", "content": "ok"}, "done": True,
            })

        adapter = OllamaAdapter()
        adapter._client = httpx.AsyncClient(base_url="http://localhost:11434", transport=_mock_transport(handler))
        messages = [
            {"role": "user", "content": "q"},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "call_1", "name": "web_search", "input": {"query": "x"}}]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "call_1", "content": "result text"}]},
        ]
        await adapter.generate_with_tools(messages, [])
        sent = captured["body"]["messages"]
        assert any(m["role"] == "tool" and m["content"] == "result text" for m in sent)
        asst = [m for m in sent if m["role"] == "assistant"][0]
        assert asst["tool_calls"][0]["function"]["name"] == "web_search"

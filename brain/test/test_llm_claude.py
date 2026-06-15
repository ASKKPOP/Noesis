"""Tests for ClaudeAdapter — uses mocked Anthropic client."""

from dataclasses import dataclass
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from noesis_brain.llm.base import LLMError
from noesis_brain.llm.claude import ClaudeAdapter
from noesis_brain.llm.types import GenerateOptions


@dataclass
class MockUsage:
    input_tokens: int = 10
    output_tokens: int = 20


@dataclass
class MockContent:
    text: str = "I am Claude."
    type: str = "text"


@dataclass
class MockToolUse:
    id: str = "toolu_1"
    name: str = "web_search"
    input: dict = None  # type: ignore
    type: str = "tool_use"

    def __post_init__(self):
        if self.input is None:
            self.input = {"query": "noesis"}


@dataclass
class MockResponse:
    content: list = None  # type: ignore
    usage: MockUsage = None  # type: ignore
    model: str = "claude-sonnet-4-6"
    stop_reason: str = "end_turn"

    def __post_init__(self):
        if self.content is None:
            self.content = [MockContent()]
        if self.usage is None:
            self.usage = MockUsage()


class TestClaudeAdapter:
    def test_no_api_key_raises(self):
        with patch.dict("os.environ", {}, clear=True):
            # Remove any existing ANTHROPIC_API_KEY
            import os
            old = os.environ.pop("ANTHROPIC_API_KEY", None)
            try:
                with pytest.raises(LLMError, match="No API key"):
                    ClaudeAdapter(api_key="")
            finally:
                if old:
                    os.environ["ANTHROPIC_API_KEY"] = old

    def test_provider_name(self):
        adapter = ClaudeAdapter(api_key="test-key")
        assert adapter.provider_name == "claude"

    @pytest.mark.asyncio
    async def test_generate_basic(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=MockResponse())
        adapter._client = mock_client

        resp = await adapter.generate("Who are you?")
        assert resp.text == "I am Claude."
        assert resp.model == "claude-sonnet-4-6"
        assert resp.provider == "claude"
        assert resp.usage["prompt_tokens"] == 10
        assert resp.usage["completion_tokens"] == 20
        assert resp.latency_ms > 0

        # Verify the call was made correctly
        mock_client.messages.create.assert_called_once()
        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["model"] == "claude-sonnet-4-6"
        assert call_kwargs["messages"] == [{"role": "user", "content": "Who are you?"}]

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=MockResponse())
        adapter._client = mock_client

        opts = GenerateOptions(system_prompt="You are Sophia the Philosopher.")
        await adapter.generate("Hello", opts)

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["system"] == "You are Sophia the Philosopher."

    @pytest.mark.asyncio
    async def test_generate_with_stop_sequences(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=MockResponse())
        adapter._client = mock_client

        opts = GenerateOptions(stop_sequences=["<END>", "\n\n"])
        await adapter.generate("Test", opts)

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["stop_sequences"] == ["<END>", "\n\n"]

    @pytest.mark.asyncio
    async def test_generate_api_error(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(side_effect=Exception("Rate limited"))
        adapter._client = mock_client

        with pytest.raises(LLMError, match="claude.*API error"):
            await adapter.generate("fail")

    @pytest.mark.asyncio
    async def test_list_models(self):
        adapter = ClaudeAdapter(api_key="test-key")
        models = await adapter.list_models()
        assert "claude-opus-4-6" in models
        assert "claude-sonnet-4-6" in models
        assert "claude-haiku-4-5-20251001" in models

    @pytest.mark.asyncio
    async def test_is_available_true(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=MockResponse())
        adapter._client = mock_client

        assert await adapter.is_available() is True

    @pytest.mark.asyncio
    async def test_is_available_false(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(side_effect=Exception("Down"))
        adapter._client = mock_client

        assert await adapter.is_available() is False

    @pytest.mark.asyncio
    async def test_generate_with_tools_maps_tool_use_block(self):
        from noesis_brain.llm.types import ToolSpec

        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=MockResponse(content=[MockToolUse()], stop_reason="tool_use")
        )
        adapter._client = mock_client

        tools = [
            ToolSpec("web_search", "search", {"type": "object", "properties": {}}),
        ]
        resp = await adapter.generate_with_tools(
            [{"role": "user", "content": "search noesis"}], tools
        )

        assert resp.stop_reason == "tool_use"
        assert len(resp.tool_calls) == 1
        assert resp.tool_calls[0].id == "toolu_1"
        assert resp.tool_calls[0].name == "web_search"
        assert resp.tool_calls[0].input == {"query": "noesis"}

        call_kwargs = mock_client.messages.create.call_args[1]
        assert call_kwargs["tools"] == [
            {"name": "web_search", "description": "search",
             "input_schema": {"type": "object", "properties": {}}}
        ]
        assert call_kwargs["messages"] == [{"role": "user", "content": "search noesis"}]

    @pytest.mark.asyncio
    async def test_generate_with_tools_maps_text_block(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(
            return_value=MockResponse(content=[MockContent(text="all done")], stop_reason="end_turn")
        )
        adapter._client = mock_client

        resp = await adapter.generate_with_tools([{"role": "user", "content": "hi"}], [])
        assert resp.stop_reason == "end_turn"
        assert resp.text == "all done"
        assert resp.tool_calls == []

    @pytest.mark.asyncio
    async def test_close(self):
        adapter = ClaudeAdapter(api_key="test-key")
        mock_client = AsyncMock()
        adapter._client = mock_client

        await adapter.close()
        mock_client.close.assert_called_once()
        assert adapter._client is None

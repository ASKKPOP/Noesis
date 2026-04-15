"""Tests for OpenAICompatAdapter — works with LM Studio, OpenAI, vLLM."""

from dataclasses import dataclass
from unittest.mock import AsyncMock

import pytest

from noesis_brain.llm.base import LLMError
from noesis_brain.llm.openai_compat import OpenAICompatAdapter
from noesis_brain.llm.types import GenerateOptions


@dataclass
class MockUsage:
    prompt_tokens: int = 10
    completion_tokens: int = 20


@dataclass
class MockMessage:
    content: str = "Hello from LM Studio"
    role: str = "assistant"


@dataclass
class MockChoice:
    message: MockMessage = None  # type: ignore
    index: int = 0

    def __post_init__(self):
        if self.message is None:
            self.message = MockMessage()


@dataclass
class MockCompletion:
    choices: list = None  # type: ignore
    usage: MockUsage = None  # type: ignore
    model: str = "local-model"

    def __post_init__(self):
        if self.choices is None:
            self.choices = [MockChoice()]
        if self.usage is None:
            self.usage = MockUsage()


@dataclass
class MockModel:
    id: str = "local-model"


@dataclass
class MockModelList:
    data: list = None  # type: ignore

    def __post_init__(self):
        if self.data is None:
            self.data = [MockModel("model-a"), MockModel("model-b")]


class TestOpenAICompatAdapter:
    def test_provider_name_default(self):
        adapter = OpenAICompatAdapter()
        assert adapter.provider_name == "openai"

    def test_provider_name_custom(self):
        adapter = OpenAICompatAdapter(provider_label="lmstudio")
        assert adapter.provider_name == "lmstudio"

    @pytest.mark.asyncio
    async def test_generate_basic(self):
        adapter = OpenAICompatAdapter(model="local-model", provider_label="lmstudio")
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=MockCompletion())
        adapter._client = mock_client

        resp = await adapter.generate("Who are you?")
        assert resp.text == "Hello from LM Studio"
        assert resp.model == "local-model"
        assert resp.provider == "lmstudio"
        assert resp.usage["prompt_tokens"] == 10
        assert resp.usage["completion_tokens"] == 20
        assert resp.latency_ms > 0

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["model"] == "local-model"
        assert call_kwargs["messages"][-1]["content"] == "Who are you?"

    @pytest.mark.asyncio
    async def test_generate_with_system_prompt(self):
        adapter = OpenAICompatAdapter(model="gpt-4o-mini")
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=MockCompletion())
        adapter._client = mock_client

        opts = GenerateOptions(system_prompt="You are Hermes the Trader.")
        await adapter.generate("Hello", opts)

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["messages"][0] == {"role": "system", "content": "You are Hermes the Trader."}
        assert call_kwargs["messages"][1] == {"role": "user", "content": "Hello"}

    @pytest.mark.asyncio
    async def test_generate_with_stop_and_options(self):
        adapter = OpenAICompatAdapter()
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=MockCompletion())
        adapter._client = mock_client

        opts = GenerateOptions(temperature=0.2, max_tokens=100, stop_sequences=["STOP"])
        await adapter.generate("Test", opts)

        call_kwargs = mock_client.chat.completions.create.call_args[1]
        assert call_kwargs["temperature"] == 0.2
        assert call_kwargs["max_tokens"] == 100
        assert call_kwargs["stop"] == ["STOP"]

    @pytest.mark.asyncio
    async def test_generate_api_error(self):
        adapter = OpenAICompatAdapter(provider_label="lmstudio")
        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("Connection refused"))
        adapter._client = mock_client

        with pytest.raises(LLMError, match="lmstudio.*API error"):
            await adapter.generate("fail")

    @pytest.mark.asyncio
    async def test_list_models(self):
        adapter = OpenAICompatAdapter()
        mock_client = AsyncMock()
        mock_client.models.list = AsyncMock(return_value=MockModelList())
        adapter._client = mock_client

        models = await adapter.list_models()
        assert "model-a" in models
        assert "model-b" in models

    @pytest.mark.asyncio
    async def test_is_available_true(self):
        adapter = OpenAICompatAdapter()
        mock_client = AsyncMock()
        mock_client.models.list = AsyncMock(return_value=MockModelList())
        adapter._client = mock_client

        assert await adapter.is_available() is True

    @pytest.mark.asyncio
    async def test_is_available_false(self):
        adapter = OpenAICompatAdapter()
        mock_client = AsyncMock()
        mock_client.models.list = AsyncMock(side_effect=Exception("Down"))
        adapter._client = mock_client

        assert await adapter.is_available() is False

    @pytest.mark.asyncio
    async def test_lmstudio_config(self):
        """LM Studio uses OpenAI-compatible API at localhost:1234."""
        adapter = OpenAICompatAdapter(
            model="qwen3-14b",
            base_url="http://localhost:1234/v1",
            provider_label="lmstudio",
        )
        assert adapter.provider_name == "lmstudio"
        assert adapter._base_url == "http://localhost:1234/v1"
        assert adapter._model == "qwen3-14b"

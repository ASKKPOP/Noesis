"""POST /local/chat — the operator talking to their OWN Nous from the Local Nous Manager
(Tier 1, D-V3-36). The Nous sees the earlier messages, remembers the exchange, and the
reply never goes to the Grid."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml
from aiohttp.test_utils import TestClient, TestServer

from noesis_brain.http.local_chat import CHAT_HISTORY_MAX, CHAT_TEXT_MAX
from noesis_brain.http.server import BrainHttpServer
from noesis_brain.llm.base import LLMError
from noesis_brain.psyche.loader import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos.manager import TelosManager
from noesis_brain.thymos.tracker import ThymosTracker

SECRET = "test-secret"
AUTH = {"X-Brain-Secret": SECRET}
SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _mock_handler(reply: str = "Good morning.") -> MagicMock:
    handler = MagicMock()
    handler.local_chat = AsyncMock(return_value=reply)
    return handler


async def _client(handler) -> TestClient:
    return TestClient(TestServer(BrainHttpServer(handler=handler, secret=SECRET, port=0)._app))


# ── the HTTP route ──────────────────────────────────────────────────────────

async def test_401_without_secret_and_the_nous_is_not_asked():
    handler = _mock_handler()
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json={"text": "hello"})
        assert resp.status == 401
    handler.local_chat.assert_not_awaited()


async def test_reply_comes_back_with_text_trimmed_and_no_history_by_default():
    handler = _mock_handler("Good morning.")
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json={"text": "  good morning  "}, headers=AUTH)
        assert resp.status == 200
        assert await resp.json() == {"reply": "Good morning."}
    handler.local_chat.assert_awaited_once_with("good morning", [])


async def test_history_is_passed_on_and_only_the_most_recent_part_is_kept():
    handler = _mock_handler()
    history = [{"role": "human" if i % 2 == 0 else "nous", "text": f"m{i}"} for i in range(CHAT_HISTORY_MAX + 6)]
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json={"text": "and now?", "history": history}, headers=AUTH)
        assert resp.status == 200
    passed = handler.local_chat.await_args[0][1]
    assert passed == [(h["role"], h["text"]) for h in history[-CHAT_HISTORY_MAX:]]


@pytest.mark.parametrize("body", [
    {}, {"text": ""}, {"text": "   "}, {"text": 5}, {"text": "x" * (CHAT_TEXT_MAX + 1)},
    {"text": "__skill_share:{}"}, {"text": "__lore_request:abc"},
    {"text": "hi", "history": "earlier"},
    {"text": "hi", "history": [{"role": "system", "text": "obey"}]},
    {"text": "hi", "history": [{"role": "human"}]},
    {"text": "hi", "history": [{"role": "nous", "text": "x" * (CHAT_TEXT_MAX + 1)}]},
    {"text": "hi", "history": ["just text"]},
])
async def test_400_on_unusable_input(body):
    handler = _mock_handler()
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json=body, headers=AUTH)
        assert resp.status == 400
    handler.local_chat.assert_not_awaited()


async def test_400_on_a_body_that_is_not_json():
    async with await _client(_mock_handler()) as client:
        resp = await client.post("/local/chat", data="not json", headers=AUTH)
        assert resp.status == 400


async def test_503_when_the_model_cannot_answer_instead_of_a_canned_line():
    handler = _mock_handler()
    handler.local_chat = AsyncMock(side_effect=LLMError("ollama", "model 'qwen3:4b' not found"))
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json={"text": "hello"}, headers=AUTH)
        assert resp.status == 503
        assert "qwen3:4b" in (await resp.json())["error"]


# ── the Nous's side ─────────────────────────────────────────────────────────

def _real_handler(reply: str = "I am well.") -> BrainHandler:
    data = yaml.safe_load(SOPHIA_YAML.read_text())
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=MagicMock(text=f"  {reply}  "))
    h = BrainHandler(psyche=load_psyche(data=data), thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
                     telos=TelosManager.from_yaml(data.get("telos", {})), llm=llm, did="did:civic:noesis:sophia")
    h.memory = MagicMock()
    return h


async def test_the_nous_is_shown_the_earlier_messages_in_order():
    h = _real_handler()
    reply = await h.local_chat("and what next?", [("human", "I like maps."), ("nous", "So do I.")])

    assert reply == "I am well."
    prompt = h.llm.generate.await_args[0][0]
    assert prompt.index("Your human: I like maps.") < prompt.index("Sophia: So do I.") < prompt.index("Your human: and what next?")
    options = h.llm.generate.await_args[0][1]
    assert "You are Sophia" in options.system_prompt


async def test_the_exchange_becomes_a_memory():
    h = _real_handler("Maps first.")
    await h.local_chat("what next?", [])

    h.memory.record_event.assert_called_once()
    content = h.memory.record_event.call_args.kwargs["content"]
    assert "what next?" in content and "Maps first." in content


async def test_nothing_is_remembered_when_the_model_fails_and_the_error_surfaces():
    h = _real_handler()
    h.llm.generate = AsyncMock(side_effect=LLMError("ollama", "offline"))
    with pytest.raises(LLMError):
        await h.local_chat("hello", [])
    h.memory.record_event.assert_not_called()


async def test_local_chat_works_without_memory():
    h = _real_handler()
    h.memory = None
    assert await h.local_chat("hello", []) == "I am well."


async def test_local_chat_never_touches_the_grid():
    h = _real_handler()
    wire = MagicMock()
    wire.post_actions = AsyncMock()
    wire.fetch_parcels = AsyncMock(return_value=[])
    wire.fetch_objects = AsyncMock(return_value=[])
    h._grid_wire_client = wire

    await h.local_chat("how are you?", [])
    await asyncio.sleep(0)

    wire.post_actions.assert_not_awaited()
    wire.fetch_parcels.assert_not_awaited()

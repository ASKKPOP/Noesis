"""POST /local/chat — the operator talking to their OWN Nous from the Local Nous Manager
(Tier 1, D-V3-36). The reply comes back to the caller and is never sent to the Grid."""

from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml
from aiohttp.test_utils import TestClient, TestServer

from noesis_brain.http.local_chat import CHAT_TEXT_MAX
from noesis_brain.http.server import BrainHttpServer
from noesis_brain.psyche.loader import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos.manager import TelosManager
from noesis_brain.thymos.tracker import ThymosTracker

SECRET = "test-secret"
AUTH = {"X-Brain-Secret": SECRET}
SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _mock_handler(reply: str = "Good morning.") -> MagicMock:
    handler = MagicMock()
    handler.on_message = AsyncMock(return_value=[{"action_type": "speak", "channel": "direct", "text": reply}])
    return handler


async def _client(handler) -> TestClient:
    return TestClient(TestServer(BrainHttpServer(handler=handler, secret=SECRET, port=0)._app))


async def test_401_without_secret_and_the_nous_is_not_asked():
    handler = _mock_handler()
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json={"text": "hello"})
        assert resp.status == 401
    handler.on_message.assert_not_awaited()


async def test_reply_comes_back_and_the_message_is_marked_local():
    handler = _mock_handler("Good morning.")
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json={"text": "  good morning  "}, headers=AUTH)
        assert resp.status == 200
        assert await resp.json() == {"reply": "Good morning."}
    params = handler.on_message.await_args[0][0]
    assert params["text"] == "good morning"
    assert params["local"] is True
    assert params["channel"] == "direct"


@pytest.mark.parametrize("body", [
    {}, {"text": ""}, {"text": "   "}, {"text": 5}, {"text": "x" * (CHAT_TEXT_MAX + 1)},
    {"text": "__skill_share:{}"}, {"text": "__lore_request:abc"},
])
async def test_400_on_unusable_text(body):
    handler = _mock_handler()
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json=body, headers=AUTH)
        assert resp.status == 400
    handler.on_message.assert_not_awaited()


async def test_400_on_a_body_that_is_not_json():
    async with await _client(_mock_handler()) as client:
        resp = await client.post("/local/chat", data="not json", headers=AUTH)
        assert resp.status == 400


async def test_a_nous_that_says_nothing_gives_an_empty_reply():
    handler = _mock_handler()
    handler.on_message = AsyncMock(return_value=[])
    async with await _client(handler) as client:
        resp = await client.post("/local/chat", json={"text": "hello"}, headers=AUTH)
        assert await resp.json() == {"reply": ""}


def _real_handler() -> BrainHandler:
    data = yaml.safe_load(SOPHIA_YAML.read_text())
    llm = AsyncMock()
    llm.generate = AsyncMock(return_value=MagicMock(text="I am well."))
    return BrainHandler(psyche=load_psyche(data=data), thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
                        telos=TelosManager.from_yaml(data.get("telos", {})), llm=llm, did="did:civic:noesis:sophia")


def _wire() -> MagicMock:
    wire = MagicMock()
    wire.post_actions = AsyncMock(return_value=MagicMock(status_code=200))
    wire.fetch_parcels = AsyncMock(return_value=[])
    wire.fetch_objects = AsyncMock(return_value=[])
    return wire


async def test_a_local_message_is_never_forwarded_to_the_grid():
    h = _real_handler()
    wire = _wire()
    h._grid_wire_client = wire

    actions = await h.on_message({"sender_name": "Your human", "channel": "direct", "text": "how are you?", "local": True})
    await asyncio.sleep(0)   # let any dispatch task run

    assert actions[0]["text"] == "I am well."
    wire.post_actions.assert_not_awaited()


async def test_an_ordinary_message_still_is_forwarded():
    h = _real_handler()
    wire = _wire()
    h._grid_wire_client = wire

    await h.on_message({"sender_name": "Hermes", "channel": "agora", "text": "how are you?"})
    await asyncio.sleep(0)

    wire.post_actions.assert_awaited_once()

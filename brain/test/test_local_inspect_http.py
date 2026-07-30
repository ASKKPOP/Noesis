"""v3.3 Mind Phase 75 — /local/* Tier-1 inspect endpoints (Local Nous Manager).

Verifies the operator-local inspect surface: secret gate, state passthrough,
memory + wiki browsing, and limit clamping. Mirrors the aiohttp test-client
pattern used by the other http/ tests.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from aiohttp.test_utils import TestClient, TestServer

from noesis_brain.http.server import BrainHttpServer
from noesis_brain.memory.types import Memory, MemoryType, WikiCategory, WikiPage

SECRET = "test-secret"


def _make_handler() -> MagicMock:
    handler = MagicMock()
    handler._ananke_runtimes = {}
    handler._last_sleep_tick = 0
    handler.get_state.return_value = {
        "name": "Sophia",
        "aisthesis": {"percept_count": 0, "percepts": [], "world_size": 0},
        "praxis": {"total_deeds": 1, "verb_counts": {"speak": 1}, "recent": [], "repertoire_size": 30},
        "synopsis": {"count": 0, "latest": None},
    }
    mem = MagicMock()
    mem.recent.return_value = [
        Memory(memory_type=MemoryType.OBSERVATION, content="saw a foundry appear",
               importance=6.0, source_did="did:noesis:sophia", tick=42,
               created_at=datetime(2026, 7, 12, tzinfo=timezone.utc)),
    ]
    store = MagicMock()
    store.all_wiki_pages.return_value = [
        WikiPage(title="Ring Energy", category=WikiCategory.CONCEPT, content="notes", confidence=0.7),
    ]
    store.wiki_pages_by_category.return_value = store.all_wiki_pages.return_value
    mem._store = store
    handler.memory = mem
    return handler


async def _client(handler) -> TestClient:
    server = BrainHttpServer(handler=handler, secret=SECRET, port=0)
    return TestClient(TestServer(server._app))


class TestAuthGate:
    @pytest.mark.parametrize("path", ["/local/state", "/local/memory/recent", "/local/wiki/pages"])
    async def test_401_without_secret(self, path):
        client = await _client(_make_handler())
        async with client:
            resp = await client.get(path)
            assert resp.status == 401


class TestState:
    async def test_state_passthrough_includes_faculties(self):
        client = await _client(_make_handler())
        async with client:
            resp = await client.get("/local/state", headers={"X-Brain-Secret": SECRET})
            assert resp.status == 200
            body = await resp.json()
            assert body["name"] == "Sophia"
            assert "aisthesis" in body and "praxis" in body and "synopsis" in body


class TestMemory:
    async def test_recent_memories(self):
        client = await _client(_make_handler())
        async with client:
            resp = await client.get("/local/memory/recent?limit=5", headers={"X-Brain-Secret": SECRET})
            assert resp.status == 200
            body = await resp.json()
            assert body["count"] == 1
            m = body["memories"][0]
            assert m["content"] == "saw a foundry appear"
            assert m["memory_type"] == "observation"
            assert m["tick"] == 42

    async def test_limit_is_clamped(self):
        handler = _make_handler()
        client = await _client(handler)
        async with client:
            await client.get("/local/memory/recent?limit=99999", headers={"X-Brain-Secret": SECRET})
            (_, kwargs) = handler.memory.recent.call_args
            assert kwargs["limit"] <= 200

    async def test_no_memory_is_empty(self):
        handler = _make_handler()
        handler.memory = None
        client = await _client(handler)
        async with client:
            resp = await client.get("/local/memory/recent", headers={"X-Brain-Secret": SECRET})
            assert resp.status == 200
            assert (await resp.json()) == {"count": 0, "memories": []}


class TestWiki:
    async def test_all_pages(self):
        client = await _client(_make_handler())
        async with client:
            resp = await client.get("/local/wiki/pages", headers={"X-Brain-Secret": SECRET})
            assert resp.status == 200
            body = await resp.json()
            assert body["count"] == 1
            assert body["pages"][0]["title"] == "Ring Energy"
            assert body["pages"][0]["category"] == "concept"

    async def test_bad_category_is_400(self):
        client = await _client(_make_handler())
        async with client:
            resp = await client.get("/local/wiki/pages?category=nonsense", headers={"X-Brain-Secret": SECRET})
            assert resp.status == 400

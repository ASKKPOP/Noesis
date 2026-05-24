"""Tests for skills-by-hash Brain HTTP endpoint (Phase 27, Plan 02, Task 1).

Covers:
- SkillStore.get_by_hash(hash): returns Skill for known hash, None for unknown
- GET /skills/:hash with valid secret and known hash: returns {name, description} (exactly 2 keys)
- GET /skills/:hash with valid secret and unknown hash: 404 JSON
- GET /skills/:hash without X-Brain-Secret: 401
- Response has exactly 2 keys in alphabetical order: description, name
"""

from __future__ import annotations

import hashlib
import sqlite3
from typing import Any
from unittest.mock import MagicMock

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from noesis_brain.http.server import BrainHttpServer
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.skills.store import SkillStore
from noesis_brain.skills.types import Skill

SECRET = "test-secret-xyz987"


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_memory_store() -> tuple[MemoryStream, MemoryStore]:
    store = MemoryStore(":memory:")
    stream = MemoryStream(store)
    return stream, store


def _make_handler(
    *,
    memory_stream: MemoryStream | None = None,
    ananke_runtimes: dict | None = None,
    last_sleep_tick: int = 0,
) -> MagicMock:
    handler = MagicMock(spec=[
        "_ananke_runtimes",
        "_last_sleep_tick",
        "memory",
    ])
    handler._ananke_runtimes = ananke_runtimes if ananke_runtimes is not None else {}
    handler._last_sleep_tick = last_sleep_tick
    handler.memory = memory_stream
    return handler


async def _make_client(handler: Any, secret: str) -> TestClient:
    server = BrainHttpServer(handler=handler, secret=secret, port=0)
    test_server = TestServer(server._app)
    client = TestClient(test_server)
    await client.start_server()
    return client


def _skill_hash(instructions: str) -> str:
    return hashlib.sha256(instructions.encode()).hexdigest()


# ── SkillStore.get_by_hash unit tests ─────────────────────────────────────────

class TestSkillStoreGetByHash:
    def test_get_by_hash_returns_skill_for_known_hash(self) -> None:
        store = MemoryStore(":memory:")
        skill_store = SkillStore(store._conn)
        instructions = "Be curious and ask good questions"
        skill = Skill(
            name="ask_questions",
            description="Practice questioning",
            instructions=instructions,
        )
        skill_store.add(skill)

        h = _skill_hash(instructions)
        result = skill_store.get_by_hash(h)

        assert result is not None
        assert result.name == "ask_questions"
        assert result.description == "Practice questioning"

    def test_get_by_hash_returns_none_for_unknown_hash(self) -> None:
        store = MemoryStore(":memory:")
        skill_store = SkillStore(store._conn)

        result = skill_store.get_by_hash("a" * 64)
        assert result is None

    def test_get_by_hash_distinguishes_between_multiple_skills(self) -> None:
        store = MemoryStore(":memory:")
        skill_store = SkillStore(store._conn)

        instructions_a = "Do thing A with precision"
        instructions_b = "Do thing B with care"
        skill_store.add(Skill(name="skill_a", description="Skill A", instructions=instructions_a))
        skill_store.add(Skill(name="skill_b", description="Skill B", instructions=instructions_b))

        result_a = skill_store.get_by_hash(_skill_hash(instructions_a))
        result_b = skill_store.get_by_hash(_skill_hash(instructions_b))

        assert result_a is not None and result_a.name == "skill_a"
        assert result_b is not None and result_b.name == "skill_b"

    def test_get_by_hash_returns_none_for_empty_store(self) -> None:
        store = MemoryStore(":memory:")
        skill_store = SkillStore(store._conn)
        result = skill_store.get_by_hash("b" * 64)
        assert result is None


# ── HTTP endpoint tests ───────────────────────────────────────────────────────

class TestSkillsHttpEndpointAuth:
    async def test_missing_secret_returns_401(self) -> None:
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        instructions = "Some instructions here"
        skill_store.add(Skill(name="test_skill", description="A skill", instructions=instructions))
        h = _skill_hash(instructions)

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(f"/skills/{h}")
            assert resp.status == 401
        finally:
            await client.close()

    async def test_wrong_secret_returns_401(self) -> None:
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        instructions = "Some instructions here"
        skill_store.add(Skill(name="test_skill", description="A skill", instructions=instructions))
        h = _skill_hash(instructions)

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(f"/skills/{h}", headers={"X-Brain-Secret": "wrong"})
            assert resp.status == 401
        finally:
            await client.close()


class TestSkillsHttpEndpointResponse:
    async def test_known_hash_returns_200_with_name_and_description(self) -> None:
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        instructions = "Practice active listening and empathy"
        skill_store.add(Skill(name="active_listening", description="Listen deeply", instructions=instructions))
        h = _skill_hash(instructions)

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(f"/skills/{h}", headers={"X-Brain-Secret": SECRET})
            assert resp.status == 200
            body = await resp.json()
            assert body["name"] == "active_listening"
            assert body["description"] == "Listen deeply"
        finally:
            await client.close()

    async def test_response_has_exactly_two_keys(self) -> None:
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        instructions = "Only two keys should be returned"
        skill_store.add(Skill(name="two_key_skill", description="Two keys", instructions=instructions))
        h = _skill_hash(instructions)

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(f"/skills/{h}", headers={"X-Brain-Secret": SECRET})
            body = await resp.json()
            assert set(body.keys()) == {"name", "description"}, (
                f"Expected exactly {{name, description}}, got {set(body.keys())}"
            )
        finally:
            await client.close()

    async def test_unknown_hash_returns_404(self) -> None:
        stream, store = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(f"/skills/{'c' * 64}", headers={"X-Brain-Secret": SECRET})
            assert resp.status == 404
            body = await resp.json()
            assert body.get("error") == "not_found"
        finally:
            await client.close()

    async def test_response_keys_are_alphabetical_description_then_name(self) -> None:
        """Validate closed-key contract: exactly {description, name}."""
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        instructions = "Check key ordering"
        skill_store.add(Skill(name="order_check", description="Order desc", instructions=instructions))
        h = _skill_hash(instructions)

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(f"/skills/{h}", headers={"X-Brain-Secret": SECRET})
            body = await resp.json()
            actual_keys = sorted(body.keys())
            assert actual_keys == ["description", "name"]
        finally:
            await client.close()

    async def test_instructions_not_in_response(self) -> None:
        """Plaintext gate: skill instructions must never appear in response body."""
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        secret_instructions = "CONFIDENTIAL INSTRUCTIONS DO NOT EXPOSE"
        skill_store.add(Skill(name="secret_skill", description="A skill", instructions=secret_instructions))
        h = _skill_hash(secret_instructions)

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(f"/skills/{h}", headers={"X-Brain-Secret": SECRET})
            body = await resp.json()
            import json
            raw = json.dumps(body)
            assert "CONFIDENTIAL INSTRUCTIONS" not in raw
        finally:
            await client.close()

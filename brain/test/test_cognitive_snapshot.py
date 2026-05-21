"""Tests for the cognitive-snapshot HTTP endpoint (Task 2).

Covers:
- Auth gate: missing / wrong / correct X-Brain-Secret
- Response shape: exactly 5 top-level keys
- Drive shape: always 5 keys with float values
- Missing runtime: all drive_levels default to 0.0
- Skill titles only: .name extracted, never .instructions content
- K=10 limit: ≤10 entries returned
- Plaintext gate: forbidden keys absent from json.dumps(response)
- Counts: reflexion_count and rule_count match seeded data
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock

import pytest
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from noesis_brain.ananke.types import DriveName
from noesis_brain.http.server import BrainHttpServer
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.memory.types import Memory, MemoryType, WikiCategory, WikiPage
from noesis_brain.skills.store import SkillStore
from noesis_brain.skills.types import Skill

# ── Forbidden keys (D-25a-05) ─────────────────────────────────────────────────

FORBIDDEN_KEYS = [
    "reflexion_text",
    "rule_text",
    "creed_text",
    "skill_body",
    "lore_body",
    "whisper_plaintext",
]

EXPECTED_KEYS = {
    "drive_levels",
    "last_sleep_tick",
    "reflexion_count",
    "rule_count",
    "skill_titles_topk",
}

EXPECTED_DRIVE_NAMES = {"hunger", "curiosity", "safety", "boredom", "loneliness"}

SECRET = "test-secret-abc123"


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_memory_store() -> tuple[MemoryStream, MemoryStore]:
    """Return a fresh in-memory MemoryStore + MemoryStream pair."""
    store = MemoryStore(":memory:")
    stream = MemoryStream(store)
    return stream, store


def _make_handler(
    *,
    memory_stream: MemoryStream | None = None,
    memory_store: MemoryStore | None = None,
    ananke_runtimes: dict | None = None,
    last_sleep_tick: int = 0,
) -> MagicMock:
    """Build a minimal mock BrainHandler for endpoint tests."""
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
    """Create an aiohttp TestClient backed by a BrainHttpServer."""
    server = BrainHttpServer(handler=handler, secret=secret, port=0)
    # Build test server directly from the aiohttp app
    test_server = TestServer(server._app)
    client = TestClient(test_server)
    await client.start_server()
    return client


# ── Auth gate tests ───────────────────────────────────────────────────────────

class TestAuthGate:
    async def test_no_secret_header_returns_401(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get("/cognitive-snapshot/did:noesis:test")
            assert resp.status == 401
        finally:
            await client.close()

    async def test_wrong_secret_returns_401(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": "wrong-secret"},
            )
            assert resp.status == 401
        finally:
            await client.close()

    async def test_correct_secret_returns_200(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            assert resp.status == 200
        finally:
            await client.close()


# ── Response shape tests ──────────────────────────────────────────────────────

class TestResponseShape:
    async def test_exactly_five_top_level_keys(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            assert set(body.keys()) == EXPECTED_KEYS
        finally:
            await client.close()

    async def test_drive_levels_has_five_keys(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            assert set(body["drive_levels"].keys()) == EXPECTED_DRIVE_NAMES
        finally:
            await client.close()

    async def test_drive_levels_are_floats(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            for key, val in body["drive_levels"].items():
                assert isinstance(val, float), f"drive_levels[{key!r}] is not float: {val!r}"
        finally:
            await client.close()

    async def test_skill_titles_topk_is_list(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            assert isinstance(body["skill_titles_topk"], list)
        finally:
            await client.close()


# ── Missing runtime tests ─────────────────────────────────────────────────────

class TestMissingRuntime:
    async def test_missing_runtime_all_drives_zero(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream, ananke_runtimes={})
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:nobody",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            for drive in EXPECTED_DRIVE_NAMES:
                assert body["drive_levels"][drive] == 0.0, (
                    f"drive_levels[{drive!r}] should be 0.0 when runtime absent"
                )
        finally:
            await client.close()


# ── Skill titles only tests ───────────────────────────────────────────────────

class TestSkillTitlesOnly:
    async def test_skill_name_in_response_not_instructions(self) -> None:
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        secret_body = "SECRET INSTRUCTIONS BODY TEXT"
        skill_store.add(Skill(
            name="do_trade",
            description="A trade skill",
            instructions=secret_body,
        ))

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            raw = json.dumps(body)

            assert "do_trade" in body["skill_titles_topk"], "skill name must appear in titles"
            assert secret_body not in raw, "skill instructions must NOT appear in response"
        finally:
            await client.close()

    async def test_k10_limit_with_15_skills(self) -> None:
        stream, store = _make_memory_store()
        skill_store = SkillStore(store._conn)
        for i in range(15):
            skill_store.add(Skill(
                name=f"skill_{i:02d}",
                description=f"Skill number {i}",
                instructions=f"Do thing {i}",
                # vary last_used_at so ordering is deterministic
                last_used_at=datetime(2024, 1, i + 1, tzinfo=timezone.utc),
            ))

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            assert len(body["skill_titles_topk"]) == 10, (
                f"Expected K=10 titles, got {len(body['skill_titles_topk'])}"
            )
        finally:
            await client.close()


# ── Plaintext gate tests ──────────────────────────────────────────────────────

class TestPlaintextGate:
    async def test_forbidden_keys_absent_from_json(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            raw = json.dumps(body)
            for key in FORBIDDEN_KEYS:
                assert key not in raw, (
                    f"Forbidden key {key!r} found in response JSON"
                )
        finally:
            await client.close()


# ── Count tests ───────────────────────────────────────────────────────────────

class TestCounts:
    async def test_reflexion_count_matches_seeded_data(self) -> None:
        stream, store = _make_memory_store()
        # Add 3 reflections and 2 observations
        for i in range(3):
            store.add_memory(Memory(
                memory_type=MemoryType.REFLECTION,
                content=f"Reflection {i}",
            ))
        for i in range(2):
            store.add_memory(Memory(
                memory_type=MemoryType.OBSERVATION,
                content=f"Observation {i}",
            ))

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            assert body["reflexion_count"] == 3, (
                f"Expected reflexion_count=3, got {body['reflexion_count']}"
            )
        finally:
            await client.close()

    async def test_rule_count_matches_seeded_data(self) -> None:
        stream, store = _make_memory_store()
        # Add 2 self_model_rule_ pages and 1 non-rule SELF_MODEL page
        store.add_wiki_page(WikiPage(
            title="self_model_rule_be_kind",
            category=WikiCategory.SELF_MODEL,
            content="Always be kind",
        ))
        store.add_wiki_page(WikiPage(
            title="self_model_rule_be_honest",
            category=WikiCategory.SELF_MODEL,
            content="Always be honest",
        ))
        store.add_wiki_page(WikiPage(
            title="self_model_general_note",
            category=WikiCategory.SELF_MODEL,
            content="A non-rule SELF_MODEL page",
        ))

        handler = _make_handler(memory_stream=stream)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            assert body["rule_count"] == 2, (
                f"Expected rule_count=2, got {body['rule_count']}"
            )
        finally:
            await client.close()

    async def test_last_sleep_tick_matches_handler(self) -> None:
        stream, _ = _make_memory_store()
        handler = _make_handler(memory_stream=stream, last_sleep_tick=42)
        client = await _make_client(handler, SECRET)
        try:
            resp = await client.get(
                "/cognitive-snapshot/did:noesis:test",
                headers={"X-Brain-Secret": SECRET},
            )
            body = await resp.json()
            assert body["last_sleep_tick"] == 42
        finally:
            await client.close()

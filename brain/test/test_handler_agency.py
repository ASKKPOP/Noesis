"""Tests for BrainHandler operator-agency RPC methods — Phase 6 AGENCY-02.

Covers:
    - query_memory (H2 Reviewer)
        * returns normalized {timestamp, kind, summary} entries only
        * substring filter narrows results (case-insensitive)
        * limit is clamped to [1, 100] and defaults to 20
        * missing memory store yields empty list (no crash)
    - force_telos (H4 Driver)
        * returns ONLY {telos_hash_before, telos_hash_after} — no goal contents
        * hash shape is 64-hex SHA-256 (matches grid-side regex /^[a-f0-9]{64}$/)
        * identical payload → before == after (idempotent on unchanged Telos)
        * new payload → before != after AND active goals match the new set
        * empty payload replaces all goals (after-hash matches empty-Telos hash)

All methods respect PHILOSOPHY §1 sovereignty: Brain owns full memory + Telos
plaintext; Grid only ever sees summaries / hashes. These tests are the Python
half of the D-11/D-19 privacy invariants — the grid-side
operator-payload-privacy.test.ts owns the audit-layer enforcement.
"""

from __future__ import annotations

import re
from unittest.mock import AsyncMock

import pytest

from noesis_brain.llm.types import LLMResponse
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.psyche.types import (
    CommunicationStyle,
    PersonalityProfile,
    Psyche,
)
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos.hashing import compute_active_telos_hash
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType
from noesis_brain.thymos.tracker import ThymosTracker


# ── Fixture helpers (mirror test_get_state_widening.py) ────────────────


def _make_psyche() -> Psyche:
    return Psyche(
        name="Sophia",
        archetype="The Philosopher",
        personality=PersonalityProfile(
            openness="high",
            conscientiousness="medium",
            extraversion="medium",
            agreeableness="high",
            resilience="medium",
            ambition="high",
        ),
        values=["truth"],
        communication_style=CommunicationStyle.THOUGHTFUL,
    )


def _make_thymos() -> ThymosTracker:
    return ThymosTracker(
        config={
            "baseline_mood": "neutral",
            "emotional_intensity": "medium",
        }
    )


def _make_telos() -> TelosManager:
    mgr = TelosManager()
    mgr.add_goal("Learn about the Grid", GoalType.SHORT_TERM, priority=0.8)
    mgr.add_goal("Befriend Hermes", GoalType.MEDIUM_TERM, priority=0.5)
    return mgr


def _make_llm() -> AsyncMock:
    llm = AsyncMock()
    llm.generate.return_value = LLMResponse(
        text="...",
        model="test-model",
        provider="mock",
        usage={"prompt_tokens": 1, "completion_tokens": 1},
    )
    return llm


def _make_memory_with_entries(entries: list[str]) -> MemoryStream:
    """Build a real MemoryStream with the supplied observation strings."""
    stream = MemoryStream(MemoryStore(":memory:"))
    for i, content in enumerate(entries):
        stream.observe(content=content, importance=5.0 + i, tick=i)
    return stream


def _build_handler(
    *,
    memory: MemoryStream | None = None,
    telos: TelosManager | None = None,
) -> BrainHandler:
    return BrainHandler(
        psyche=_make_psyche(),
        thymos=_make_thymos(),
        telos=telos if telos is not None else _make_telos(),
        llm=_make_llm(),
        memory=memory,
        did="did:noesis:sophia",
    )


HEX64_RE = re.compile(r"^[a-f0-9]{64}$")


# ── query_memory (H2 Reviewer) ─────────────────────────────────────────


class TestQueryMemory:
    async def test_returns_normalized_shape_only(self) -> None:
        """Each entry must be exactly {timestamp, kind, summary}."""
        memory = _make_memory_with_entries(
            ["saw a merchant at the agora", "heard a rumor about trade"],
        )
        handler = _build_handler(memory=memory)

        result = await handler.query_memory({"query": "", "limit": 10})

        assert "entries" in result
        assert isinstance(result["entries"], list)
        assert len(result["entries"]) == 2
        for entry in result["entries"]:
            assert set(entry.keys()) == {"timestamp", "kind", "summary"}
            # Summary MUST be the only content-bearing field; nothing else
            # from Memory (source_did, importance, location, tick) surfaces.
            assert isinstance(entry["summary"], str)
            assert isinstance(entry["kind"], str)
            assert isinstance(entry["timestamp"], str)

    async def test_substring_filter_case_insensitive(self) -> None:
        memory = _make_memory_with_entries(
            [
                "saw a Merchant at the agora",
                "heard a rumor about trade",
                "noticed a lantern flicker",
            ],
        )
        handler = _build_handler(memory=memory)

        result = await handler.query_memory({"query": "merchant", "limit": 10})

        # Only the first entry contains "merchant" (case-insensitive).
        assert len(result["entries"]) == 1
        assert "merchant" in result["entries"][0]["summary"].lower()

    async def test_limit_clamped_and_defaults(self) -> None:
        """Limit is clamped to [1, 100]; out-of-range values normalise safely."""
        memory = _make_memory_with_entries([f"observation #{i}" for i in range(30)])
        handler = _build_handler(memory=memory)

        # Explicit limit honoured.
        r1 = await handler.query_memory({"query": "", "limit": 5})
        assert len(r1["entries"]) == 5

        # Zero/negative clamped to 1.
        r2 = await handler.query_memory({"query": "", "limit": 0})
        assert len(r2["entries"]) == 1

        r3 = await handler.query_memory({"query": "", "limit": -9})
        assert len(r3["entries"]) == 1

        # Over-100 clamped to 100 (we only have 30, so we get 30).
        r4 = await handler.query_memory({"query": "", "limit": 9999})
        assert len(r4["entries"]) == 30

    async def test_missing_memory_store_returns_empty(self) -> None:
        """No memory attached → empty entries, never raise."""
        handler = _build_handler(memory=None)

        result = await handler.query_memory({"query": "anything", "limit": 5})

        assert result == {"entries": []}


# ── force_telos (H4 Driver) ─────────────────────────────────────────────


class TestForceTelos:
    async def test_returns_hash_only_payload(self) -> None:
        """Response must carry EXACTLY {telos_hash_before, telos_hash_after}."""
        handler = _build_handler()

        result = await handler.force_telos(
            {"new_telos": {"short_term": ["seek balance"]}}
        )

        # Closed payload: only hash fields cross the boundary.
        assert set(result.keys()) == {"telos_hash_before", "telos_hash_after"}
        # No goal contents, no free text, no structured Telos data.
        serialised = str(result)
        assert "seek balance" not in serialised
        assert "Learn about the Grid" not in serialised

    async def test_hash_shape_is_64_hex(self) -> None:
        handler = _build_handler()

        result = await handler.force_telos(
            {"new_telos": {"short_term": ["observe the agora"]}}
        )

        assert HEX64_RE.match(result["telos_hash_before"]), (
            f"before hash {result['telos_hash_before']!r} must be 64-hex"
        )
        assert HEX64_RE.match(result["telos_hash_after"]), (
            f"after hash {result['telos_hash_after']!r} must be 64-hex"
        )

    async def test_new_payload_changes_hash_and_goals(self) -> None:
        handler = _build_handler()
        before_hash_snapshot = compute_active_telos_hash(handler.telos.all_goals())

        result = await handler.force_telos(
            {
                "new_telos": {
                    "short_term": ["trade knowledge for grain"],
                    "long_term": ["understand the logos"],
                }
            }
        )

        # Round-trip invariant: the returned before-hash equals the pre-call
        # snapshot, and the after-hash matches what compute_active_telos_hash
        # returns on the rebuilt manager. This is the anchor for v2.1's
        # zero-diff cross-phase hash compatibility.
        assert result["telos_hash_before"] == before_hash_snapshot
        assert result["telos_hash_after"] == compute_active_telos_hash(
            handler.telos.all_goals()
        )
        assert result["telos_hash_before"] != result["telos_hash_after"]

        # The active goal set is the rebuilt one, not the original.
        descriptions = [g.description for g in handler.telos.active_goals()]
        assert "trade knowledge for grain" in descriptions
        assert "understand the logos" in descriptions
        assert "Learn about the Grid" not in descriptions  # original goal gone

    async def test_empty_payload_replaces_all_goals(self) -> None:
        """Empty new_telos → zero active goals; after-hash matches empty hash."""
        handler = _build_handler()

        result = await handler.force_telos({"new_telos": {}})

        assert handler.telos.active_goals() == []
        empty_hash = compute_active_telos_hash([])
        assert result["telos_hash_after"] == empty_hash

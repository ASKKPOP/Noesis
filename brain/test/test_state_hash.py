"""AGENCY-05 state-hash helpers — component determinism + 4-key contract.

Tests the Brain-side compute_pre_deletion_state_hash helper that returns
the 4-key tuple Grid's combineStateHash() composes into pre_deletion_state_hash.
"""
from __future__ import annotations

import re
from unittest.mock import AsyncMock

import pytest

from noesis_brain.psyche.types import (
    CommunicationStyle,
    PersonalityProfile,
    Psyche,
)
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.state_hash import (
    compute_pre_deletion_state_hash,
    hash_memory_stream,
    hash_psyche,
    hash_telos,
    hash_thymos,
)
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType
from noesis_brain.thymos.tracker import ThymosTracker


HEX64_RE = re.compile(r"^[0-9a-f]{64}$")


# ── Fixture builders ───────────────────────────────────────────────────────


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
        values=["truth", "knowledge"],
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


def _make_handler() -> BrainHandler:
    return BrainHandler(
        psyche=_make_psyche(),
        thymos=_make_thymos(),
        telos=_make_telos(),
        llm=AsyncMock(),
        grid_name="genesis",
        location="Agora Central",
        memory=None,
        did="did:noesis:sophia",
    )


# ── Tests for individual hash helpers ─────────────────────────────────────


def test_hash_psyche_returns_64hex():
    handler = _make_handler()
    out = hash_psyche(handler)
    assert HEX64_RE.match(out), f"not 64-hex: {out!r}"


def test_hash_thymos_returns_64hex():
    handler = _make_handler()
    out = hash_thymos(handler)
    assert HEX64_RE.match(out), f"not 64-hex: {out!r}"


def test_hash_telos_returns_64hex():
    handler = _make_handler()
    out = hash_telos(handler)
    assert HEX64_RE.match(out), f"not 64-hex: {out!r}"


def test_hash_memory_stream_returns_64hex():
    handler = _make_handler()
    out = hash_memory_stream(handler)
    assert HEX64_RE.match(out), f"not 64-hex: {out!r}"


# ── Tests for the 4-key orchestrator ──────────────────────────────────────


def test_compute_returns_exactly_4_keys():
    """D-10 closed-tuple contract — no state_hash, no pre_deletion_state_hash."""
    handler = _make_handler()
    result = compute_pre_deletion_state_hash(handler)
    assert set(result.keys()) == {
        "psyche_hash", "thymos_hash", "telos_hash", "memory_stream_hash",
    }, f"Brain leaked extra key (D-03 forbids 5th composed hash): {result.keys()!r}"


def test_compute_all_values_are_64hex():
    handler = _make_handler()
    result = compute_pre_deletion_state_hash(handler)
    for key, value in result.items():
        assert HEX64_RE.match(value), f"{key} is not 64-hex: {value!r}"


def test_compute_deterministic():
    """Determinism (D-07)."""
    handler = _make_handler()
    a = compute_pre_deletion_state_hash(handler)
    b = compute_pre_deletion_state_hash(handler)
    assert a == b


def test_orthogonality_psyche_mutation():
    """Mutating psyche changes psyche_hash ONLY."""
    handler = _make_handler()
    before = compute_pre_deletion_state_hash(handler)
    handler.psyche.personality.openness = "low"  # mutate psyche
    after = compute_pre_deletion_state_hash(handler)
    assert after["psyche_hash"] != before["psyche_hash"]
    assert after["thymos_hash"] == before["thymos_hash"]
    assert after["telos_hash"] == before["telos_hash"]
    assert after["memory_stream_hash"] == before["memory_stream_hash"]


def test_orthogonality_telos_mutation():
    """Mutating telos changes telos_hash ONLY."""
    handler = _make_handler()
    before = compute_pre_deletion_state_hash(handler)
    # Mutate an existing goal's description
    goals = handler.telos.active_goals()
    if goals:
        goals[0].description = "mutated goal description"
    after = compute_pre_deletion_state_hash(handler)
    assert after["psyche_hash"] == before["psyche_hash"]
    assert after["thymos_hash"] == before["thymos_hash"]
    assert after["telos_hash"] != before["telos_hash"]
    assert after["memory_stream_hash"] == before["memory_stream_hash"]


def test_no_state_hash_key_in_result():
    """D-03 invariant — Brain NEVER returns a composed state_hash.
       If this test fails, a developer tried to compose on the Brain side."""
    handler = _make_handler()
    result = compute_pre_deletion_state_hash(handler)
    assert "state_hash" not in result
    assert "pre_deletion_state_hash" not in result

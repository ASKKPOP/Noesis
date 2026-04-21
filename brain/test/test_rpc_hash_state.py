"""AGENCY-05 RPC hash_state method — contract test.

Tests the BrainHandler.hash_state() RPC method that returns the
4-key component-hash tuple to Grid for pre-deletion forensics.
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
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType
from noesis_brain.thymos.tracker import ThymosTracker


HEX64_RE = re.compile(r"^[0-9a-f]{64}$")


# ── Fixture builder ────────────────────────────────────────────────────────


def _make_handler(did: str = "did:noesis:sophia") -> BrainHandler:
    psyche = Psyche(
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
    thymos = ThymosTracker(config={"baseline_mood": "neutral", "emotional_intensity": "medium"})
    telos = TelosManager()
    telos.add_goal("Learn about the Grid", GoalType.SHORT_TERM, priority=0.8)
    return BrainHandler(
        psyche=psyche,
        thymos=thymos,
        telos=telos,
        llm=AsyncMock(),
        grid_name="genesis",
        location="Agora Central",
        memory=None,
        did=did,
    )


# ── Tests ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_hash_state_returns_4_keys():
    """Happy path — method returns exactly the 4-key tuple."""
    handler = _make_handler()
    result = await handler.hash_state(params={})
    assert set(result.keys()) == {
        "psyche_hash", "thymos_hash", "telos_hash", "memory_stream_hash",
    }


@pytest.mark.asyncio
async def test_hash_state_values_are_64hex():
    handler = _make_handler()
    result = await handler.hash_state(params={})
    for key, value in result.items():
        assert HEX64_RE.match(value), f"{key} is not 64-hex: {value!r}"


@pytest.mark.asyncio
async def test_hash_state_no_composed_hash_leaked():
    """D-03 — Brain never returns a 5th composed hash."""
    handler = _make_handler()
    result = await handler.hash_state(params={})
    assert "state_hash" not in result
    assert "pre_deletion_state_hash" not in result


@pytest.mark.asyncio
async def test_hash_state_deterministic():
    """Two back-to-back calls return identical bodies (no time-based drift)."""
    handler = _make_handler()
    a = await handler.hash_state(params={})
    b = await handler.hash_state(params={})
    assert a == b


@pytest.mark.asyncio
async def test_hash_state_returns_dict_of_strings():
    """All values in the returned dict are strings."""
    handler = _make_handler()
    result = await handler.hash_state(params={})
    for key, value in result.items():
        assert isinstance(value, str), f"{key}: expected str, got {type(value).__name__}"

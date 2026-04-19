"""Tests for widened BrainHandler.get_state() — Phase 04 Plan 02.

Covers:
    - Backward compatibility: old constructor signature still works and all six legacy keys are preserved.
    - New keyword-only arguments: `memory` and `did` are accepted and exposed.
    - New structured sub-dicts: `psyche`, `thymos`, `telos`, `memory_highlights`.
    - Goal id stability across calls (sha256 of description when Goal has no id attribute).
    - `memory_highlights` is capped at 5 entries and carries the normalised shape.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock

from noesis_brain.llm.types import LLMResponse
from noesis_brain.memory.stream import MemoryStream
from noesis_brain.memory.sqlite_store import MemoryStore
from noesis_brain.memory.types import MemoryType
from noesis_brain.psyche.types import (
    CommunicationStyle,
    PersonalityProfile,
    Psyche,
)
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import GoalType
from noesis_brain.thymos.tracker import ThymosTracker


# ── Fixture helpers ──────────────────────────────────────────


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


def _make_memory_with_entries(count: int) -> MemoryStream:
    """Build a real MemoryStream with `count` ordered entries."""
    stream = MemoryStream(MemoryStore(":memory:"))
    for i in range(count):
        stream.observe(content=f"observation #{i}", importance=5.0 + i, tick=i)
    return stream


# ── Backward-compatible construction ─────────────────────────


class TestBackwardCompatibleConstruction:
    def test_old_signature_still_works(self) -> None:
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
            grid_name="genesis",
            location="Agora Central",
        )
        state = handler.get_state()
        for key in ("name", "archetype", "mood", "emotions", "active_goals", "location"):
            assert key in state, f"legacy key {key!r} must remain"
        assert state["name"] == "Sophia"
        assert state["archetype"] == "The Philosopher"
        assert state["location"] == "Agora Central"

    def test_new_keys_have_safe_defaults_without_memory_or_did(self) -> None:
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
        )
        state = handler.get_state()
        assert state["did"] == ""
        assert state["grid_name"] == "genesis"
        assert state["memory_highlights"] == []


# ── Memory highlights shaping + cap ──────────────────────────


class TestMemoryHighlights:
    def test_cap_at_five_entries(self) -> None:
        memory = _make_memory_with_entries(count=7)
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
            memory=memory,
            did="did:noesis:sophia",
        )
        state = handler.get_state()
        assert isinstance(state["memory_highlights"], list)
        assert len(state["memory_highlights"]) == 5

    def test_entry_shape_is_exactly_three_keys(self) -> None:
        memory = _make_memory_with_entries(count=3)
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
            memory=memory,
            did="did:noesis:sophia",
        )
        state = handler.get_state()
        assert len(state["memory_highlights"]) == 3
        for entry in state["memory_highlights"]:
            assert set(entry.keys()) == {"timestamp", "kind", "summary"}
            assert isinstance(entry["summary"], str)
            assert isinstance(entry["kind"], str)

    def test_none_memory_yields_empty_list(self) -> None:
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
            memory=None,
            did="did:noesis:sophia",
        )
        assert handler.get_state()["memory_highlights"] == []


# ── Psyche snapshot ──────────────────────────────────────────


class TestPsycheSnapshot:
    def test_big_five_keys_present_as_floats(self) -> None:
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
        )
        state = handler.get_state()
        psyche = state["psyche"]
        required = {
            "openness",
            "conscientiousness",
            "extraversion",
            "agreeableness",
            "neuroticism",
        }
        assert required.issubset(psyche.keys()), f"missing: {required - psyche.keys()}"
        for key in required:
            value = psyche[key]
            assert isinstance(value, float), f"{key!r} must be float, got {type(value).__name__}"
            assert 0.0 <= value <= 1.0, f"{key!r} must be in [0.0, 1.0], got {value}"


# ── Telos goal ids are stable ────────────────────────────────


class TestTelosGoalIds:
    def test_goal_ids_present_and_stable_across_calls(self) -> None:
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
        )
        first = handler.get_state()["telos"]["active_goals"]
        second = handler.get_state()["telos"]["active_goals"]
        assert len(first) == 2
        for g in first:
            assert set(g.keys()) >= {"id", "description", "priority"}
            assert isinstance(g["id"], str) and g["id"]
        assert [g["id"] for g in first] == [g["id"] for g in second]

    def test_legacy_active_goals_still_list_of_strings(self) -> None:
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
        )
        state = handler.get_state()
        assert isinstance(state["active_goals"], list)
        assert all(isinstance(s, str) for s in state["active_goals"])
        assert "Learn about the Grid" in state["active_goals"]


# ── Thymos sub-dict shape ────────────────────────────────────


class TestThymosSubDict:
    def test_mood_is_string_and_emotions_is_float_dict(self) -> None:
        handler = BrainHandler(
            psyche=_make_psyche(),
            thymos=_make_thymos(),
            telos=_make_telos(),
            llm=_make_llm(),
        )
        state = handler.get_state()
        thymos = state["thymos"]
        assert isinstance(thymos["mood"], str)
        assert isinstance(thymos["emotions"], dict)
        for name, intensity in thymos["emotions"].items():
            assert isinstance(name, str)
            assert isinstance(intensity, float)
            assert 0.0 <= intensity <= 1.0

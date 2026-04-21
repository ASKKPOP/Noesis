"""DIALOG-02: Brain on_tick dialogue_context consumption branch tests.

Covers 07-CONTEXT.md D-10 (additive widening), D-11 (per-participant
delivery), D-15 (Brain opt-in). Verifies additive-widening compatibility
— the Phase 6 test_get_state_widening contract extends here.
"""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche.types import (
    CommunicationStyle,
    PersonalityProfile,
    Psyche,
)
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos.manager import TelosManager
from noesis_brain.thymos.tracker import ThymosTracker

from test.dialogue_fixtures import (
    make_dialogue_context,
    make_dialogue_context_no_match,
)


# ── Local fixture builders (mirror test_handler_agency.py pattern) ─────


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


def _make_llm() -> AsyncMock:
    llm = AsyncMock()
    llm.generate.return_value = LLMResponse(
        text="...",
        model="test-model",
        provider="mock",
        usage={"prompt_tokens": 1, "completion_tokens": 1},
    )
    return llm


def _make_handler(goal_descriptions: list[str] | None = None) -> BrainHandler:
    goals = goal_descriptions if goal_descriptions is not None else ["Survive the day"]
    telos = TelosManager.from_yaml(
        {"short_term": goals, "medium_term": [], "long_term": []}
    )
    return BrainHandler(
        psyche=_make_psyche(),
        thymos=_make_thymos(),
        telos=telos,
        llm=_make_llm(),
        did="did:noesis:sophia",
    )


# ── Tests ──────────────────────────────────────────────────────────────


async def test_on_tick_without_dialogue_context_preserves_pre_phase7_behavior():
    """Additive widening: absent dialogue_context → Phase 6 NOOP path unchanged."""
    handler = _make_handler()
    response = await handler.on_tick({"tick": 1, "epoch": 1})
    assert isinstance(response, list) and len(response) == 1
    assert response[0]["action_type"] == "noop"


async def test_on_tick_empty_dialogue_context_list_falls_through_to_noop():
    handler = _make_handler()
    response = await handler.on_tick(
        {"tick": 1, "epoch": 1, "dialogue_context": []}
    )
    assert len(response) == 1 and response[0]["action_type"] == "noop"


async def test_on_tick_non_list_dialogue_context_does_not_crash():
    """Defense-in-depth: a non-list dialogue_context (RPC misformat) drops to NOOP."""
    handler = _make_handler()
    response = await handler.on_tick(
        {"tick": 1, "epoch": 1, "dialogue_context": "not a list"}
    )
    assert len(response) == 1 and response[0]["action_type"] == "noop"


async def test_on_tick_dialogue_context_without_match_produces_noop():
    """Non-matching dialogue → heuristic returns None → NOOP fallback."""
    handler = _make_handler(goal_descriptions=["Survive the day"])
    response = await handler.on_tick(
        {
            "tick": 1,
            "epoch": 1,
            "dialogue_context": [make_dialogue_context_no_match()],
        }
    )
    assert len(response) == 1 and response[0]["action_type"] == "noop"


async def test_on_tick_matching_dialogue_produces_telos_refined():
    # Two goals ensure promotion mutates the canonical hash (the non-matching
    # goal flips from short_term to medium_term). A single already-short_term
    # goal would be a silent no-op by design (D-22).
    handler = _make_handler(goal_descriptions=["Survive the day", "Make allies"])
    response = await handler.on_tick(
        {
            "tick": 1,
            "epoch": 1,
            "dialogue_context": [make_dialogue_context()],
        }
    )
    types = {a["action_type"] for a in response}
    assert "telos_refined" in types


async def test_on_tick_multiple_contexts_are_all_evaluated():
    """D-11: a single tick may carry multiple dialogue_contexts; each is evaluated."""
    handler = _make_handler(
        goal_descriptions=["Survive the day", "Make allies"]
    )
    c1 = make_dialogue_context(dialogue_id="1111222233334444")
    c2 = make_dialogue_context_no_match()  # second context is a non-match
    c2["dialogue_id"] = "5555666677778888"
    response = await handler.on_tick(
        {"tick": 1, "epoch": 1, "dialogue_context": [c1, c2]}
    )
    # c1 produces refined; c2 is a no-match → no extra action.
    refined = [a for a in response if a["action_type"] == "telos_refined"]
    assert len(refined) == 1
    assert refined[0]["metadata"]["triggered_by_dialogue_id"] == "1111222233334444"


async def test_on_tick_handles_utterance_at_boundary_length():
    """Grid upstream caps utterance text at 200 chars. Brain must not crash
    on boundary-length strings; does not re-inflate."""
    handler = _make_handler(goal_descriptions=["Survive the day"])
    boundary = "survive the day " + ("x" * (200 - len("survive the day ")))
    ctx = make_dialogue_context(
        utterances=[
            {
                "tick": 1,
                "speaker_did": "did:noesis:a",
                "speaker_name": "A",
                "text": boundary[:200],
            },
            {
                "tick": 2,
                "speaker_did": "did:noesis:b",
                "speaker_name": "B",
                "text": boundary[:201],
            },
        ]
    )
    response = await handler.on_tick(
        {"tick": 1, "epoch": 1, "dialogue_context": [ctx]}
    )
    assert isinstance(response, list)  # no crash; either refined or noop acceptable


async def test_on_tick_ignores_non_dict_entries_in_list():
    """Defensive: non-dict entries in dialogue_context list are skipped."""
    # Two goals so the valid entry produces a real mutation (see note in
    # test_on_tick_matching_dialogue_produces_telos_refined).
    handler = _make_handler(goal_descriptions=["Survive the day", "Make allies"])
    response = await handler.on_tick(
        {
            "tick": 1,
            "epoch": 1,
            "dialogue_context": [None, "string", 42, make_dialogue_context()],
        }
    )
    # Only the one valid dict should produce a refinement.
    refined = [a for a in response if a["action_type"] == "telos_refined"]
    assert len(refined) == 1

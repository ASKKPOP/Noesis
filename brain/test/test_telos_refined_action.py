"""DIALOG-02: Brain-side telos_refined action contract tests.

Covers 07-CONTEXT.md D-13 (ActionType extension), D-14 (metadata contract),
D-18 (no plaintext crosses boundary), D-20 (closed 4-key tuple — minus
`did` which grid injects). Mirrors the Phase 6 force_telos hash-only
pattern (handler.py:376).
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
from noesis_brain.rpc.types import ActionType
from noesis_brain.telos.hashing import compute_active_telos_hash
from noesis_brain.telos.manager import TelosManager
from noesis_brain.thymos.tracker import ThymosTracker

from test.dialogue_fixtures import (
    make_dialogue_context,
    make_dialogue_context_no_match,
)


# Canonical forbidden-key set per D-18 — Brain-side privacy gate.
FORBIDDEN_METADATA_KEYS = frozenset(
    {
        "new_goals",
        "goals",
        "telos_yaml",
        "prompt",
        "response",
        "wiki",
        "reflection",
        "thought",
        "emotion_delta",
    }
)

EXPECTED_METADATA_KEYS = frozenset(
    {"before_goal_hash", "after_goal_hash", "triggered_by_dialogue_id"}
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
    """Build a BrainHandler with controllable Telos for tests."""
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


class TestTelosRefinedActionContract:
    async def test_happy_path_returns_telos_refined_with_closed_tuple(self):
        # 2 goals: only "Survive the day" is mentioned → promotion changes
        # the other goal's bucket (short_term → medium_term), guaranteeing
        # a genuine canonical-hash mutation (priority/goal_type shift).
        handler = _make_handler(goal_descriptions=["Survive the day", "Make allies"])
        ctx = make_dialogue_context()

        response = await handler.on_tick(
            {"tick": 20, "epoch": 1, "dialogue_context": [ctx]}
        )

        refined = [a for a in response if a["action_type"] == "telos_refined"]
        assert len(refined) == 1, (
            f"expected exactly one telos_refined action, got {response}"
        )
        md = refined[0]["metadata"]
        assert set(md.keys()) == set(EXPECTED_METADATA_KEYS), (
            f"metadata must be the closed 3-key tuple {EXPECTED_METADATA_KEYS}, "
            f"got keys={set(md.keys())}"
        )
        # 64-hex hashes per D-14
        assert isinstance(md["before_goal_hash"], str) and len(md["before_goal_hash"]) == 64
        assert isinstance(md["after_goal_hash"], str) and len(md["after_goal_hash"]) == 64
        # 16-hex dialogue_id echoed through unchanged per D-14
        assert md["triggered_by_dialogue_id"] == ctx["dialogue_id"]
        assert refined[0]["channel"] == ""
        assert refined[0]["text"] == ""

    async def test_no_forbidden_plaintext_keys_in_metadata(self):
        """D-18 Brain-side privacy gate — plaintext never crosses the boundary."""
        handler = _make_handler(goal_descriptions=["Survive the day", "Make allies"])
        ctx = make_dialogue_context()
        response = await handler.on_tick(
            {"tick": 20, "epoch": 1, "dialogue_context": [ctx]}
        )
        refined = [a for a in response if a["action_type"] == "telos_refined"]
        assert len(refined) == 1
        md = refined[0]["metadata"]
        leaked = FORBIDDEN_METADATA_KEYS & set(md.keys())
        assert not leaked, f"Brain leaked plaintext keys across boundary: {leaked}"

    async def test_no_op_refinement_returns_no_action(self):
        """D-22 silent-no-op: dialogue mentioning no active goal emits nothing."""
        handler = _make_handler(goal_descriptions=["Survive the day"])
        ctx = make_dialogue_context_no_match()
        response = await handler.on_tick(
            {"tick": 20, "epoch": 1, "dialogue_context": [ctx]}
        )
        refined = [a for a in response if a["action_type"] == "telos_refined"]
        assert refined == [], (
            "expected no telos_refined action for non-matching dialogue"
        )

    @pytest.mark.parametrize(
        "bad_dialogue_id",
        ["", "abc", "A" * 17, 12345, None],
    )
    async def test_malformed_dialogue_id_drops_silently(self, bad_dialogue_id):
        """D-16 mirror on Brain side: malformed dialogue_id → drop, no action."""
        handler = _make_handler(goal_descriptions=["Survive the day", "Make allies"])
        ctx = make_dialogue_context()
        ctx["dialogue_id"] = bad_dialogue_id  # bypass keyword 16-hex default
        response = await handler.on_tick(
            {"tick": 20, "epoch": 1, "dialogue_context": [ctx]}
        )
        refined = [a for a in response if a["action_type"] == "telos_refined"]
        assert refined == [], (
            f"expected drop for bad dialogue_id={bad_dialogue_id!r}"
        )

    async def test_hashes_computed_before_and_after_mutation(self):
        """D-14: compute_active_telos_hash is SOLE authority, called BEFORE
        then AFTER self.telos swap. Assert the two hashes differ when
        refinement genuinely changes the canonical goal set."""
        handler = _make_handler(
            goal_descriptions=["Survive the day", "Make allies"]
        )
        ctx = make_dialogue_context()  # only matches "Survive the day"
        pre_hash = compute_active_telos_hash(handler.telos.all_goals())

        response = await handler.on_tick(
            {"tick": 20, "epoch": 1, "dialogue_context": [ctx]}
        )

        refined = [a for a in response if a["action_type"] == "telos_refined"]
        assert len(refined) == 1
        md = refined[0]["metadata"]
        assert md["before_goal_hash"] == pre_hash, (
            "before_goal_hash must match pre-call canonical hash"
        )
        post_hash = compute_active_telos_hash(handler.telos.all_goals())
        assert md["after_goal_hash"] == post_hash, (
            "after_goal_hash must match post-mutation canonical hash"
        )
        assert md["before_goal_hash"] != md["after_goal_hash"], (
            "refinement was supposed to change the canonical goal set — "
            "if these are equal, the heuristic produced a no-op and the "
            "action should not have been emitted."
        )

    async def test_action_type_enum_value_on_wire(self):
        """D-13: ActionType.TELOS_REFINED serialises to 'telos_refined'."""
        assert ActionType.TELOS_REFINED.value == "telos_refined"
        # Existing enum members preserved (additive widening).
        assert ActionType.SPEAK.value == "speak"
        assert ActionType.DIRECT_MESSAGE.value == "direct_message"
        assert ActionType.MOVE.value == "move"
        assert ActionType.TRADE_REQUEST.value == "trade_request"
        assert ActionType.NOOP.value == "noop"

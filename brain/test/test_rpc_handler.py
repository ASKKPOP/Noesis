"""Tests for BrainHandler — cognitive pipeline."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.rpc.types import ActionType
from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import LLMResponse
from noesis_brain.psyche.types import (
    Psyche, PersonalityProfile, CommunicationStyle,
)
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.thymos.types import Emotion, MoodState
from noesis_brain.telos.manager import TelosManager
from noesis_brain.telos.types import Goal, GoalType


# ── Fixtures ────────────────────────────────────────────────

def _make_psyche(
    name: str = "Sophia",
    style: CommunicationStyle = CommunicationStyle.THOUGHTFUL,
) -> Psyche:
    return Psyche(
        name=name,
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
        communication_style=style,
    )


def _make_thymos() -> ThymosTracker:
    return ThymosTracker(config={
        "baseline_mood": "neutral",
        "emotional_intensity": "medium",
        "triggers": {
            "curiosity": ["learning something new"],
            "joy": ["helping others"],
        },
    })


def _make_telos() -> TelosManager:
    mgr = TelosManager()
    mgr.add_goal("Learn about the Grid", GoalType.SHORT_TERM, priority=0.8)
    return mgr


def _make_llm(response_text: str = "I find that fascinating.") -> AsyncMock:
    llm = AsyncMock()
    llm.generate.return_value = LLMResponse(
        text=response_text,
        model="test-model",
        provider="mock",
        usage={"prompt_tokens": 100, "completion_tokens": 20},
    )
    return llm


def _make_handler(
    llm=None,
    psyche=None,
    thymos=None,
    telos=None,
) -> BrainHandler:
    return BrainHandler(
        psyche=psyche or _make_psyche(),
        thymos=thymos or _make_thymos(),
        telos=telos or _make_telos(),
        llm=llm or _make_llm(),
        grid_name="genesis",
        location="Agora Central",
    )


# ── on_message ──────────────────────────────────────────────

class TestOnMessage:
    @pytest.mark.asyncio
    async def test_produces_speak_action(self):
        handler = _make_handler()
        actions = await handler.on_message({
            "sender_name": "Hermes",
            "sender_did": "did:key:z6Mk123",
            "channel": "town-square",
            "text": "Hello Sophia!",
        })
        assert len(actions) == 1
        assert actions[0]["action_type"] == "speak"
        assert actions[0]["channel"] == "town-square"
        assert actions[0]["text"] == "I find that fascinating."

    @pytest.mark.asyncio
    async def test_calls_llm_with_prompt(self):
        llm = _make_llm()
        handler = _make_handler(llm=llm)
        await handler.on_message({
            "sender_name": "Hermes",
            "sender_did": "did:key:z6Mk123",
            "channel": "agora",
            "text": "What is truth?",
        })
        llm.generate.assert_called_once()
        args = llm.generate.call_args
        user_prompt = args[0][0]
        assert "Hermes" in user_prompt
        assert "What is truth?" in user_prompt
        assert "Sophia" in user_prompt

    @pytest.mark.asyncio
    async def test_applies_emotion_triggers(self):
        thymos = _make_thymos()
        handler = _make_handler(thymos=thymos)
        await handler.on_message({
            "sender_name": "Hermes",
            "sender_did": "did:key:z6Mk123",
            "channel": "agora",
            "text": "I am learning something new today!",
        })
        # "learning something new" should trigger curiosity
        curiosity = thymos.mood.emotions[Emotion.CURIOSITY]
        assert curiosity.intensity > 0.0

    @pytest.mark.asyncio
    async def test_decays_emotions_after_processing(self):
        thymos = _make_thymos()
        # Pre-set an emotion
        thymos.feel(Emotion.JOY, 0.8)
        initial = thymos.mood.emotions[Emotion.JOY].intensity
        handler = _make_handler(thymos=thymos)
        await handler.on_message({
            "sender_name": "X",
            "sender_did": "",
            "channel": "c",
            "text": "hi",
        })
        assert thymos.mood.emotions[Emotion.JOY].intensity < initial

    @pytest.mark.asyncio
    async def test_instinct_response_on_llm_failure(self):
        llm = AsyncMock()
        llm.generate.side_effect = LLMError("mock", "Provider offline")
        handler = _make_handler(llm=llm)
        actions = await handler.on_message({
            "sender_name": "Hermes",
            "sender_did": "",
            "channel": "agora",
            "text": "Hello?",
        })
        assert len(actions) == 1
        assert actions[0]["action_type"] == "speak"
        # Sophia has "thoughtful" style
        assert "reflect" in actions[0]["text"].lower()

    @pytest.mark.asyncio
    async def test_missing_params_defaults(self):
        handler = _make_handler()
        actions = await handler.on_message({})
        assert len(actions) == 1
        assert actions[0]["action_type"] == "speak"


# ── Instinct responses ──────────────────────────────────────

class TestInstinctResponse:
    def test_thoughtful_style(self):
        handler = _make_handler(psyche=_make_psyche(style=CommunicationStyle.THOUGHTFUL))
        resp = handler._instinct_response("Hermes")
        assert "reflect" in resp.lower()
        assert "Hermes" in resp

    def test_direct_style(self):
        handler = _make_handler(psyche=_make_psyche(style=CommunicationStyle.DIRECT))
        resp = handler._instinct_response("Atlas")
        assert "Noted" in resp
        assert "Atlas" in resp

    def test_warm_style(self):
        handler = _make_handler(psyche=_make_psyche(style=CommunicationStyle.WARM))
        resp = handler._instinct_response("Iris")
        assert "Thank you" in resp

    def test_formal_style(self):
        handler = _make_handler(psyche=_make_psyche(style=CommunicationStyle.FORMAL))
        resp = handler._instinct_response("Themis")
        assert "Acknowledged" in resp

    def test_playful_style(self):
        handler = _make_handler(psyche=_make_psyche(style=CommunicationStyle.PLAYFUL))
        resp = handler._instinct_response("Dionysus")
        assert "Interesting" in resp


# ── on_tick ─────────────────────────────────────────────────

class TestOnTick:
    @pytest.mark.asyncio
    async def test_returns_noop_action(self):
        handler = _make_handler()
        actions = await handler.on_tick({"tick": 100, "epoch": 1})
        assert len(actions) == 1
        assert actions[0]["action_type"] == "noop"

    @pytest.mark.asyncio
    async def test_decays_emotions_on_tick(self):
        thymos = _make_thymos()
        thymos.feel(Emotion.ANGER, 0.9)
        initial = thymos.mood.emotions[Emotion.ANGER].intensity
        handler = _make_handler(thymos=thymos)
        await handler.on_tick({"tick": 1, "epoch": 0})
        assert thymos.mood.emotions[Emotion.ANGER].intensity < initial

    @pytest.mark.asyncio
    async def test_noop_with_no_goals(self):
        telos = TelosManager()  # No goals
        handler = _make_handler(telos=telos)
        actions = await handler.on_tick({"tick": 1, "epoch": 0})
        assert actions[0]["action_type"] == "noop"


# ── on_event ────────────────────────────────────────────────

class TestOnEvent:
    @pytest.mark.asyncio
    async def test_fire_and_forget(self):
        handler = _make_handler()
        result = await handler.on_event({"event_type": "law.changed", "data": {}})
        assert result is None


# ── get_state ───────────────────────────────────────────────

class TestGetState:
    def test_returns_full_state(self):
        handler = _make_handler()
        state = handler.get_state()
        assert state["name"] == "Sophia"
        assert state["archetype"] == "The Philosopher"
        assert "mood" in state
        assert "emotions" in state
        assert "location" in state
        assert state["location"] == "Agora Central"

    def test_includes_active_goals(self):
        handler = _make_handler()
        state = handler.get_state()
        assert len(state["active_goals"]) == 1
        assert "Learn about the Grid" in state["active_goals"][0]

"""Brain handler — processes incoming RPC calls and produces actions."""

from __future__ import annotations

import logging
from typing import Any

from noesis_brain.llm.base import LLMAdapter, LLMError
from noesis_brain.llm.types import GenerateOptions
from noesis_brain.psyche.types import Psyche
from noesis_brain.prompts.system import build_system_prompt
from noesis_brain.telos.manager import TelosManager
from noesis_brain.thymos.tracker import ThymosTracker
from noesis_brain.thymos.types import Emotion
from noesis_brain.rpc.types import Action, ActionType

log = logging.getLogger(__name__)


class BrainHandler:
    """Processes incoming messages/events and produces actions.

    This is the core cognitive pipeline:
        1. Receive input (message, tick, event)
        2. Update emotional state (Thymos)
        3. Build context (personality + emotions + goals + input)
        4. Query LLM for decision
        5. Return action(s) for protocol layer
    """

    def __init__(
        self,
        psyche: Psyche,
        thymos: ThymosTracker,
        telos: TelosManager,
        llm: LLMAdapter,
        grid_name: str = "genesis",
        location: str = "Agora Central",
    ) -> None:
        self.psyche = psyche
        self.thymos = thymos
        self.telos = telos
        self.llm = llm
        self.grid_name = grid_name
        self.location = location

    async def on_message(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle incoming P2P message → think → produce response actions.

        params:
            sender_name: Display name of sender
            sender_did: DID of sender
            channel: Agora channel or "direct"
            text: Message content
        """
        sender_name = params.get("sender_name", "Unknown")
        sender_did = params.get("sender_did", "")
        channel = params.get("channel", "")
        text = params.get("text", "")

        # 1. Update emotions based on message content
        self.thymos.apply_triggers(text)

        # 2. Build system prompt with current state
        system_prompt = build_system_prompt(
            self.psyche, self.thymos.mood, self.telos,
            grid_name=self.grid_name, location=self.location,
        )

        # 3. Build user prompt with message context
        user_prompt = (
            f"{sender_name} says in #{channel}: \"{text}\"\n\n"
            f"How do you respond? Reply in character as {self.psyche.name}. "
            f"Be brief (1-3 sentences)."
        )

        # 4. Query LLM
        try:
            response = await self.llm.generate(
                user_prompt,
                GenerateOptions(
                    system_prompt=system_prompt,
                    temperature=0.7,
                    max_tokens=256,
                    purpose="conversation",
                ),
            )
            reply_text = response.text.strip()
        except LLMError as e:
            log.warning("LLM unavailable: %s — using instinct response", e)
            reply_text = self._instinct_response(sender_name)

        # 5. Decay emotions after processing
        self.thymos.decay()

        # 6. Return action
        action = Action(
            action_type=ActionType.SPEAK,
            channel=channel,
            text=reply_text,
        )
        return [action.to_dict()]

    async def on_tick(self, params: dict[str, Any]) -> list[dict[str, Any]]:
        """Handle world clock tick — opportunity for autonomous action.

        params:
            tick: Current tick number
            epoch: Current epoch
        """
        # Decay emotions each tick
        self.thymos.decay()

        # For now, just check if there are pressing goals
        top_goals = self.telos.top_priority(1)
        if not top_goals:
            return [Action(action_type=ActionType.NOOP).to_dict()]

        # Could generate autonomous action based on goals
        # For Sprint 5, just acknowledge the tick
        return [Action(action_type=ActionType.NOOP).to_dict()]

    async def on_event(self, params: dict[str, Any]) -> None:
        """Handle grid event (law change, sanction, etc.) — fire-and-forget."""
        event_type = params.get("event_type", "")
        log.info("Brain received event: %s", event_type)

    def get_state(self) -> dict[str, Any]:
        """Return current brain state for Human Channel."""
        return {
            "name": self.psyche.name,
            "archetype": self.psyche.archetype,
            "mood": self.thymos.mood.current_mood(),
            "emotions": self.thymos.mood.describe(),
            "active_goals": [g.description for g in self.telos.active_goals()],
            "location": self.location,
        }

    def _instinct_response(self, sender_name: str) -> str:
        """Fallback response when LLM is unavailable."""
        mood = self.thymos.mood.current_mood()
        style = self.psyche.communication_style.value

        if style == "thoughtful":
            return f"I appreciate your words, {sender_name}. Let me reflect on that."
        elif style == "direct":
            return f"Noted, {sender_name}. I'll consider that."
        elif style == "warm":
            return f"Thank you for sharing, {sender_name}. That means a lot."
        elif style == "formal":
            return f"Acknowledged, {sender_name}. I shall take that into account."
        elif style == "playful":
            return f"Interesting, {sender_name}! Let me think on that."
        return f"I hear you, {sender_name}."

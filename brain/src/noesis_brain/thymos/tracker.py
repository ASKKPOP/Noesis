"""Thymos tracker — manages emotional state over time."""

from __future__ import annotations

from typing import Any

from noesis_brain.thymos.types import Emotion, EmotionState, MoodState

# Intensity multiplier based on emotional_intensity config
INTENSITY_MULTIPLIER: dict[str, float] = {
    "low": 0.5,
    "medium": 1.0,
    "high": 1.5,
}

# Default decay rate per cycle
DECAY_RATE = 0.05


class ThymosTracker:
    """Tracks and updates the emotional state of a Nous."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        config = config or {}
        self.mood = MoodState(
            baseline_mood=config.get("baseline_mood", "neutral"),
            emotional_intensity=config.get("emotional_intensity", "medium"),
        )
        self._triggers: dict[str, list[str]] = config.get("triggers", {})
        self._multiplier = INTENSITY_MULTIPLIER.get(
            self.mood.emotional_intensity, 1.0
        )

    def feel(self, emotion: Emotion, intensity: float, trigger: str = "") -> None:
        """Apply an emotion with given intensity.

        Intensity is scaled by the Nous's emotional_intensity setting.
        """
        scaled = intensity * self._multiplier
        state = self.mood.emotions[emotion]
        state.intensity = min(1.0, state.intensity + scaled)
        if trigger:
            state.trigger = trigger
        state.clamp()

    def decay(self) -> None:
        """Decay all emotions toward zero (called each cycle)."""
        for state in self.mood.emotions.values():
            state.intensity = max(0.0, state.intensity - DECAY_RATE)

    def check_triggers(self, text: str) -> list[tuple[Emotion, str]]:
        """Check if text matches any configured emotion triggers.

        Returns list of (Emotion, matched_trigger) pairs.
        """
        matches = []
        text_lower = text.lower()
        for emotion_name, trigger_list in self._triggers.items():
            try:
                emotion = Emotion(emotion_name)
            except ValueError:
                continue
            for trigger in trigger_list:
                if trigger.lower() in text_lower:
                    matches.append((emotion, trigger))
        return matches

    def apply_triggers(self, text: str, base_intensity: float = 0.4) -> list[tuple[Emotion, str]]:
        """Check triggers and apply matching emotions.

        Returns list of triggered (Emotion, trigger_text) pairs.
        """
        matches = self.check_triggers(text)
        for emotion, trigger in matches:
            self.feel(emotion, base_intensity, trigger)
        return matches

    def reset(self) -> None:
        """Reset all emotions to zero."""
        for state in self.mood.emotions.values():
            state.intensity = 0.0
            state.trigger = ""

    @classmethod
    def from_yaml(cls, data: dict[str, Any]) -> ThymosTracker:
        """Create from the thymos section of a Nous YAML."""
        return cls(config=data)

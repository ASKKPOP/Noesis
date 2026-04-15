"""Thymos types — emotions, mood, and emotional state."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Emotion(str, Enum):
    """Six core emotions."""

    JOY = "joy"
    SADNESS = "sadness"
    ANGER = "anger"
    FEAR = "fear"
    TRUST = "trust"
    CURIOSITY = "curiosity"


@dataclass
class EmotionState:
    """Current intensity of a single emotion."""

    emotion: Emotion
    intensity: float = 0.0  # 0.0 to 1.0
    trigger: str = ""  # What caused this emotion

    def clamp(self) -> None:
        self.intensity = max(0.0, min(1.0, self.intensity))


@dataclass
class MoodState:
    """Complete emotional state of a Nous."""

    emotions: dict[Emotion, EmotionState] = field(default_factory=dict)
    baseline_mood: str = "neutral"
    emotional_intensity: str = "medium"  # low/medium/high — how strongly felt

    def __post_init__(self) -> None:
        # Ensure all emotions exist
        for e in Emotion:
            if e not in self.emotions:
                self.emotions[e] = EmotionState(emotion=e)

    def dominant_emotion(self) -> EmotionState:
        """Return the emotion with the highest intensity."""
        return max(self.emotions.values(), key=lambda s: s.intensity)

    def current_mood(self) -> str:
        """Derive current mood from dominant emotion."""
        dom = self.dominant_emotion()
        if dom.intensity < 0.2:
            return self.baseline_mood
        return dom.emotion.value

    def active_emotions(self, threshold: float = 0.3) -> list[EmotionState]:
        """Return emotions above a threshold intensity."""
        return [s for s in self.emotions.values() if s.intensity >= threshold]

    def describe(self) -> str:
        """Natural-language description for prompts."""
        mood = self.current_mood()
        active = self.active_emotions()
        if not active:
            return f"Mood: {mood} (calm, no strong emotions)"
        parts = [f"{s.emotion.value}({s.intensity:.1f})" for s in active]
        return f"Mood: {mood}. Active emotions: {', '.join(parts)}"

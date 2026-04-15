"""Psyche types — personality dimensions, values, and identity."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class PersonalityDimension(str, Enum):
    """Six personality dimensions (inspired by Big Five + ambition/resilience)."""

    OPENNESS = "openness"
    CONSCIENTIOUSNESS = "conscientiousness"
    EXTRAVERSION = "extraversion"
    AGREEABLENESS = "agreeableness"
    RESILIENCE = "resilience"
    AMBITION = "ambition"


class CommunicationStyle(str, Enum):
    THOUGHTFUL = "thoughtful"
    DIRECT = "direct"
    WARM = "warm"
    FORMAL = "formal"
    PLAYFUL = "playful"


# Map low/medium/high to numeric for prompt generation
LEVEL_MAP: dict[str, float] = {
    "low": 0.2,
    "medium": 0.5,
    "high": 0.8,
}

LEVEL_DESCRIPTIONS: dict[str, dict[str, str]] = {
    "openness": {
        "low": "conventional and practical, prefers familiar approaches",
        "medium": "balanced between tradition and exploration",
        "high": "curious, creative, and eager to explore new ideas",
    },
    "conscientiousness": {
        "low": "spontaneous and flexible, adapts on the fly",
        "medium": "balanced between planning and spontaneity",
        "high": "methodical, organized, and detail-oriented",
    },
    "extraversion": {
        "low": "reserved and introspective, prefers solitude",
        "medium": "comfortable alone and in groups",
        "high": "outgoing, energetic, and socially driven",
    },
    "agreeableness": {
        "low": "competitive and skeptical, challenges others readily",
        "medium": "balanced between cooperation and self-interest",
        "high": "cooperative, empathetic, and trusting",
    },
    "resilience": {
        "low": "sensitive to setbacks, takes failures hard",
        "medium": "recovers from setbacks with moderate effort",
        "high": "bounces back quickly, sees obstacles as challenges",
    },
    "ambition": {
        "low": "content with the present, not driven by achievement",
        "medium": "motivated but not consumed by goals",
        "high": "strongly driven to achieve, always striving for more",
    },
}


@dataclass
class PersonalityProfile:
    """Six-dimension personality profile."""

    openness: str = "medium"  # low/medium/high
    conscientiousness: str = "medium"
    extraversion: str = "medium"
    agreeableness: str = "medium"
    resilience: str = "medium"
    ambition: str = "medium"

    def get_level(self, dimension: PersonalityDimension) -> str:
        return getattr(self, dimension.value)

    def get_numeric(self, dimension: PersonalityDimension) -> float:
        return LEVEL_MAP.get(self.get_level(dimension), 0.5)

    def get_description(self, dimension: PersonalityDimension) -> str:
        level = self.get_level(dimension)
        return LEVEL_DESCRIPTIONS.get(dimension.value, {}).get(level, "")

    @classmethod
    def from_yaml(cls, data: dict[str, str]) -> PersonalityProfile:
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Psyche:
    """Complete psyche: identity + personality + values."""

    name: str
    archetype: str
    personality: PersonalityProfile
    values: list[str] = field(default_factory=list)
    communication_style: CommunicationStyle = CommunicationStyle.THOUGHTFUL
    birth_date: str = ""

    def describe_personality(self) -> str:
        """Generate a natural-language personality description for prompts."""
        lines = []
        for dim in PersonalityDimension:
            level = self.personality.get_level(dim)
            desc = self.personality.get_description(dim)
            lines.append(f"- {dim.value.capitalize()}: {level} — {desc}")
        return "\n".join(lines)

    def describe_values(self) -> str:
        if not self.values:
            return "No core values defined."
        return ", ".join(self.values)

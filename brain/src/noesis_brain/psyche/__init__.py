"""Psyche — Identity and personality system."""

from noesis_brain.psyche.types import (
    PersonalityDimension,
    PersonalityProfile,
    CommunicationStyle,
    Psyche,
)
from noesis_brain.psyche.loader import load_psyche

__all__ = [
    "PersonalityDimension",
    "PersonalityProfile",
    "CommunicationStyle",
    "Psyche",
    "load_psyche",
]

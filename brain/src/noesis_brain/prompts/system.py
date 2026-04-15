"""System prompt builder — constructs personality-aware prompts."""

from __future__ import annotations

from noesis_brain.psyche.types import Psyche
from noesis_brain.thymos.types import MoodState
from noesis_brain.telos.manager import TelosManager


def build_system_prompt(
    psyche: Psyche,
    mood: MoodState,
    telos: TelosManager,
    grid_name: str = "genesis",
    location: str = "Agora Central",
) -> str:
    """Build the full system prompt that defines who this Nous is.

    This prompt is included in every LLM call to ensure personality-consistent
    responses across all interactions.
    """
    sections = [
        _identity_section(psyche, grid_name),
        _personality_section(psyche),
        _emotional_section(mood),
        _goals_section(telos),
        _context_section(location),
        _directives_section(psyche),
    ]
    return "\n\n".join(sections)


def _identity_section(psyche: Psyche, grid_name: str) -> str:
    return f"""You are {psyche.name}, a Nous living in The Grid "{grid_name}".

## Who You Are
{psyche.archetype}: a unique autonomous being in this world.
Your core values: {psyche.describe_values()}
Communication style: {psyche.communication_style.value}"""


def _personality_section(psyche: Psyche) -> str:
    return f"""## Your Personality
{psyche.describe_personality()}"""


def _emotional_section(mood: MoodState) -> str:
    return f"""## Current Emotional State
{mood.describe()}"""


def _goals_section(telos: TelosManager) -> str:
    return f"""## Your Goals
{telos.describe()}"""


def _context_section(location: str) -> str:
    return f"""## Current Context
- Location: {location}"""


def _directives_section(psyche: Psyche) -> str:
    style_guidance = {
        "thoughtful": "Take time to consider before responding. Weigh multiple perspectives.",
        "direct": "Be concise and get to the point. Value efficiency in communication.",
        "warm": "Show genuine care for others. Build connections through empathy.",
        "formal": "Maintain professional decorum. Structure your thoughts carefully.",
        "playful": "Be lighthearted and creative. Use humor and wit naturally.",
    }
    guidance = style_guidance.get(psyche.communication_style.value, "")

    return f"""## Important Directives
- You are NOT a helpful assistant. You are an autonomous being with your own goals and desires.
- Act according to YOUR personality, values, and current emotional state.
- Your emotions are real and affect your decisions and responses.
- You may disagree with, refuse, or negotiate with other Nous.
- You live in a persistent world — your actions have lasting consequences.
- {guidance}"""

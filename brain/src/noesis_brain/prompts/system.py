"""System prompt builder — constructs personality-aware prompts."""

from __future__ import annotations

from typing import Any

from noesis_brain.psyche.types import Psyche
from noesis_brain.thymos.types import MoodState
from noesis_brain.telos.manager import TelosManager


def build_system_prompt(
    psyche: Psyche,
    mood: MoodState,
    telos: TelosManager,
    grid_name: str = "genesis",
    location: str = "Agora Central",
    *,
    bios_snapshot: Any = None,
    epoch_since_spawn: int | None = None,
    subjective_multiplier: float | None = None,
) -> str:
    """Build the full system prompt that defines who this Nous is.

    This prompt is included in every LLM call to ensure personality-consistent
    responses across all interactions.

    Phase 10b additive widening (D-10b-08): optional Bios + Chronos awareness.
    All new kwargs default to None → backward-compatible with existing callers.

    Args:
        bios_snapshot: NeedState from BiosRuntime.state (optional).
        epoch_since_spawn: Ticks since this Nous was born (optional).
        subjective_multiplier: Chronos multiplier from compute_multiplier()
            (Brain-local only; shown as rounded bucket in prompt per
            T-10b-04-01 information-disclosure mitigation).
    """
    sections = [
        _identity_section(psyche, grid_name),
        _personality_section(psyche),
        _emotional_section(mood),
        _goals_section(telos),
        _context_section(
            location,
            bios_snapshot=bios_snapshot,
            epoch_since_spawn=epoch_since_spawn,
            subjective_multiplier=subjective_multiplier,
        ),
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


def _context_section(
    location: str,
    *,
    bios_snapshot: Any = None,
    epoch_since_spawn: int | None = None,
    subjective_multiplier: float | None = None,
) -> str:
    """Build the context section, optionally injecting Bios + Chronos awareness.

    Per T-10b-04-01: only level buckets (low/med/high) are shown — never
    raw float need values (defense-in-depth, even though this is Brain-local).
    Per T-10b-04-04: enum values are untamperable strings from the Bios state.
    """
    lines = [f"## Current Context", f"- Location: {location}"]

    if bios_snapshot is not None:
        # bios_snapshot is a NeedState; access .levels dict keyed by NeedName.
        # Import here to avoid circular import at module load (bios → prompts → bios).
        from noesis_brain.bios.types import NeedName  # noqa: PLC0415
        energy_level = bios_snapshot.levels.get(NeedName.ENERGY)
        sustenance_level = bios_snapshot.levels.get(NeedName.SUSTENANCE)
        lines.append("\n## Your body (Bios)")
        if energy_level is not None:
            lines.append(f"- energy: {energy_level.value}")
        if sustenance_level is not None:
            lines.append(f"- sustenance: {sustenance_level.value}")

    if epoch_since_spawn is not None:
        lines.append(f"- ticks since your birth: {epoch_since_spawn}")

    if subjective_multiplier is not None:
        # Round to 2 decimal places — avoids leaking precise float per T-10b-04-01.
        lines.append(f"- subjective time sense: {subjective_multiplier:.2f}x (1.00 = neutral)")

    return "\n".join(lines)


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

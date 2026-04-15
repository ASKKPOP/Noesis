"""Load Psyche from Nous YAML configuration."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from noesis_brain.psyche.types import CommunicationStyle, PersonalityProfile, Psyche


def load_psyche(config_path: str | Path | None = None, data: dict[str, Any] | None = None) -> Psyche:
    """Load a Psyche from a YAML file or a pre-parsed dict.

    Args:
        config_path: Path to Nous YAML config file.
        data: Pre-parsed YAML dict (alternative to file path).

    Returns:
        Fully constructed Psyche.
    """
    if data is None:
        if config_path is None:
            raise ValueError("Either config_path or data must be provided")
        with open(config_path) as f:
            data = yaml.safe_load(f)

    identity = data.get("identity", {})
    psyche_data = data.get("psyche", {})

    personality = PersonalityProfile.from_yaml(psyche_data.get("personality", {}))

    style_str = psyche_data.get("communication_style", "thoughtful")
    try:
        style = CommunicationStyle(style_str)
    except ValueError:
        style = CommunicationStyle.THOUGHTFUL

    return Psyche(
        name=identity.get("name", "Unknown"),
        archetype=identity.get("archetype", ""),
        personality=personality,
        values=psyche_data.get("values", []),
        communication_style=style,
        birth_date=identity.get("birth_date", ""),
    )

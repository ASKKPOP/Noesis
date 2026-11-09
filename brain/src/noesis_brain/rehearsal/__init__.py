"""Rehearsal — practise a candidate Skill in many randomized worlds in parallel,
refereed by the Grid's real law; keep it only if it holds everywhere."""

from noesis_brain.rehearsal.engine import (
    Episode,
    EpisodeOutcome,
    RehearsalReport,
    rehearse,
)
from noesis_brain.rehearsal.physics import PhysicsEpisodeRunner, make_physics_episodes

__all__ = [
    "Episode",
    "EpisodeOutcome",
    "RehearsalReport",
    "rehearse",
    "PhysicsEpisodeRunner",
    "make_physics_episodes",
]

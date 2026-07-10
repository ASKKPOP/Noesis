"""Synopsis — in-world research synthesis faculty (background)."""

from noesis_brain.synopsis.types import SourceNote, Synopsis
from noesis_brain.synopsis.synthesizer import MAX_POINTS, MIN_POINT_LEN, Synthesizer
from noesis_brain.synopsis.store import SynopsisStore

__all__ = [
    "SourceNote",
    "Synopsis",
    "Synthesizer",
    "SynopsisStore",
    "MAX_POINTS",
    "MIN_POINT_LEN",
]

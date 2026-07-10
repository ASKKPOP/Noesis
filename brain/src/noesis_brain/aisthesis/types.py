"""Aisthesis types — percepts of in-world change.

Closed-enum discipline (cf. ananke/types.py): adding a PerceptKind requires an
explicit phase — perception vocabulary is not widened casually.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class PerceptKind(str, Enum):
    """How a perceived subject changed between two world snapshots."""

    APPEARED = "appeared"
    VANISHED = "vanished"
    CHANGED = "changed"


@dataclass(frozen=True)
class Percept:
    """A single salient change the Nous perceived in its surroundings.

    `subject` is a stable key (e.g. ``object:42`` / ``parcel:7``) so the same
    thing perceived across ticks keeps one identity. `salience` (0..1) ranks how
    much the change draws attention.
    """

    kind: PerceptKind
    subject: str
    label: str
    zone: str
    salience: float

    def describe(self) -> str:
        """Natural-language phrase for memory / prompt injection."""
        where = f" in {self.zone}" if self.zone else ""
        return f"{self.label}{where} {self.kind.value}"

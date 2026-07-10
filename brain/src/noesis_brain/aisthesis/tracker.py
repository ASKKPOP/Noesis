"""Aisthesis tracker — in-world perception.

Formalizes ambient world-sight (the parcels + built objects the Nous already
shares with users) into a perception faculty: it holds a keyed model of the
surroundings, diffs successive snapshots, and yields `Percept`s for *salient
change* ("a foundry appeared in the Manufacture zone"). Perception is the input
edge of the cognitive loop — its output feeds memory and can raise curiosity.

Deterministic and pure given inputs: no wall-clock, no randomness, stable
ordering. Brain-local — emits no Grid events.
"""

from __future__ import annotations

from typing import Any

from noesis_brain.aisthesis.types import Percept, PerceptKind

# Salience per kind — appearance/disappearance draws more attention than a
# mutation of something already known.
SALIENCE: dict[PerceptKind, float] = {
    PerceptKind.APPEARED: 0.6,
    PerceptKind.VANISHED: 0.6,
    PerceptKind.CHANGED: 0.4,
}

# Bound the number of percepts surfaced from one perception (a large world
# reshuffle should not flood memory or the prompt).
MAX_PERCEPTS = 12

# Percepts at/above this salience are worth committing to episodic memory.
MEMORY_THRESHOLD = 0.5


class AisthesisTracker:
    """Tracks the Nous's perception of its surroundings over time."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        config = config or {}
        self._salience_floor = float(config.get("salience_floor", 0.0))
        # key -> signature (comparable string); None until the first perception.
        self._model: dict[str, str] | None = None
        # key -> (label, zone), retained so a VANISHED subject can still be named.
        self._labels: dict[str, tuple[str, str]] = {}
        # Latest salient percepts (most recent perception).
        self.percepts: list[Percept] = []

    def perceive(self, world_sight: dict[str, Any] | None) -> list[Percept]:
        """Diff the latest world-sight against the last, returning salient change.

        The first perception establishes a baseline and returns no percepts (a
        Nous does not "notice" the world it wakes into as change). `world_sight`
        is the cached ``{"parcels": [...], "objects": [...]}`` feed; None/empty
        yields nothing.
        """
        if not world_sight:
            return []
        model, labels = self._flatten(world_sight)
        if self._model is None:
            self._model = model
            self._labels = labels
            self.percepts = []
            return self.percepts
        percepts = self._diff(self._model, model, labels)
        self._model = model
        # Merge new labels over retained ones so vanished subjects keep a name.
        self._labels = {**self._labels, **labels}
        self.percepts = percepts
        return percepts

    def salient(self, threshold: float) -> list[Percept]:
        """Latest percepts at/above a salience threshold."""
        return [p for p in self.percepts if p.salience >= threshold]

    def describe(self, max_percepts: int = 5) -> str:
        """Natural-language description of what was just perceived (for prompts)."""
        if not self.percepts:
            return "Nothing new in the surroundings."
        top = sorted(self.percepts, key=lambda p: p.salience, reverse=True)[:max_percepts]
        return "I notice: " + "; ".join(p.describe() for p in top) + "."

    def snapshot(self) -> dict[str, Any]:
        """Dashboard/get_state snapshot of the latest perception."""
        return {
            "percept_count": len(self.percepts),
            "percepts": [
                {
                    "kind": p.kind.value,
                    "subject": p.subject,
                    "label": p.label,
                    "zone": p.zone,
                    "salience": p.salience,
                }
                for p in self.percepts[:MAX_PERCEPTS]
            ],
            "world_size": len(self._model or {}),
        }

    # -- internals -----------------------------------------------------------

    def _flatten(
        self, world_sight: dict[str, Any]
    ) -> tuple[dict[str, str], dict[str, tuple[str, str]]]:
        """Flatten parcels + objects into (key -> signature, key -> (label, zone)).

        Defensive against missing keys — the Grid feed shape is not guaranteed.
        """
        model: dict[str, str] = {}
        labels: dict[str, tuple[str, str]] = {}

        for i, obj in enumerate(world_sight.get("objects", []) or []):
            if not isinstance(obj, dict):
                continue
            oid = obj.get("id", obj.get("object_id", i))
            key = f"object:{oid}"
            kind = str(obj.get("kind", obj.get("type", obj.get("name", "object"))))
            zone = str(obj.get("zone", obj.get("sector", "")))
            status = str(obj.get("status", ""))
            model[key] = f"{kind}|{status}|{zone}"
            labels[key] = (f"a {kind}", zone)

        for i, parcel in enumerate(world_sight.get("parcels", []) or []):
            if not isinstance(parcel, dict):
                continue
            pid = parcel.get("id", parcel.get("parcel_id", i))
            key = f"parcel:{pid}"
            zone = str(parcel.get("zone", ""))
            status = str(parcel.get("status", ""))
            owner = str(parcel.get("owner", ""))
            structure = str(parcel.get("structure", ""))
            model[key] = f"{status}|{owner}|{structure}"
            labels[key] = ("a parcel", zone)

        return model, labels

    def _diff(
        self,
        old: dict[str, str],
        new: dict[str, str],
        labels: dict[str, tuple[str, str]],
    ) -> list[Percept]:
        percepts: list[Percept] = []
        old_keys = set(old)
        new_keys = set(new)

        for key in sorted(new_keys - old_keys):
            label, zone = labels.get(key, ("something", ""))
            percepts.append(self._mk(PerceptKind.APPEARED, key, label, zone))
        for key in sorted(old_keys - new_keys):
            label, zone = self._labels.get(key, ("something", ""))
            percepts.append(self._mk(PerceptKind.VANISHED, key, label, zone))
        for key in sorted(old_keys & new_keys):
            if old[key] != new[key]:
                label, zone = labels.get(key, ("something", ""))
                percepts.append(self._mk(PerceptKind.CHANGED, key, label, zone))

        percepts = [p for p in percepts if p.salience >= self._salience_floor]
        # Stable order: most salient first, then by subject key.
        percepts.sort(key=lambda p: (-p.salience, p.subject))
        return percepts[:MAX_PERCEPTS]

    def _mk(self, kind: PerceptKind, key: str, label: str, zone: str) -> Percept:
        return Percept(kind=kind, subject=key, label=label, zone=zone, salience=SALIENCE[kind])

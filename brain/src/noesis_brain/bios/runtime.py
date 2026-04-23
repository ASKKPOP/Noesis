"""BiosRuntime — per-Nous bodily-needs runtime.

One `BiosRuntime` instance per DID. Steps energy + sustenance values each tick,
emits NeedCrossing events when buckets change, and on each crossing invokes
`ananke.elevate_drive(drive)` (one-bucket-up, no-op at HIGH) per D-10b-02.

Clone of ananke/runtime.py with two additions on top:
  - `ananke` ref + one-shot elevator on crossings (D-10b-02)
  - `_death_pending` flag set when any need hits 1.0 (D-10b-04)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from noesis_brain.bios.config import NEED_TO_DRIVE
from noesis_brain.bios.needs import initial_state, is_terminal, step
from noesis_brain.bios.types import NeedCrossing, NeedState

if TYPE_CHECKING:  # avoid runtime cycle; ananke is a sibling subsystem
    from noesis_brain.ananke.runtime import AnankeRuntime


@dataclass
class BiosRuntime:
    """Per-DID bios runtime.

    Attributes:
        seed: Per-Nous seed (typically SHA256(did)[:8]). Reserved for
            seed-conditioned perturbations; current math is seed-independent
            but the constructor signature is locked.
        birth_tick: The Grid tick at which this Nous was spawned. Used by
            epoch_since_spawn() to compute subjective age (CHRONOS-03).
        ananke: Optional ref to the per-DID AnankeRuntime. When set, threshold
            crossings raise the matching ananke drive one bucket (D-10b-02).
        state: Current per-DID NeedState. Defaults to baseline (energy=0.3,
            sustenance=0.3, both LOW).
        _crossings: Queue of pending NeedCrossings awaiting drain.
        _death_pending: True once any need has hit 1.0 (starvation, D-10b-04).
    """

    seed: int
    birth_tick: int = 0
    ananke: "AnankeRuntime | None" = None
    state: NeedState = field(default_factory=initial_state)
    _crossings: list[NeedCrossing] = field(default_factory=list)
    _death_pending: bool = False

    def on_tick(self, tick: int) -> None:
        """Advance the need state one tick, collect crossings, elevate ananke.

        Composition:
            1. step(state, tick) → (new_state, new_crossings)
            2. for each crossing, call self.ananke.elevate_drive(matching_drive)
               (D-10b-02 one-shot; no per-tick re-elevation since detect_crossing
               only fires when the bucket actually changes)
            3. is_terminal(state) → set _death_pending (D-10b-04)
        """
        new_state, new_crossings = step(self.state, tick)
        self.state = new_state
        if new_crossings:
            self._crossings.extend(new_crossings)
            if self.ananke is not None:
                for crossing in new_crossings:
                    drive = NEED_TO_DRIVE.get(crossing.need)
                    if drive is not None:
                        self.ananke.elevate_drive(drive)
        if is_terminal(self.state):
            self._death_pending = True

    def drain_crossings(self) -> list[NeedCrossing]:
        """Return and clear all pending NeedCrossings."""
        out = self._crossings
        self._crossings = []
        return out

    def drain_death(self) -> bool:
        """Return and clear the pending-death flag (one-shot)."""
        out = self._death_pending
        self._death_pending = False
        return out

    def epoch_since_spawn(self, current_tick: int) -> int:
        """Subjective age in ticks (CHRONOS-03 derived read; pure subtraction)."""
        return current_tick - self.birth_tick

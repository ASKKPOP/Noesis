"""AnankeRuntime — per-Nous drive runtime.

One `AnankeRuntime` instance per DID. The runtime keeps per-DID DriveState
and a queue of pending CrossingEvents. `on_tick(tick)` steps the state and
appends any crossings to the queue. `drain_crossings()` returns and clears
the queue (for the RPC handler to lift into Action metadata — Plan 10a-03).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from noesis_brain.ananke.drives import detect_crossing, initial_state, step
from noesis_brain.ananke.types import CrossingEvent, DriveState


@dataclass
class AnankeRuntime:
    """Per-DID drive runtime.

    Attributes:
        seed: Per-Nous seed. In 10a this is unused by the math but is wired
            through `step(state, seed, tick)` so downstream phases can
            introduce seed-conditioned perturbations without a signature
            change (D-10a-01).
        state: The current per-DID `DriveState`. Defaults to the baseline
            vector from `initial_state()`.
        _crossings: Queue of pending `CrossingEvent`s awaiting drain.

    Determinism contract:
        Given a fixed `seed` and a sequence of `on_tick(t)` calls with the
        same integer tick sequence, the final `state` is byte-identical
        regardless of wall-clock time between calls (T-09-03).
    """

    seed: int
    state: DriveState = field(default_factory=initial_state)
    _crossings: list[CrossingEvent] = field(default_factory=list)

    def on_tick(self, tick: int) -> None:
        """Advance the drive state by one tick and collect any crossings."""
        stepped = step(self.state, self.seed, tick)
        self.state, new_crossings = detect_crossing(stepped)
        if new_crossings:
            self._crossings.extend(new_crossings)

    def drain_crossings(self) -> list[CrossingEvent]:
        """Return and clear all pending crossings."""
        out = self._crossings
        self._crossings = []
        return out

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
        """Advance the drive state by one tick and collect any crossings.

        Composition order (important):
            1. `step(state, seed, tick)` — piecewise recurrence, unchanged levels
            2. `detect_crossing(stepped)` — re-bucket, emit level-change events

        Crossings are appended to the queue in detection order (iteration
        over `DRIVE_NAMES`), which is the canonical DRIVE_ORDER. Callers
        observe deterministic crossing order per tick.
        """
        stepped = step(self.state, self.seed, tick)
        self.state, new_crossings = detect_crossing(stepped)
        if new_crossings:
            self._crossings.extend(new_crossings)

    def drain_crossings(self) -> list[CrossingEvent]:
        """Return and clear all pending crossings.

        Semantics: the returned list is owned by the caller. A fresh empty
        list replaces the internal queue so subsequent `on_tick()` calls
        do not mutate the drained list. Call this at most once per batch
        — re-calling immediately after yields `[]`.
        """
        out = self._crossings
        self._crossings = []
        return out

    def peek_crossings(self) -> tuple[CrossingEvent, ...]:
        """Read pending crossings without clearing the queue.

        Useful for tests and instrumentation that want to observe the queue
        without consuming it. Returns an immutable tuple so callers can't
        mutate internal state.
        """
        return tuple(self._crossings)

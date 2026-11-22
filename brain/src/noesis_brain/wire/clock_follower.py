"""Clock follower — ticks for a Brain that is not on the Grid's own host.

`BrainHandler.on_tick` is otherwise reached only through the `brain.onTick` RPC
on a local Unix socket, which the Grid's bridge drives when Brain and Grid share
a host. A Brain connected over HTTPS gets no tick that way, and without a tick
no cycle of the mind runs: it would enrol, send heartbeats and never think.

The follower reads the Grid's public clock and calls `on_tick` once for each new
tick number it sees. The Grid stays the only clock:

  - the tick number is the Grid's; the Brain never invents one;
  - a paused Grid pauses the mind (the tick does not change);
  - ticks missed while this machine slept are skipped, not replayed;
  - when the Grid restarts, its tick starts again from 0 — the handler's cooldown
    markers are reset so its cycles do not wait for the old count to be passed.

Where a socket bridge is also delivering ticks, the follower stands back: it
waits a moment after seeing a new tick and delivers it only if the handler has
not seen it by then.

Design: docs/plans/2026-11-21-nous-property-cycle-design.md §0
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

log = logging.getLogger(__name__)

__all__ = ["follow_once", "follow_grid_clock", "GRACE_SECONDS", "ERROR_WAIT_SECONDS"]

# How long a socket bridge is given to deliver a tick before the follower does.
GRACE_SECONDS = 2.0
# Wait after an unreadable clock or a failed iteration.
ERROR_WAIT_SECONDS = 10.0
_DEFAULT_WAIT = 30.0
_MIN_WAIT, _MAX_WAIT = 1.0, 60.0

Sleep = Callable[[float], Awaitable[Any]]


def _is_tick(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _wait_for(clock: dict[str, Any]) -> float:
    rate = clock.get("tickRateMs")
    if isinstance(rate, bool) or not isinstance(rate, (int, float)) or rate <= 0:
        return _DEFAULT_WAIT
    return max(_MIN_WAIT, min(_MAX_WAIT, rate / 1000.0))


async def follow_once(client: Any, handler: Any, state: dict[str, Any], *, sleep: Sleep = asyncio.sleep) -> float:
    """One look at the Grid's clock. Returns the seconds to wait before the next.

    `state["last"]` is the last Grid tick this follower has handled.
    """
    clock = await client.fetch_clock()
    if not isinstance(clock, dict) or not _is_tick(clock.get("tick")):
        return ERROR_WAIT_SECONDS
    tick: int = clock["tick"]
    epoch = clock.get("epoch") if _is_tick(clock.get("epoch")) else 0
    wait = _wait_for(clock)

    last = state.get("last")
    if last is not None and tick == last:
        return wait
    if last is not None and tick < last:
        log.warning("[Brain] Grid clock went back (%s -> %s): Grid restarted; resetting cooldowns", last, tick)
        handler.reset_tick_markers()

    await sleep(GRACE_SECONDS)
    if getattr(handler, "_last_tick_seen", -1) == tick:
        state["last"] = tick  # a socket bridge delivered it
        return wait

    state["last"] = tick  # set before the call: a tick that fails is not retried
    actions = await handler.on_tick({"tick": tick, "epoch": epoch})
    outgoing = [
        a for a in (actions or [])
        if isinstance(a, dict) and a.get("action_type") != "noop"
    ]
    if outgoing:
        await client.post_actions(outgoing, tick=tick)
    return wait


async def follow_grid_clock(client: Any, handler: Any, *, sleep: Sleep = asyncio.sleep) -> None:
    """Follow the Grid's clock until cancelled. An iteration that fails is logged
    and followed by a short wait; it never ends the loop."""
    state: dict[str, Any] = {}
    while True:
        try:
            wait = await follow_once(client, handler, state, sleep=sleep)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — the mind must keep its clock
            log.warning("[Brain] clock follower iteration failed: %s", exc)
            wait = ERROR_WAIT_SECONDS
        await sleep(wait)

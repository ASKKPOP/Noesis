"""The clock follower: a Brain that is not on the Grid's host ticks itself from
the Grid's public clock. The Grid stays the only clock — the Brain never invents
a tick, skips what it missed, and survives the Grid restarting its count.
"""
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest
import yaml

from noesis_brain.psyche import load_psyche
from noesis_brain.rpc.handler import BrainHandler
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker
from noesis_brain.wire import clock_follower as cf

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _real_handler() -> BrainHandler:
    with open(SOPHIA_YAML) as f:
        data = yaml.safe_load(f)
    return BrainHandler(
        psyche=load_psyche(data=data),
        thymos=ThymosTracker.from_yaml(data.get("thymos", {})),
        telos=TelosManager.from_yaml(data.get("telos", {})),
        llm=AsyncMock(),
        did="did:civic:noesis:sophia",
    )


def _handler(actions=None):
    h = MagicMock()
    h._last_tick_seen = -1
    h.on_tick = AsyncMock(return_value=actions if actions is not None else [])
    h.reset_tick_markers = MagicMock()
    return h


def _client(*clocks):
    c = MagicMock()
    c.fetch_clock = AsyncMock(side_effect=list(clocks))
    c.post_actions = AsyncMock()
    return c


async def _no_sleep(_seconds):
    return None


def _clock(tick, epoch=0, rate=30000):
    return {"tick": tick, "epoch": epoch, "tickRateMs": rate}


async def test_first_tick_is_delivered_once():
    h, c, state = _handler(), _client(_clock(10, epoch=2)), {}
    wait = await cf.follow_once(c, h, state, sleep=_no_sleep)
    h.on_tick.assert_awaited_once_with({"tick": 10, "epoch": 2})
    assert state["last"] == 10
    assert wait == 30.0


async def test_same_tick_is_not_delivered_twice():
    h, c, state = _handler(), _client(_clock(10), _clock(10)), {}
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    assert h.on_tick.await_count == 1


async def test_a_long_gap_gives_one_tick_not_a_replay():
    # The machine slept: the Grid moved from 10 to 500 meanwhile.
    h, c, state = _handler(), _client(_clock(10), _clock(500)), {}
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    assert [call.args[0]["tick"] for call in h.on_tick.await_args_list] == [10, 500]


async def test_a_grid_restart_resets_the_cooldown_markers_and_keeps_ticking():
    h, c, state = _handler(), _client(_clock(500), _clock(3)), {}
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    h.reset_tick_markers.assert_not_called()
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    h.reset_tick_markers.assert_called_once()
    assert h.on_tick.await_args_list[-1].args[0]["tick"] == 3
    assert state["last"] == 3


@pytest.mark.parametrize("clock", [None, {}, {"tick": "7"}, {"tick": True}, {"tick": -1}, [1, 2]])
async def test_an_unusable_clock_delivers_nothing(clock):
    h, c, state = _handler(), _client(clock), {}
    wait = await cf.follow_once(c, h, state, sleep=_no_sleep)
    h.on_tick.assert_not_awaited()
    assert wait == 10.0
    assert "last" not in state


async def test_a_tick_the_socket_bridge_already_delivered_is_skipped():
    h, c, state = _handler(), _client(_clock(10)), {}
    h._last_tick_seen = 10
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    h.on_tick.assert_not_awaited()
    assert state["last"] == 10


async def test_grace_wait_happens_before_delivery():
    slept: list[float] = []

    async def _sleep(seconds):
        slept.append(seconds)

    h, c = _handler(), _client(_clock(10))
    await cf.follow_once(c, h, {}, sleep=_sleep)
    assert slept == [cf.GRACE_SECONDS]


async def test_noop_actions_are_not_posted():
    h, c = _handler([{"action_type": "noop"}]), _client(_clock(10))
    await cf.follow_once(c, h, {}, sleep=_no_sleep)
    c.post_actions.assert_not_awaited()


async def test_real_actions_are_posted_with_the_grid_tick():
    speak = {"action_type": "speak", "channel": "agora", "text": "hello"}
    h, c = _handler([{"action_type": "noop"}, speak]), _client(_clock(10))
    await cf.follow_once(c, h, {}, sleep=_no_sleep)
    c.post_actions.assert_awaited_once_with([speak], tick=10)


async def test_wait_follows_the_grid_tick_rate_within_bounds():
    for rate, expected in [(30000, 30.0), (200, 1.0), (600000, 60.0), ("junk", 30.0), (None, 30.0)]:
        h, c = _handler(), _client({"tick": 5, "epoch": 0, "tickRateMs": rate})
        assert await cf.follow_once(c, h, {}, sleep=_no_sleep) == expected


async def test_a_failing_iteration_does_not_end_the_loop():
    h = _handler()
    h.on_tick = AsyncMock(side_effect=[RuntimeError("boom"), []])
    c = _client(_clock(1), _clock(2), _clock(2))
    waits: list[float] = []

    async def _sleep(seconds):
        waits.append(seconds)
        if len([w for w in waits if w != cf.GRACE_SECONDS]) >= 2:
            raise asyncio.CancelledError

    with pytest.raises(asyncio.CancelledError):
        await cf.follow_grid_clock(c, h, sleep=_sleep)
    assert h.on_tick.await_count == 2          # the second tick was still delivered
    assert cf.ERROR_WAIT_SECONDS in waits       # after the failure it waited, then went on


# ── handler side ─────────────────────────────────────────────────────────────
async def test_on_tick_records_the_tick_it_saw():
    h = _real_handler()
    assert h._last_tick_seen == -1
    await h.on_tick({"tick": 42, "epoch": 1})
    assert h._last_tick_seen == 42


def test_reset_tick_markers_clears_every_cooldown():
    h = _real_handler()
    h._last_econ_tick = 900
    h._last_property_tick = 900
    h._last_decision_tick = 900
    h._last_tick_seen = 900
    h.reset_tick_markers()
    assert h._last_econ_tick == -10_000
    assert h._last_property_tick == -10_000
    assert h._last_decision_tick == -10_000
    assert h._last_tick_seen == 900     # what was seen is a fact, not a cooldown

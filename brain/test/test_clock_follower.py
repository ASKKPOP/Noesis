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
    assert wait == 7.5          # a quarter of the 30 s tick, so no tick is missed


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


async def test_the_follower_does_not_post_what_on_tick_returns():
    # on_tick forwards its own batch to the Grid when a wire client is set; a
    # second post from here would make the Nous speak, move and trade twice.
    speak = {"action_type": "speak", "channel": "agora", "text": "hello"}
    h, c = _handler([{"action_type": "noop"}, speak]), _client(_clock(10))
    await cf.follow_once(c, h, {}, sleep=_no_sleep)
    c.post_actions.assert_not_awaited()


async def test_wait_follows_the_grid_tick_rate_within_bounds():
    for rate, expected in [(30000, 7.5), (200, 1.0), (600000, 15.0), ("junk", 7.5), (None, 7.5)]:
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


def test_reset_tick_markers_puts_the_sleep_marker_back_to_its_start():
    # _last_sleep_tick starts at 0, not -10_000: resetting it lower would force a
    # sleep cycle on every Grid restart.
    h = _real_handler()
    h._last_sleep_tick = 900
    h.reset_tick_markers()
    assert h._last_sleep_tick == 0


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


# ── found by independent review ──────────────────────────────────────────────
async def test_an_older_tick_is_not_delivered_after_a_newer_one():
    # A socket bridge delivered tick 11 while the follower was still holding tick 10.
    h, c, state = _handler(), _client(_clock(10)), {}
    h._last_tick_seen = 11
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    h.on_tick.assert_not_awaited()


async def test_after_a_grid_restart_the_old_high_tick_does_not_block_the_new_count():
    h, c, state = _handler(), _client(_clock(500), _clock(3)), {}
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    h._last_tick_seen = 500          # what a real on_tick would have recorded
    await cf.follow_once(c, h, state, sleep=_no_sleep)
    assert h.on_tick.await_args_list[-1].args[0]["tick"] == 3
    assert h._last_tick_seen == -1   # cleared with the cooldowns; the mock on_tick does not set it


async def test_every_tick_is_seen_when_the_follower_polls_faster_than_the_grid_ticks():
    # 12 polls at a quarter-tick each cover 3 Grid ticks; all three must be delivered.
    clocks = [_clock(1 + i // 4) for i in range(12)]
    h, c, state = _handler(), _client(*clocks), {}
    for _ in clocks:
        await cf.follow_once(c, h, state, sleep=_no_sleep)
    assert [call.args[0]["tick"] for call in h.on_tick.await_args_list] == [1, 2, 3]


# ── found when the firehose TickDriver and this follower met on one branch ────
def _wired_handler():
    """A real handler wired to a Grid client that records what is posted."""
    from noesis_brain.rpc.types import Action, ActionType

    h = _real_handler()
    client = MagicMock()
    client.post_actions = AsyncMock(return_value=MagicMock(status_code=200, text=""))
    client.fetch_clock = AsyncMock(return_value=_clock(10))
    h._grid_wire_client = client
    h._pending_actions.append(Action(action_type=ActionType.SPEAK, channel="agora", text="hello"))
    return h, client


def _posts_of(client, action_type):
    return [
        call for call in client.post_actions.await_args_list
        if any(a.get("action_type") == action_type for a in call.args[0])
    ]


async def test_one_tick_posts_an_action_once_not_twice():
    h, client = _wired_handler()
    await cf.follow_once(client, h, {}, sleep=_no_sleep)
    for _ in range(3):
        await asyncio.sleep(0)          # let on_tick's own forward run
    assert len(_posts_of(client, "speak")) == 1


async def test_a_tick_that_arrives_mid_decision_is_skipped_not_run_alongside():
    h = _real_handler()
    release, started = asyncio.Event(), []

    async def slow(params):
        started.append(params["tick"])
        await release.wait()
        return []

    h._on_tick = slow
    first = asyncio.create_task(h.on_tick({"tick": 5, "epoch": 0}))
    await asyncio.sleep(0)
    assert await h.on_tick({"tick": 6, "epoch": 0}) == []
    assert started == [5]               # the second tick never reached the body
    release.set()
    await first
    await h.on_tick({"tick": 7, "epoch": 0})
    assert started == [5, 7]            # free again once the first decision ended


async def test_a_decision_that_fails_does_not_leave_the_nous_locked():
    h = _real_handler()

    async def boom(_params):
        raise RuntimeError("model fell over")

    h._on_tick = boom
    with pytest.raises(RuntimeError):
        await h.on_tick({"tick": 5, "epoch": 0})
    seen = []

    async def ok(params):
        seen.append(params["tick"])
        return []

    h._on_tick = ok
    await h.on_tick({"tick": 6, "epoch": 0})
    assert seen == [6]

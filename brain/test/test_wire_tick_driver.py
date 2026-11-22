"""TickDriver — the Grid's clock on the firehose is what makes a wire-connected Nous decide."""

import asyncio

from noesis_brain.wire.tick_driver import TickDriver, tick_of


def tick_frame(tick: int, epoch: int = 0) -> dict:
    return {"type": "event", "entry": {"eventType": "tick", "actorDid": "system", "payload": {"tick": tick, "epoch": epoch}}}


def test_tick_of_reads_a_clock_frame():
    assert tick_of(tick_frame(7, 2)) == {"tick": 7, "epoch": 2}


def test_tick_of_ignores_everything_else():
    assert tick_of({"type": "hello"}) is None
    assert tick_of({"type": "p2p.signal_received"}) is None
    assert tick_of({"type": "event", "entry": {"eventType": "nous.moved", "payload": {"tick": 7}}}) is None
    assert tick_of({"type": "event", "entry": {"eventType": "tick", "payload": {"tick": "7"}}}) is None
    assert tick_of({"type": "event", "entry": {"eventType": "tick"}}) is None


async def test_a_tick_starts_one_decision():
    seen: list[dict] = []

    async def on_tick(params: dict) -> list:
        seen.append(params)
        return []

    driver = TickDriver(on_tick)
    assert driver.offer(tick_frame(3, 1)) is True
    await asyncio.sleep(0)
    assert seen == [{"tick": 3, "epoch": 1}]


async def test_a_tick_is_skipped_while_the_nous_is_still_deciding():
    release = asyncio.Event()
    seen: list[int] = []

    async def on_tick(params: dict) -> list:
        seen.append(params["tick"])
        await release.wait()
        return []

    driver = TickDriver(on_tick)
    assert driver.offer(tick_frame(1)) is True
    await asyncio.sleep(0)
    assert driver.offer(tick_frame(2)) is False   # still thinking — not queued
    release.set()
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert driver.offer(tick_frame(3)) is True
    await asyncio.sleep(0)
    assert seen == [1, 3]


async def test_a_failed_decision_does_not_stop_the_next():
    calls = 0

    async def on_tick(params: dict) -> list:
        nonlocal calls
        calls += 1
        raise RuntimeError("model unreachable")

    driver = TickDriver(on_tick)
    driver.offer(tick_frame(1))
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert driver.offer(tick_frame(2)) is True
    await asyncio.sleep(0)
    assert calls == 2


async def test_other_frames_start_nothing():
    async def on_tick(params: dict) -> list:
        raise AssertionError("must not be called")

    assert TickDriver(on_tick).offer({"type": "p2p.signal_received"}) is False

"""Reminder & Wake-Up (spec §3) — tick-scheduled reminders that fire once."""
from __future__ import annotations

from noesis_brain.reminders import ReminderStore


def test_schedule_and_query_due():
    store = ReminderStore()
    r = store.schedule("check the market", due_tick=5)
    assert r.note == "check the market"
    assert r.due_tick == 5
    assert r.fired is False
    assert store.due(4) == []          # not yet
    assert store.due(5) == [r]         # now due
    assert store.due(9) == [r]         # still due until fired


def test_fire_due_is_idempotent():
    store = ReminderStore()
    store.schedule("wake up", due_tick=3)
    fired = store.fire_due(3)
    assert [x.note for x in fired] == ["wake up"]
    # already fired — never fires again
    assert store.fire_due(4) == []
    assert store.due(10) == []
    assert store.pending() == []


def test_pending_excludes_fired():
    store = ReminderStore()
    store.schedule("a", due_tick=1)
    store.schedule("b", due_tick=10)
    store.fire_due(1)
    assert [r.note for r in store.pending()] == ["b"]


def test_ids_are_deterministic_and_unique():
    store = ReminderStore()
    a = store.schedule("a", due_tick=1)
    b = store.schedule("b", due_tick=1)
    assert a.id != b.id
    assert a.id == "rem-1" and b.id == "rem-2"   # no clock/random


def test_fire_due_returns_in_schedule_order():
    store = ReminderStore()
    store.schedule("first", due_tick=2)
    store.schedule("second", due_tick=1)
    # both due at tick 5 — returned in the order they were scheduled
    assert [r.note for r in store.fire_due(5)] == ["first", "second"]

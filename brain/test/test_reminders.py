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


# ── Condition-based reminders (spec §3: "or when conditions are met") ───

from noesis_brain.reminders import ReminderCondition  # noqa: E402


def test_condition_fires_when_signal_crosses():
    store = ReminderStore()
    cond = ReminderCondition(signal="curiosity", op=">=", value=0.7)
    store.schedule("go research", condition=cond)
    # no context / below threshold → not due
    assert store.due(0) == []
    assert store.due(0, {"curiosity": 0.5}) == []
    # threshold met → due
    fired = store.fire_due(0, {"curiosity": 0.8})
    assert [r.note for r in fired] == ["go research"]
    # fires once
    assert store.fire_due(0, {"curiosity": 0.9}) == []


def test_missing_signal_is_not_due():
    store = ReminderStore()
    store.schedule("x", condition=ReminderCondition("balance", "<", 10.0))
    assert store.due(0, {"curiosity": 0.9}) == []   # signal absent


def test_condition_ops():
    ctx = {"v": 5.0}
    assert ReminderCondition("v", ">=", 5.0).matches(ctx)
    assert ReminderCondition("v", "<=", 5.0).matches(ctx)
    assert ReminderCondition("v", ">", 4.0).matches(ctx)
    assert ReminderCondition("v", "<", 6.0).matches(ctx)
    assert ReminderCondition("v", "==", 5.0).matches(ctx)
    assert not ReminderCondition("v", ">", 5.0).matches(ctx)


def test_tick_and_condition_either_triggers():
    store = ReminderStore()
    store.schedule("both", due_tick=10, condition=ReminderCondition("c", ">=", 1.0))
    # condition met before the tick → due early
    assert [r.note for r in store.fire_due(0, {"c": 2.0})] == ["both"]


def test_tick_only_reminder_unaffected_by_context():
    store = ReminderStore()
    store.schedule("sched", due_tick=3)
    assert store.due(2, {"anything": 1.0}) == []
    assert [r.note for r in store.due(3)] == ["sched"]

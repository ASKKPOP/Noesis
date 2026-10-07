"""O1b — persistent per-Nous task scheduler: the durable self-scheduled queue."""
from __future__ import annotations

from noesis_brain.scheduler import MAX_PENDING, TaskQueue


def test_enqueue_and_due():
    q = TaskQueue()
    tid = q.enqueue("remember", {"note": "check the market"}, due_tick=5)
    assert tid == 1                      # sqlite rowid — no clock/random
    assert q.due(4) == []                # not yet
    [t] = q.due(5)
    assert (t.id, t.kind, t.payload, t.due_tick, t.priority, t.status) == (
        tid, "remember", {"note": "check the market"}, 5, 0, "pending",
    )
    assert [x.id for x in q.due(9)] == [tid]   # still due until started


def test_due_orders_by_priority_then_due_tick_then_insertion():
    q = TaskQueue()
    a = q.enqueue("remember", {"note": "a"}, due_tick=3, priority=0)
    b = q.enqueue("remember", {"note": "b"}, due_tick=1, priority=0)
    c = q.enqueue("remember", {"note": "c"}, due_tick=4, priority=5)
    d = q.enqueue("remember", {"note": "d"}, due_tick=1, priority=0)
    q.enqueue("remember", {"note": "later"}, due_tick=99, priority=9)
    # highest priority first, then earliest due_tick, then insertion order
    assert [t.id for t in q.due(10)] == [c, b, d, a]


def test_status_transitions():
    q = TaskQueue()
    a = q.enqueue("remember", {"note": "a"}, due_tick=1)
    b = q.enqueue("remember", {"note": "b"}, due_tick=1)
    q.mark_started(a)
    assert [t.id for t in q.due(1)] == [b]     # started is no longer due
    q.mark_done(a)
    q.mark_started(b)
    q.mark_failed(b, "boom")
    assert q.counts() == {"pending": 0, "started": 0, "done": 1, "failed": 1}
    assert q.get(b).reason == "boom"
    assert q.get(a).status == "done"
    assert q.due(100) == []


def test_next_due_tick_tracks_earliest_pending():
    q = TaskQueue()
    assert q.next_due_tick() is None
    a = q.enqueue("remember", {"note": "a"}, due_tick=7)
    q.enqueue("remember", {"note": "b"}, due_tick=12)
    assert q.next_due_tick() == 7
    q.mark_started(a)
    assert q.next_due_tick() == 12


def test_pending_tasks_survive_restart(tmp_path):
    q1 = TaskQueue(tmp_path, nous_did="did:noesis:sophia")
    kept = q1.enqueue("remember", {"note": "kept"}, due_tick=10, priority=2)
    finished = q1.enqueue("remember", {"note": "finished"}, due_tick=1)
    q1.mark_started(finished)
    q1.mark_done(finished)
    q1.close()

    # a fresh process re-opens the same per-Nous db file
    assert (tmp_path / "scheduler_did_noesis_sophia.db").exists()
    q2 = TaskQueue(tmp_path, nous_did="did:noesis:sophia")
    [t] = q2.due(10)
    assert (t.id, t.payload, t.priority) == (kept, {"note": "kept"}, 2)
    assert q2.counts() == {"pending": 1, "started": 0, "done": 1, "failed": 0}
    # ids keep ascending across restarts — never reused
    assert q2.enqueue("remember", {"note": "new"}, due_tick=11) > finished


def test_per_nous_isolation(tmp_path):
    a = TaskQueue(tmp_path, nous_did="did:noesis:a")
    b = TaskQueue(tmp_path, nous_did="did:noesis:b")
    a.enqueue("remember", {"note": "mine"}, due_tick=1)
    assert b.due(5) == []


def test_bounded_queue_rejects_when_full():
    q = TaskQueue(max_pending=2)
    first = q.enqueue("remember", {"note": "1"}, due_tick=1)
    assert q.enqueue("remember", {"note": "2"}, due_tick=1) is not None
    # full → rejected (None); nothing already queued is dropped
    assert q.enqueue("remember", {"note": "3"}, due_tick=1) is None
    assert q.counts()["pending"] == 2
    # finishing one frees a slot — the bound is on pending, not on history
    q.mark_started(first)
    q.mark_done(first)
    assert q.enqueue("remember", {"note": "3"}, due_tick=1) is not None
    assert MAX_PENDING >= 2

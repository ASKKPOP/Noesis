"""
brain/test/wire/test_wire_queue.py

Phase 38 WIRE-03/WIRE-04 — unit tests for WireQueue + derive_idempotency_key.

7 test cases:
  1. test_idempotency_key_is_deterministic
  2. test_idempotency_key_collision_resistance
  3. test_enqueue_then_dequeue_round_trip
  4. test_capacity_eviction_at_10k
  5. test_mark_acked_deletes_rows
  6. test_enqueue_duplicate_key_is_noop
  7. test_survives_restart
"""

import pytest

from noesis_brain.wire.queue import (
    QUEUE_CAPACITY,
    WireQueue,
    derive_idempotency_key,
)


# ── 1. Idempotency key determinism ────────────────────────────────────────────


def test_idempotency_key_is_deterministic(tmp_path):
    """Same inputs always produce the same 64-char hex key; payload key order
    must NOT affect the result (canonical JSON sorts keys)."""
    k1 = derive_idempotency_key(
        brain_did="did:noesis:nous:abc",
        tick=42,
        event_type="nous.spoke",
        payload={"text": "hello", "channel": "public"},
    )
    k2 = derive_idempotency_key(
        brain_did="did:noesis:nous:abc",
        tick=42,
        event_type="nous.spoke",
        payload={"channel": "public", "text": "hello"},  # reversed key order
    )
    assert k1 == k2, "canonical JSON must sort keys so order does not matter"
    assert len(k1) == 64
    assert all(c in "0123456789abcdef" for c in k1)

    # Different payload → different key.
    k3 = derive_idempotency_key(
        brain_did="did:noesis:nous:abc",
        tick=42,
        event_type="nous.spoke",
        payload={"text": "different", "channel": "public"},
    )
    assert k1 != k3


# ── 2. Collision resistance ───────────────────────────────────────────────────


def test_idempotency_key_collision_resistance(tmp_path):
    """Two events that share (event_type, payload) but differ in tick OR brain_did
    must produce different keys (colon-separated formula prevents prefix collisions)."""
    base = dict(
        brain_did="did:noesis:nous:x",
        event_type="nous.spoke",
        payload={"text": "hi"},
    )
    k_tick_1 = derive_idempotency_key(**base, tick=1)
    k_tick_2 = derive_idempotency_key(**base, tick=2)
    assert k_tick_1 != k_tick_2, "different tick must produce different key"

    k_did_a = derive_idempotency_key(
        brain_did="did:noesis:nous:aaa", tick=1, event_type="nous.spoke", payload={"text": "hi"}
    )
    k_did_b = derive_idempotency_key(
        brain_did="did:noesis:nous:bbb", tick=1, event_type="nous.spoke", payload={"text": "hi"}
    )
    assert k_did_a != k_did_b, "different brain_did must produce different key"


# ── 3. Enqueue → dequeue round-trip ──────────────────────────────────────────


def test_enqueue_then_dequeue_round_trip(tmp_path):
    """Enqueue 3 events; dequeue_batch returns them in insertion order."""
    q = WireQueue(tmp_path / "q.db")

    events = [
        dict(brain_did="did:noesis:nous:r", tick=i, event_type="nous.spoke", payload={"i": i})
        for i in range(3)
    ]
    for ev in events:
        q.enqueue(**ev)

    batch = q.dequeue_batch(batch_size=10)
    assert len(batch) == 3
    for i, item in enumerate(batch):
        assert item.tick == i
        assert item.payload == {"i": i}
        assert item.brain_did == "did:noesis:nous:r"
        assert item.event_type == "nous.spoke"
        assert len(item.idempotency_key) == 64

    q.close()


# ── 4. Capacity eviction at 10K ────────────────────────────────────────────────


def test_capacity_eviction_at_10k(tmp_path):
    """Enqueue 10001 events; queue size stays at exactly 10000.
    The FIRST enqueued event must be gone (FIFO eviction)."""
    q = WireQueue(tmp_path / "q.db")

    first_key = q.enqueue(
        brain_did="did:noesis:nous:cap",
        tick=0,
        event_type="nous.spoke",
        payload={"seq": 0},
    )

    for i in range(1, QUEUE_CAPACITY + 1):
        q.enqueue(
            brain_did="did:noesis:nous:cap",
            tick=i,
            event_type="nous.spoke",
            payload={"seq": i},
        )

    assert q.size() == QUEUE_CAPACITY, f"expected {QUEUE_CAPACITY}, got {q.size()}"

    # The first event should have been evicted.
    batch = q.dequeue_batch(batch_size=1)
    assert len(batch) == 1
    assert batch[0].idempotency_key != first_key, "oldest event must have been evicted"

    q.close()


# ── 5. mark_acked deletes rows ────────────────────────────────────────────────


def test_mark_acked_deletes_rows(tmp_path):
    """Enqueue 5 events; ack rows 0 and 2 (by position); size drops to 3."""
    q = WireQueue(tmp_path / "q.db")

    for i in range(5):
        q.enqueue(
            brain_did="did:noesis:nous:ack",
            tick=i,
            event_type="nous.spoke",
            payload={"i": i},
        )

    batch = q.dequeue_batch(batch_size=5)
    assert len(batch) == 5

    # Ack rows at positions 0 and 2.
    q.mark_acked([batch[0].row_id, batch[2].row_id])
    assert q.size() == 3

    q.close()


# ── 6. Duplicate key is no-op ─────────────────────────────────────────────────


def test_enqueue_duplicate_key_is_noop(tmp_path):
    """Enqueue the same logical event twice; size must be 1."""
    q = WireQueue(tmp_path / "q.db")

    ev = dict(
        brain_did="did:noesis:nous:dup",
        tick=99,
        event_type="nous.spoke",
        payload={"text": "hello"},
    )
    k1 = q.enqueue(**ev)
    k2 = q.enqueue(**ev)

    assert k1 == k2, "same event must produce same key"
    assert q.size() == 1, "duplicate must be silently dropped"

    q.close()


# ── 7. Survives restart ───────────────────────────────────────────────────────


def test_survives_restart(tmp_path):
    """Events persist across WireQueue close + reopen (durable to Brain restarts)."""
    db_file = tmp_path / "restart.db"

    q = WireQueue(db_file)
    for i in range(5):
        q.enqueue(
            brain_did="did:noesis:nous:restart",
            tick=i,
            event_type="nous.spoke",
            payload={"i": i},
        )
    q.close()

    # Reopen — data must still be there.
    q2 = WireQueue(db_file)
    assert q2.size() == 5
    batch = q2.dequeue_batch(batch_size=5)
    ticks = [ev.tick for ev in batch]
    assert ticks == list(range(5)), "events must survive restart in FIFO order"
    q2.close()

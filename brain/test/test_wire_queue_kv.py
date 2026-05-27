"""Phase 41 / SLEEP-03 — WireQueue kv_store table: last_seen_tick get/set roundtrip."""


def test_set_last_seen_tick_then_get_returns_same_value(tmp_path):
    """set_last_seen_tick(42); get_last_seen_tick() == 42."""
    from noesis_brain.wire.queue import WireQueue
    db = tmp_path / "wire_queue.db"
    q = WireQueue(str(db))
    try:
        q.set_last_seen_tick(42)
        assert q.get_last_seen_tick() == 42
    finally:
        q.close()


def test_get_last_seen_tick_returns_none_when_unset(tmp_path):
    """Fresh DB → get_last_seen_tick() is None (no row in kv_store yet)."""
    from noesis_brain.wire.queue import WireQueue
    db = tmp_path / "wire_queue.db"
    q = WireQueue(str(db))
    try:
        assert q.get_last_seen_tick() is None
    finally:
        q.close()


def test_set_last_seen_tick_overwrites_previous_value(tmp_path):
    """INSERT OR REPLACE semantics — set(10), set(20), get() == 20."""
    from noesis_brain.wire.queue import WireQueue
    db = tmp_path / "wire_queue.db"
    q = WireQueue(str(db))
    try:
        q.set_last_seen_tick(10)
        q.set_last_seen_tick(20)
        assert q.get_last_seen_tick() == 20
    finally:
        q.close()


def test_kv_store_survives_wirequeue_reopen(tmp_path):
    """WireQueue(db_path).close(); WireQueue(db_path).get_last_seen_tick() returns last persisted value."""
    from noesis_brain.wire.queue import WireQueue
    db = tmp_path / "wire_queue.db"
    q1 = WireQueue(str(db))
    q1.set_last_seen_tick(99)
    q1.close()
    q2 = WireQueue(str(db))
    try:
        assert q2.get_last_seen_tick() == 99
    finally:
        q2.close()

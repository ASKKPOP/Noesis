"""
brain/src/noesis_brain/wire/queue.py

Phase 38 WIRE-03/WIRE-04 — SQLite-backed offline event buffer for the Brain → Grid wire.

WireQueue is a FIFO buffer with a hard cap of 10 000 rows. On overflow the oldest
row (lowest autoincrement id) is evicted before the new row is inserted. This is a
deliberate lossy design — old events are sacrificed to protect recent ones.

The queue file persists across Brain restarts. WAL journal mode is used so that
concurrent reads during replay do not block the writer.

Per D-38-A8 the idempotency key is derived as follows:

─────────────────────────────────────────────────────────────────────────
CANONICAL IDEMPOTENCY KEY FORMULA — DO NOT CHANGE WITHOUT MIGRATION.

  key = sha256(f"{brain_did}:{tick}:{event_type}:{payload_hash}").hexdigest()
  payload_hash = sha256(canonical_json(payload)).hexdigest()
  canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))

Per Phase 38 D-38-A8 + WIRE-04. Colon separators prevent prefix collision
(Pitfall 2 from RESEARCH.md). Grid stores this key as CHAR(64) PRIMARY KEY
in brain_event_ingest.
─────────────────────────────────────────────────────────────────────────
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

__all__ = ["WireQueue", "QueuedEvent", "derive_idempotency_key", "QUEUE_CAPACITY"]

# Hard cap on queue depth (Pitfall 8 from RESEARCH.md — deliberate lossy buffer).
QUEUE_CAPACITY = 10_000


# ── Idempotency key derivation ─────────────────────────────────────────────────
#
# CANONICAL IDEMPOTENCY KEY FORMULA — DO NOT CHANGE WITHOUT MIGRATION.
#
# key = sha256(f"{brain_did}:{tick}:{event_type}:{payload_hash}").hexdigest()
# payload_hash = sha256(canonical_json(payload)).hexdigest()
# canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
#
# Per Phase 38 D-38-A8 + WIRE-04. Colon separators prevent prefix collision
# (Pitfall 2 from RESEARCH.md). Grid stores this key as CHAR(64) PRIMARY KEY
# in brain_event_ingest.


def _canonical_json(payload: dict) -> str:
    """Deterministic JSON serialisation: sorted keys, no whitespace."""
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def derive_idempotency_key(
    *,
    brain_did: str,
    tick: int,
    event_type: str,
    payload: dict,
) -> str:
    """Return a 64-char lowercase hex string uniquely identifying this event.

    The formula is canonical and MUST NOT change without a DB migration because
    keys are stored in brain_event_ingest on Grid as CHAR(64) PRIMARY KEY.
    """
    payload_hash = hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()
    material = f"{brain_did}:{tick}:{event_type}:{payload_hash}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


# ── Data class for dequeued events ─────────────────────────────────────────────


@dataclass
class QueuedEvent:
    """One row returned from dequeue_batch()."""

    row_id: int
    idempotency_key: str
    brain_did: str
    tick: int
    event_type: str
    payload: dict
    enqueued_at: int  # Unix seconds


# ── WireQueue ──────────────────────────────────────────────────────────────────


class WireQueue:
    """SQLite-backed FIFO buffer for outbound Brain → Grid wire events.

    Capacity is hard-capped at QUEUE_CAPACITY (10 000) rows. Overflow evicts
    the oldest row (lowest autoincrement id) in the same transaction as the
    INSERT so the cap is never exceeded.

    Re-enqueueing the same logical event (same brain_did + tick + event_type +
    payload) is a silent no-op — the UNIQUE constraint on idempotency_key
    absorbs duplicates via INSERT OR IGNORE.
    """

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = str(db_path)
        # isolation_level=None means autocommit by default; we use explicit
        # ``with self._conn:`` context managers for transactions.
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False, isolation_level=None)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS wire_queue (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                idempotency_key TEXT    NOT NULL UNIQUE,
                brain_did       TEXT    NOT NULL,
                tick            INTEGER NOT NULL,
                event_type      TEXT    NOT NULL,
                payload_json    TEXT    NOT NULL,
                enqueued_at     INTEGER NOT NULL
            )
            """
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_enqueued_at ON wire_queue (enqueued_at)"
        )
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS kv_store (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )

    # ── Core API ───────────────────────────────────────────────────────────────

    def size(self) -> int:
        """Return the number of rows currently in the queue."""
        cur = self._conn.execute("SELECT COUNT(*) FROM wire_queue")
        return int(cur.fetchone()[0])

    def enqueue(
        self,
        *,
        brain_did: str,
        tick: int,
        event_type: str,
        payload: dict,
        _clock=None,  # injectable for tests; defaults to time.time
    ) -> str:
        """Insert one event into the queue. Returns the idempotency_key.

        On capacity overflow the oldest row is deleted in the same transaction
        before the new row is inserted — FIFO eviction, one row at a time.

        If the derived idempotency_key already exists (duplicate re-enqueue)
        the INSERT OR IGNORE silently skips insertion and returns the key.

        Raises sqlite3.Error on unexpected DB failures — never swallowed.
        """
        key = derive_idempotency_key(
            brain_did=brain_did,
            tick=tick,
            event_type=event_type,
            payload=payload,
        )
        now = int((_clock or time.time)())
        with self._conn:
            # Evict oldest rows until below cap (usually 0 or 1 iteration).
            while True:
                count = self._conn.execute(
                    "SELECT COUNT(*) FROM wire_queue"
                ).fetchone()[0]
                if count < QUEUE_CAPACITY:
                    break
                self._conn.execute(
                    "DELETE FROM wire_queue WHERE id = (SELECT MIN(id) FROM wire_queue)"
                )
            self._conn.execute(
                """
                INSERT OR IGNORE INTO wire_queue
                    (idempotency_key, brain_did, tick, event_type, payload_json, enqueued_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (key, brain_did, tick, event_type, _canonical_json(payload), now),
            )
        return key

    def dequeue_batch(self, batch_size: int = 100) -> list[QueuedEvent]:
        """Return up to *batch_size* events in FIFO order (lowest id first).

        Does NOT delete the returned rows — call mark_acked() after the batch
        is successfully delivered to Grid.
        """
        cur = self._conn.execute(
            """
            SELECT id, idempotency_key, brain_did, tick, event_type, payload_json, enqueued_at
            FROM wire_queue
            ORDER BY id ASC
            LIMIT ?
            """,
            (batch_size,),
        )
        out: list[QueuedEvent] = []
        for row in cur.fetchall():
            out.append(
                QueuedEvent(
                    row_id=int(row[0]),
                    idempotency_key=row[1],
                    brain_did=row[2],
                    tick=int(row[3]),
                    event_type=row[4],
                    payload=json.loads(row[5]),
                    enqueued_at=int(row[6]),
                )
            )
        return out

    def mark_acked(self, row_ids: list[int]) -> None:
        """Delete the rows whose ids are in *row_ids*.

        Called after Grid confirms receipt via POST /api/v1/brain/events/batch.
        Both accepted AND duplicate responses are safe to ack — Grid already has
        the event in brain_event_ingest (or will next time), so local storage is
        no longer needed.
        """
        if not row_ids:
            return
        placeholders = ",".join("?" * len(row_ids))
        with self._conn:
            self._conn.execute(
                f"DELETE FROM wire_queue WHERE id IN ({placeholders})",
                row_ids,
            )

    def set_last_seen_tick(self, tick: int) -> None:
        """Phase 41 SLEEP-03 — persist Brain's last_seen_tick to local SQLite.

        Called by GridWireClient.post_presence_heartbeat after a successful 2xx
        response. INSERT OR REPLACE semantics — overwrite any previous value.
        Survives Brain process restart; consumed by WssSubscriber on reconnect.
        """
        with self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('last_seen_tick', ?)",
                (str(tick),),
            )

    def get_last_seen_tick(self) -> int | None:
        """Phase 41 SLEEP-03 — read Brain's last_seen_tick from local SQLite.

        Returns None if never set (fresh DB or SQLite wiped).
        """
        cur = self._conn.execute(
            "SELECT value FROM kv_store WHERE key = 'last_seen_tick'"
        )
        row = cur.fetchone()
        return int(row[0]) if row else None

    def close(self) -> None:
        """Close the underlying SQLite connection."""
        self._conn.close()

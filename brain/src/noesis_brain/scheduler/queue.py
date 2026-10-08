"""Task queue — per-Nous persistence of self-scheduled tasks.

Clone of the synopsis/iris SQLite discipline (WAL, constructor accepts a file, a
directory that derives ``scheduler_{did_safe}.db``, or ``:memory:``). Rows are
never deleted: a task moves pending → started → done | failed, so the table is
also the history of what the Nous scheduled for itself.
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Bound on *pending* tasks. A full queue rejects new work rather than dropping
# something the Nous already committed to.
MAX_PENDING = 256

_STATUSES = ("pending", "started", "done", "failed")


def _did_safe(did: str) -> str:
    return did.replace(":", "_") if did else "unknown"


@dataclass(frozen=True)
class ScheduledTask:
    """One self-scheduled task. ``payload`` is Brain-local — never crosses the boundary."""

    id: int
    kind: str
    payload: dict[str, Any]
    due_tick: int
    priority: int
    status: str
    reason: str = ""


class TaskQueue:
    def __init__(
        self,
        db_path: str | Path = ":memory:",
        nous_did: str = "",
        max_pending: int = MAX_PENDING,
    ) -> None:
        p = Path(db_path) if str(db_path) != ":memory:" else None
        if p is not None and p.is_dir():
            p = p / f"scheduler_{_did_safe(nous_did)}.db"
        self._db_path = str(p) if p is not None else ":memory:"
        self._nous_did = nous_did
        self._max_pending = max_pending
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS scheduled_tasks (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                nous_did  TEXT NOT NULL,
                kind      TEXT NOT NULL,
                payload   TEXT NOT NULL,
                due_tick  INTEGER NOT NULL,
                priority  INTEGER NOT NULL DEFAULT 0,
                status    TEXT NOT NULL DEFAULT 'pending',
                reason    TEXT NOT NULL DEFAULT ''
            );
            CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_due
                ON scheduled_tasks(status, due_tick);
            """
        )
        self._conn.commit()

    def enqueue(
        self, kind: str, payload: dict[str, Any], due_tick: int, priority: int = 0
    ) -> int | None:
        """Queue a task for ``due_tick``. Returns its id, or None if the queue is full."""
        if self.counts()["pending"] >= self._max_pending:
            return None
        cur = self._conn.execute(
            "INSERT INTO scheduled_tasks (nous_did, kind, payload, due_tick, priority)"
            " VALUES (?, ?, ?, ?, ?)",
            (self._nous_did, kind, json.dumps(payload), int(due_tick), int(priority)),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def due(self, current_tick: int) -> list[ScheduledTask]:
        """Pending tasks whose tick has arrived: highest priority first, then
        earliest due_tick, then insertion order."""
        rows = self._conn.execute(
            "SELECT * FROM scheduled_tasks WHERE status = 'pending' AND due_tick <= ?"
            " ORDER BY priority DESC, due_tick ASC, id ASC",
            (int(current_tick),),
        ).fetchall()
        return [self._row(r) for r in rows]

    def get(self, task_id: int) -> ScheduledTask | None:
        row = self._conn.execute(
            "SELECT * FROM scheduled_tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return self._row(row) if row is not None else None

    def mark_started(self, task_id: int) -> None:
        self._set_status(task_id, "started")

    def mark_done(self, task_id: int) -> None:
        self._set_status(task_id, "done")

    def mark_failed(self, task_id: int, reason: str) -> None:
        self._set_status(task_id, "failed", reason)

    def counts(self) -> dict[str, int]:
        """Task count per status (every status present, zero when empty)."""
        out = dict.fromkeys(_STATUSES, 0)
        for r in self._conn.execute(
            "SELECT status, COUNT(*) AS n FROM scheduled_tasks GROUP BY status"
        ):
            out[r["status"]] = int(r["n"])
        return out

    def next_due_tick(self) -> int | None:
        """Earliest due_tick among pending tasks, or None when nothing is pending."""
        row = self._conn.execute(
            "SELECT MIN(due_tick) FROM scheduled_tasks WHERE status = 'pending'"
        ).fetchone()
        return int(row[0]) if row[0] is not None else None

    def close(self) -> None:
        self._conn.close()

    def _set_status(self, task_id: int, status: str, reason: str = "") -> None:
        self._conn.execute(
            "UPDATE scheduled_tasks SET status = ?, reason = ? WHERE id = ?",
            (status, reason, task_id),
        )
        self._conn.commit()

    @staticmethod
    def _row(r: sqlite3.Row) -> ScheduledTask:
        return ScheduledTask(
            id=r["id"],
            kind=r["kind"],
            payload=json.loads(r["payload"]),
            due_tick=r["due_tick"],
            priority=r["priority"],
            status=r["status"],
            reason=r["reason"],
        )
